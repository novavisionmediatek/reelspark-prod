-- Referral wallet withdrawals.
--   * a user whose referral_balance_inr is at least
--     app_settings.min_referral_withdrawal_inr can cash out to a UPI ID
--   * withdrawals are auto-approved ("paid") the instant they're requested:
--     the cached balance is debited atomically and a ledger row is written
--   * admins see every withdrawal (globally and per user) and can mark one
--     'failed' / 'reversed', which refunds the balance
-- Run once in the Supabase SQL Editor (or `supabase db push`) after 0007.

-- =========================================================
-- app_settings — minimum referral withdrawal
-- =========================================================
alter table public.app_settings
  add column if not exists min_referral_withdrawal_inr integer not null default 150
    check (min_referral_withdrawal_inr >= 0);

update public.app_settings set min_referral_withdrawal_inr = 150 where id = true;

-- =========================================================
-- referral_withdrawals — one row per cash-out
-- =========================================================
create table if not exists public.referral_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_inr integer not null check (amount_inr > 0),
  upi_id text not null,
  status text not null default 'paid' check (status in ('paid', 'failed', 'reversed')),
  reference text,
  admin_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_withdrawals_user_idx
  on public.referral_withdrawals (user_id, created_at desc);
create index if not exists referral_withdrawals_status_idx
  on public.referral_withdrawals (status, created_at desc);

create trigger referral_withdrawals_set_updated_at
  before update on public.referral_withdrawals
  for each row execute function public.set_updated_at();

-- =========================================================
-- request_referral_withdrawal — called by the mobile app.
-- Debits the caller's cached referral balance and records a 'paid'
-- withdrawal in a single transaction. The profile row is locked so two
-- concurrent requests can't overdraw the balance.
-- =========================================================
create or replace function public.request_referral_withdrawal(
  p_amount_inr integer,
  p_upi_id text
)
returns public.referral_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_upi text := nullif(trim(p_upi_id), '');
  v_min integer;
  v_balance integer;
  v_row public.referral_withdrawals;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  if v_upi is null or v_upi !~ '^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]+$' then
    raise exception 'Enter a valid UPI ID, for example name@bank.';
  end if;

  if p_amount_inr is null or p_amount_inr <= 0 then
    raise exception 'Enter a valid amount.';
  end if;

  select min_referral_withdrawal_inr into v_min from public.app_settings where id = true;
  v_min := coalesce(v_min, 150);

  if p_amount_inr < v_min then
    raise exception 'Minimum withdrawal is %.', v_min;
  end if;

  select referral_balance_inr into v_balance
  from public.profiles where id = v_uid for update;

  if coalesce(v_balance, 0) < p_amount_inr then
    raise exception 'Your referral balance (%) is less than %.', coalesce(v_balance, 0), p_amount_inr;
  end if;

  update public.profiles
  set referral_balance_inr = referral_balance_inr - p_amount_inr
  where id = v_uid;

  insert into public.referral_withdrawals (user_id, amount_inr, upi_id, status)
  values (v_uid, p_amount_inr, v_upi, 'paid')
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.request_referral_withdrawal(integer, text) to authenticated;

-- =========================================================
-- set_referral_withdrawal_status — admin only. Marking a 'paid' withdrawal
-- 'failed' or 'reversed' refunds the amount to the user's referral balance;
-- moving it back to 'paid' debits it again (guarding against a negative balance).
-- =========================================================
create or replace function public.set_referral_withdrawal_status(
  p_id uuid,
  p_status text,
  p_note text default null,
  p_reference text default null
)
returns public.referral_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_w public.referral_withdrawals;
  v_balance integer;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Only admins can update withdrawals.';
  end if;

  if p_status not in ('paid', 'failed', 'reversed') then
    raise exception 'Invalid status %.', p_status;
  end if;

  select * into v_w from public.referral_withdrawals where id = p_id for update;
  if not found then
    raise exception 'Withdrawal not found.';
  end if;

  if v_w.status <> p_status then
    -- refund when leaving 'paid'
    if v_w.status = 'paid' then
      update public.profiles
      set referral_balance_inr = referral_balance_inr + v_w.amount_inr
      where id = v_w.user_id;
    end if;

    -- re-debit when returning to 'paid'
    if p_status = 'paid' then
      select referral_balance_inr into v_balance
      from public.profiles where id = v_w.user_id for update;
      if coalesce(v_balance, 0) < v_w.amount_inr then
        raise exception 'User balance (%) is less than % — cannot re-mark as paid.',
          coalesce(v_balance, 0), v_w.amount_inr;
      end if;
      update public.profiles
      set referral_balance_inr = referral_balance_inr - v_w.amount_inr
      where id = v_w.user_id;
    end if;
  end if;

  update public.referral_withdrawals
  set status = p_status,
      admin_note = nullif(trim(p_note), ''),
      reference = coalesce(nullif(trim(p_reference), ''), reference),
      reviewed_by = v_admin,
      reviewed_at = now()
  where id = p_id
  returning * into v_w;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, notes)
  values (v_admin, 'withdrawal_' || p_status, 'referral_withdrawals', p_id, nullif(trim(p_note), ''));

  return v_w;
end;
$$;

grant execute on function public.set_referral_withdrawal_status(uuid, text, text, text) to authenticated;

-- =========================================================
-- Row Level Security — reads only. Writes go through the RPCs above.
-- =========================================================
alter table public.referral_withdrawals enable row level security;

create policy "users read their own withdrawals, admins read all"
  on public.referral_withdrawals for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =========================================================
-- reset_all_data — extend the wipe to the new table
-- =========================================================
create or replace function public.reset_all_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_email text;
begin
  if caller is null or not public.is_admin() then
    raise exception 'Only admins can reset the database.';
  end if;

  select email into caller_email from public.profiles where id = caller;

  truncate table
    public.admin_actions,
    public.referral_withdrawals,
    public.referral_earnings,
    public.registration_payments,
    public.reports,
    public.videos,
    public.profiles
  restart identity cascade;

  insert into public.profiles (id, email, role, referral_code, payment_status)
  values (caller, caller_email, 'admin', public.gen_referral_code(), 'approved');
end;
$$;

grant execute on function public.reset_all_data() to authenticated;
