-- Switch registration payments from the manual UPI/QR + screenshot flow to
-- Razorpay Checkout. An order is created server-side, the user pays in the
-- Razorpay widget, and the payment signature is verified server-side before the
-- registration is approved. Run once in the Supabase SQL Editor after 0006.

-- =========================================================
-- app_settings — drop the UPI destination, add the publishable Razorpay key id
-- =========================================================
alter table public.app_settings
  drop column if exists upi_id,
  drop column if exists upi_payee_name,
  add column if not exists razorpay_key_id text not null default '';

-- Registration fee is now ₹300 and the referrer bonus ₹50. Bump the column
-- defaults (for fresh environments) and the single live settings row. Admins can
-- still override both from the admin Settings page afterwards.
alter table public.app_settings
  alter column registration_fee_inr set default 300,
  alter column referral_bonus_inr set default 50;

update public.app_settings
  set registration_fee_inr = 300,
      referral_bonus_inr = 50
  where id = true;

-- =========================================================
-- registration_payments — Razorpay identifiers + a pre-payment 'created' state
-- =========================================================
alter table public.registration_payments
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text;

alter table public.registration_payments drop constraint if exists registration_payments_status_check;
alter table public.registration_payments
  add constraint registration_payments_status_check
  check (status in ('created', 'submitted', 'approved', 'rejected'));

create index if not exists registration_payments_rzp_order_idx
  on public.registration_payments (razorpay_order_id);

-- The screenshot/UTR columns are dead now; keep them nullable for old rows but
-- the app no longer writes them.
alter table public.registration_payments alter column upi_reference drop not null;

-- =========================================================
-- start_razorpay_payment — called by the razorpay-create-order edge function
-- (service role only). Records a pending attempt tied to the Razorpay order.
-- =========================================================
create or replace function public.start_razorpay_payment(
  p_user_id uuid,
  p_amount_inr integer,
  p_order_id text
)
returns public.registration_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.registration_payments;
begin
  insert into public.registration_payments (user_id, amount_inr, status, razorpay_order_id)
  values (p_user_id, p_amount_inr, 'created', p_order_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_razorpay_payment(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.start_razorpay_payment(uuid, integer, text) to service_role;

-- =========================================================
-- confirm_razorpay_payment — called by the razorpay-verify-payment edge function
-- (service role only) once the HMAC signature check has passed. Approves the
-- attempt, unlocks posting and credits the referral bonus (once per payment).
-- Idempotent: a repeat call for an already-approved order is a no-op.
-- =========================================================
create or replace function public.confirm_razorpay_payment(
  p_order_id text,
  p_payment_id text,
  p_signature text
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
  where razorpay_order_id = p_order_id
  for update;

  if not found then
    raise exception 'No payment attempt for Razorpay order %', p_order_id;
  end if;

  if v_pay.status = 'approved' then
    return v_pay;
  end if;

  update public.registration_payments
  set status = 'approved',
      razorpay_payment_id = p_payment_id,
      razorpay_signature = p_signature,
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

revoke all on function public.confirm_razorpay_payment(text, text, text) from public, anon, authenticated;
grant execute on function public.confirm_razorpay_payment(text, text, text) to service_role;

-- =========================================================
-- Drop the old manual-submit RPC — the app no longer calls it. Admin approve /
-- reject RPCs stay for manual overrides.
-- =========================================================
drop function if exists public.submit_registration_payment(text, text);
