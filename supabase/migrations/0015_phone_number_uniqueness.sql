-- One phone number can only be tied to one active registration across the
-- whole project. Previously the phone number entered on the PhonePe
-- payment form was sent to PhonePe (metaInfo.udf1) but never stored in the
-- database at all, so nothing could be checked against it. This migration
-- stores it and rejects a payment attempt that reuses a phone number that
-- is already 'initiated' or 'approved' under a different account. A phone
-- tied only to a 'rejected' payment is free to reuse (rejection means that
-- attempt didn't succeed, so the number isn't considered "taken").

alter table public.registration_payments
  add column if not exists phone_number text;

-- DB-level guarantee (not just an application check) so two concurrent
-- requests can't both slip through with the same number.
create unique index if not exists registration_payments_phone_active_idx
  on public.registration_payments (phone_number)
  where phone_number is not null and status in ('initiated', 'approved');

-- =========================================================
-- check_phone_available — lets phonepe-initiate reject a reused phone
-- number BEFORE calling PhonePe's API at all, so no live order gets
-- created for an attempt that's going to be refused anyway. The real
-- guarantee is still start_phonepe_payment's check + the unique index
-- below; this is just an early, cheap rejection.
-- =========================================================
create or replace function public.check_phone_available(
  p_phone_number text,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.registration_payments
    where phone_number = regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g')
      and status in ('initiated', 'approved')
      and user_id <> p_user_id
  );
$$;

revoke all on function public.check_phone_available(text, uuid) from public, anon, authenticated;
grant execute on function public.check_phone_available(text, uuid) to service_role;

-- =========================================================
-- start_phonepe_payment — now takes and validates the phone number.
-- Replaces the 3-arg version from 0013 with a 4-arg version.
-- =========================================================
drop function if exists public.start_phonepe_payment(uuid, integer, text);

create or replace function public.start_phonepe_payment(
  p_user_id uuid,
  p_amount_inr integer,
  p_merchant_order_id text,
  p_phone_number text
)
returns public.registration_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g');
  v_row public.registration_payments;
begin
  if v_phone = '' then
    raise exception 'A phone number is required.';
  end if;

  if exists (
    select 1 from public.registration_payments
    where phone_number = v_phone
      and status in ('initiated', 'approved')
      and user_id <> p_user_id
  ) then
    raise exception 'This phone number is already registered with another account.';
  end if;

  begin
    insert into public.registration_payments (user_id, amount_inr, status, merchant_order_id, phone_number)
    values (p_user_id, p_amount_inr, 'initiated', p_merchant_order_id, v_phone)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'This phone number is already registered with another account.';
  end;

  update public.profiles set payment_status = 'submitted' where id = p_user_id;

  return v_row;
end;
$$;

revoke all on function public.start_phonepe_payment(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.start_phonepe_payment(uuid, integer, text, text) to service_role;
