-- Make PhonePe the only registration-payment gateway. Removes the manual
-- UPI QR + screenshot flow (from 0010) and every leftover column from the
-- Razorpay attempt (0007_razorpay_payments, reverted by 0010) AND from an
-- earlier, insecure PhonePe attempt (0007_phonepe_integration.sql) that was
-- run by hand against this database via the SQL editor — it was never
-- tracked by the CLI (colliding with 0007_razorpay_payments's version
-- number) but its columns/functions/grants are live. In particular
-- `verify_phonepe_payment` was granted to `authenticated` and let any
-- logged-in user self-approve their own payment; this migration removes it.
-- No live payment data exists yet, so old columns are dropped rather than
-- migrated. Run once — the CLI's migration history for 0001-0012 has been
-- repaired to `applied` since this schema was originally built by hand via
-- the SQL editor, not through tracked migrations.
--
-- Unlike the old flow, verification never happens on the client: the only
-- functions that can mark a payment approved/rejected are SECURITY DEFINER
-- RPCs granted to service_role alone, called from the phonepe-initiate /
-- phonepe-status / phonepe-callback edge functions.

-- =========================================================
-- app_settings — drop the UPI destination and the leftover Razorpay key,
-- nothing replaces either
-- =========================================================
alter table public.app_settings
  drop column if exists upi_id,
  drop column if exists upi_payee_name,
  drop column if exists razorpay_key_id;

-- =========================================================
-- registration_payments — drop manual UPI, Razorpay, and the abandoned
-- insecure PhonePe attempt's columns; add the new PhonePe columns
-- =========================================================
alter table public.registration_payments
  drop column if exists upi_reference,
  drop column if exists screenshot_path,
  drop column if exists razorpay_order_id,
  drop column if exists razorpay_payment_id,
  drop column if exists razorpay_signature,
  drop column if exists payment_gateway,
  drop column if exists merchant_transaction_id,
  drop column if exists phonepe_transaction_id,
  drop column if exists phonepe_reference_id,
  drop column if exists payment_status,
  add column if not exists merchant_order_id text,
  add column if not exists phonepe_order_id text;

update public.registration_payments set status = 'rejected' where status not in ('initiated', 'approved', 'rejected');

alter table public.registration_payments drop constraint if exists registration_payments_status_check;
alter table public.registration_payments
  add constraint registration_payments_status_check
  check (status in ('initiated', 'approved', 'rejected'));

create unique index if not exists registration_payments_merchant_order_idx
  on public.registration_payments (merchant_order_id);

-- =========================================================
-- Drop the manual-flow RPC — no longer callable, no longer exists
-- =========================================================
drop function if exists public.submit_registration_payment(text, text);

-- Old, insecure PhonePe scaffolding from the abandoned 0007 migration file
-- (never actually applied, but drop defensively in case it was hand-run).
drop function if exists public.initiate_phonepe_payment(integer, text);
drop function if exists public.verify_phonepe_payment(text);
drop function if exists public.handle_phonepe_callback(text, text, text, text);

-- =========================================================
-- start_phonepe_payment — called by the phonepe-initiate edge function
-- (service role only). Records the pending attempt before redirecting the
-- user to PhonePe's checkout.
-- =========================================================
create or replace function public.start_phonepe_payment(
  p_user_id uuid,
  p_amount_inr integer,
  p_merchant_order_id text
)
returns public.registration_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.registration_payments;
begin
  insert into public.registration_payments (user_id, amount_inr, status, merchant_order_id)
  values (p_user_id, p_amount_inr, 'initiated', p_merchant_order_id)
  returning * into v_row;

  update public.profiles set payment_status = 'submitted' where id = p_user_id;

  return v_row;
end;
$$;

revoke all on function public.start_phonepe_payment(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.start_phonepe_payment(uuid, integer, text) to service_role;

-- =========================================================
-- approve_phonepe_payment — called by phonepe-status / phonepe-callback
-- edge functions (service role only) once PhonePe confirms COMPLETED.
-- Idempotent: a repeat call for an already-approved order is a no-op.
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
  v_referrer uuid;
  v_bonus integer;
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

  select referred_by into v_referrer from public.profiles where id = v_pay.user_id;
  if v_referrer is not null
     and not exists (select 1 from public.referral_earnings where payment_id = v_pay.id)
  then
    select referral_bonus_inr into v_bonus from public.app_settings where id = true;
    v_bonus := coalesce(v_bonus, 5);

    insert into public.referral_earnings (referrer_id, referred_user_id, payment_id, amount_inr)
    values (v_referrer, v_pay.user_id, v_pay.id, v_bonus);

    update public.profiles
    set referral_balance_inr = referral_balance_inr + v_bonus
    where id = v_referrer;
  end if;

  return v_pay;
end;
$$;

revoke all on function public.approve_phonepe_payment(text, text) from public, anon, authenticated;
grant execute on function public.approve_phonepe_payment(text, text) to service_role;

-- =========================================================
-- reject_phonepe_payment — called by phonepe-status / phonepe-callback
-- edge functions (service role only) when PhonePe reports FAILED.
-- =========================================================
create or replace function public.reject_phonepe_payment(
  p_merchant_order_id text
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
  set status = 'rejected',
      reviewed_at = now()
  where id = v_pay.id
  returning * into v_pay;

  update public.profiles
  set payment_status = 'rejected'
  where id = v_pay.user_id and payment_status <> 'approved';

  return v_pay;
end;
$$;

revoke all on function public.reject_phonepe_payment(text) from public, anon, authenticated;
grant execute on function public.reject_phonepe_payment(text) to service_role;
