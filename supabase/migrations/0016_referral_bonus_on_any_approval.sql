-- Credit the referral bonus whenever a user becomes 'approved' — however that
-- happens — and backfill everyone who was approved without it.
--
-- THE BUG: the bonus was only ever credited inside approve_registration_payment
-- (0006) and approve_phonepe_payment (0013), and both need a registration_payments
-- row. Approving someone by editing profiles.payment_status = 'approved' straight
-- in the Supabase table editor has no payment row, so no referral_earnings row was
-- written and the referrer's referral_balance_inr never moved. Result: users who
-- were referred and are fully paid/approved showed ₹0 for their referrer.
--
-- THE FIX:
--   1. credit_referral_bonus(user, payment?) — ONE idempotent place that pays the
--      bonus. One bonus per referred user, ever.
--   2. A trigger on profiles calls it whenever payment_status becomes 'approved'
--      (or referred_by is set on an already-approved user), so table-editor / SQL
--      approvals pay the bonus exactly like the app flow does.
--   3. The two approval RPCs call the same function instead of their own copy.
--   4. Backfill: pay every already-approved, referred user who was missed.
--   5. referral_wallet_summary view + reconcile_referral_balances() so the ledger
--      and the cached balance can be audited and repaired at any time.
--
-- Referral is single-level: the bonus goes to the DIRECT referrer only
-- (A refers B refers C  ->  A is paid for B, B is paid for C, A gets nothing for C).
--
-- Run once in the Supabase SQL Editor (or `supabase db push`) after 0015.

-- =========================================================
-- referral_earnings — payment_id becomes optional (a manual approval has no
-- payment row) and rows can carry a note explaining where they came from
-- =========================================================
alter table public.referral_earnings
  alter column payment_id drop not null,
  add column if not exists note text;

-- One bonus per referred user. Skipped (with a notice) if old data already
-- contains duplicates, so the migration can't fail halfway through.
do $$
begin
  if exists (
    select 1 from public.referral_earnings
    group by referred_user_id having count(*) > 1
  ) then
    raise notice 'referral_earnings has duplicate referred_user_id rows; skipping unique index. Clean them up, then re-run this statement.';
  else
    create unique index if not exists referral_earnings_referred_user_key
      on public.referral_earnings (referred_user_id);
  end if;
end;
$$;

-- =========================================================
-- credit_referral_bonus — the single, idempotent place a bonus is paid.
-- Returns the amount credited (0 if nothing was due / already paid).
-- Not callable by app users: only triggers, other SECURITY DEFINER functions
-- and the SQL editor (postgres) reach it.
-- =========================================================
create or replace function public.credit_referral_bonus(
  p_user_id uuid,
  p_payment_id uuid default null,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_role text;
  v_status text;
  v_bonus integer;
  v_existing uuid;
begin
  select referred_by, role, payment_status
    into v_referrer, v_role, v_status
  from public.profiles where id = p_user_id;

  -- nothing due: unknown user, no referrer, self-referral, not approved yet,
  -- or staff (auto-approved without paying, so they earn their referrer nothing)
  if not found
     or v_referrer is null
     or v_referrer = p_user_id
     or v_status <> 'approved'
     or v_role <> 'user'
  then
    return 0;
  end if;

  -- lock the referrer's profile so concurrent approvals serialise
  perform 1 from public.profiles where id = v_referrer for update;
  if not found then
    return 0;
  end if;

  select id into v_existing
  from public.referral_earnings
  where referred_user_id = p_user_id
  limit 1;

  if found then
    -- already paid; just link the payment row if we now know it
    if p_payment_id is not null then
      update public.referral_earnings
      set payment_id = p_payment_id
      where id = v_existing
        and payment_id is null
        and not exists (select 1 from public.referral_earnings where payment_id = p_payment_id);
    end if;
    return 0;
  end if;

  select referral_bonus_inr into v_bonus from public.app_settings where id = true;
  v_bonus := coalesce(v_bonus, 5);
  if v_bonus <= 0 then
    return 0;
  end if;

  insert into public.referral_earnings (referrer_id, referred_user_id, payment_id, amount_inr, note)
  values (v_referrer, p_user_id, p_payment_id, v_bonus, p_note);

  update public.profiles
  set referral_balance_inr = referral_balance_inr + v_bonus
  where id = v_referrer;

  return v_bonus;
end;
$$;

revoke all on function public.credit_referral_bonus(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.credit_referral_bonus(uuid, uuid, text) to service_role;

-- =========================================================
-- Trigger: any route to 'approved' pays the referrer
-- =========================================================
create or replace function public.profiles_credit_referral_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment uuid;
begin
  select id into v_payment
  from public.registration_payments
  where user_id = new.id and status = 'approved'
  order by created_at desc
  limit 1;

  perform public.credit_referral_bonus(
    new.id,
    v_payment,
    case when v_payment is null then 'Approved without a payment record (manual approval)' end
  );

  return null;
end;
$$;

drop trigger if exists profiles_credit_referral_bonus on public.profiles;
create trigger profiles_credit_referral_bonus
  after insert or update of payment_status, referred_by on public.profiles
  for each row
  when (new.payment_status = 'approved' and new.referred_by is not null)
  execute function public.profiles_credit_referral_bonus();

-- =========================================================
-- approve_registration_payment (admin) — same as 0006 but the bonus goes
-- through credit_referral_bonus
-- =========================================================
create or replace function public.approve_registration_payment(
  p_payment_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_pay public.registration_payments;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Only admins can approve payments.';
  end if;

  select * into v_pay from public.registration_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.';
  end if;

  update public.registration_payments
  set status = 'approved',
      reviewed_by = v_admin,
      reviewed_at = now(),
      admin_note = nullif(trim(p_note), '')
  where id = p_payment_id;

  update public.profiles set payment_status = 'approved' where id = v_pay.user_id;

  -- idempotent; the profiles trigger has usually paid it already, this links the payment
  perform public.credit_referral_bonus(v_pay.user_id, p_payment_id);

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, notes)
  values (v_admin, 'approve_payment', 'registration_payments', p_payment_id, nullif(trim(p_note), ''));
end;
$$;

grant execute on function public.approve_registration_payment(uuid, text) to authenticated;

-- =========================================================
-- approve_phonepe_payment (service role) — same as 0013 but the bonus goes
-- through credit_referral_bonus
-- =========================================================
create or replace function public.approve_phonepe_payment(
  p_merchant_order_id text,
  p_phonepe_order_id text
)
returns public.registration_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.registration_payments;
begin
  select * into v_pay
  from public.registration_payments
  where merchant_order_id = p_merchant_order_id
  for update;

  if not found then
    raise exception 'No payment attempt for order %', p_merchant_order_id;
  end if;

  if v_pay.status = 'approved' then
    return v_pay;
  end if;

  update public.registration_payments
  set status = 'approved',
      phonepe_order_id = p_phonepe_order_id,
      reviewed_at = now()
  where id = v_pay.id
  returning * into v_pay;

  update public.profiles set payment_status = 'approved' where id = v_pay.user_id;

  perform public.credit_referral_bonus(v_pay.user_id, v_pay.id);

  return v_pay;
end;
$$;

revoke all on function public.approve_phonepe_payment(text, text) from public, anon, authenticated;
grant execute on function public.approve_phonepe_payment(text, text) to service_role;

-- =========================================================
-- BACKFILL — pay every referral that was approved but never credited.
-- Uses the bonus currently in app_settings.referral_bonus_inr.
-- =========================================================
do $$
declare
  r record;
  v_paid integer;
  v_total integer := 0;
  v_count integer := 0;
begin
  for r in
    select p.id,
           (select rp.id from public.registration_payments rp
             where rp.user_id = p.id and rp.status = 'approved'
             order by rp.created_at desc limit 1) as payment_id
    from public.profiles p
    where p.payment_status = 'approved'
      and p.referred_by is not null
      and not exists (select 1 from public.referral_earnings e where e.referred_user_id = p.id)
    order by p.created_at
  loop
    v_paid := public.credit_referral_bonus(
      r.id,
      r.payment_id,
      case when r.payment_id is null
        then 'Backfilled: approved without a payment record'
        else 'Backfilled: missed bonus'
      end
    );
    if v_paid > 0 then
      v_count := v_count + 1;
      v_total := v_total + v_paid;
    end if;
  end loop;

  raise notice 'Referral backfill: % referrals credited, ₹% total.', v_count, v_total;
end;
$$;

-- =========================================================
-- referral_wallet_summary — audit view: for every user, what the ledger says
-- vs what the cached balance says. Admin / SQL-editor only.
--   computed_balance_inr = earned - paid withdrawals
--   balance_mismatch     = cached balance differs from the ledger
-- =========================================================
create or replace view public.referral_wallet_summary as
select
  p.id as user_id,
  p.email,
  p.display_name,
  p.referral_code,
  p.payment_status,
  ref.email as referred_by_email,
  (select count(*) from public.profiles c
    where c.referred_by = p.id) as referred_users,
  (select count(*) from public.profiles c
    where c.referred_by = p.id and c.payment_status = 'approved') as referred_users_approved,
  coalesce(e.earned, 0) as earned_inr,
  coalesce(w.withdrawn, 0) as withdrawn_inr,
  coalesce(e.earned, 0) - coalesce(w.withdrawn, 0) as computed_balance_inr,
  p.referral_balance_inr as cached_balance_inr,
  p.referral_balance_inr <> coalesce(e.earned, 0) - coalesce(w.withdrawn, 0) as balance_mismatch,
  -- approved + referred, but no ledger row: should be empty after this migration
  exists (
    select 1 from public.profiles c
    where c.referred_by = p.id and c.payment_status = 'approved' and c.role = 'user'
      and not exists (select 1 from public.referral_earnings x where x.referred_user_id = c.id)
  ) as has_unpaid_referrals
from public.profiles p
left join public.profiles ref on ref.id = p.referred_by
left join lateral (
  select sum(amount_inr)::integer as earned
  from public.referral_earnings where referrer_id = p.id
) e on true
left join lateral (
  select sum(amount_inr)::integer as withdrawn
  from public.referral_withdrawals where user_id = p.id and status = 'paid'
) w on true;

alter view public.referral_wallet_summary set (security_invoker = on);
revoke all on public.referral_wallet_summary from public, anon, authenticated;

-- =========================================================
-- reconcile_referral_balances — set every cached balance to earned - paid
-- withdrawals. Returns how many profiles changed. Run manually when
-- referral_wallet_summary shows balance_mismatch = true and you've decided the
-- ledger is right. NOT run automatically: a hand-edited balance with no ledger
-- row would be overwritten.
-- =========================================================
create or replace function public.reconcile_referral_balances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  update public.profiles p
  set referral_balance_inr = s.computed_balance_inr
  from public.referral_wallet_summary s
  where s.user_id = p.id and s.balance_mismatch;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.reconcile_referral_balances() from public, anon, authenticated;
grant execute on function public.reconcile_referral_balances() to service_role;
