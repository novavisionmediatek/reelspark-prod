-- Paid registration + referral system.
--   * every new user must pay a one-time fee (default ₹250) to a UPI ID and
--     submit a UTR reference + screenshot; an admin approves it
--   * until approved a user can browse but cannot INSERT into public.videos
--   * a referred user's approval credits the referrer a bonus (default ₹5),
--     tracked in a ledger + a cached balance on profiles
-- Run once in the Supabase SQL Editor (or `supabase db push`) after 0005.

-- =========================================================
-- app_settings — single editable row of tunables
-- =========================================================
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  registration_fee_inr integer not null default 250 check (registration_fee_inr >= 0),
  referral_bonus_inr integer not null default 5 check (referral_bonus_inr >= 0),
  upi_id text not null default 'matrigyan-1@okaxis',
  upi_payee_name text not null default 'matrigyan',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- =========================================================
-- referral code generator (collision-checked)
-- =========================================================
create or replace function public.gen_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  code text;
begin
  loop
    -- md5 of random text -> pure core, no pgcrypto dependency
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- =========================================================
-- profiles — payment + referral columns
-- =========================================================
alter table public.profiles
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'submitted', 'approved', 'rejected')),
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles (id),
  add column if not exists referral_balance_inr integer not null default 0;

update public.profiles set referral_code = public.gen_referral_code() where referral_code is null;

alter table public.profiles alter column referral_code set not null;
alter table public.profiles add constraint profiles_referral_code_key unique (referral_code);

-- existing staff keep posting rights; existing regular users must pay.
update public.profiles set payment_status = 'approved' where role in ('admin', 'moderator');

-- =========================================================
-- handle_new_user() — also assign referral_code + referred_by
-- (referral_code is passed at signup as options.data.referral_code)
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(trim(new.raw_user_meta_data->>'referral_code')), '');
  v_referrer uuid;
begin
  if v_code is not null then
    select id into v_referrer from public.profiles where referral_code = v_code;
  end if;

  insert into public.profiles (id, email, referral_code, referred_by)
  values (new.id, new.email, public.gen_referral_code(), v_referrer);

  return new;
end;
$$;

-- =========================================================
-- registration_payments — one row per submission attempt
-- =========================================================
create table if not exists public.registration_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_inr integer not null,
  upi_reference text,
  screenshot_path text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registration_payments_status_idx on public.registration_payments (status, created_at desc);
create index if not exists registration_payments_user_idx on public.registration_payments (user_id, created_at desc);

create trigger registration_payments_set_updated_at
  before update on public.registration_payments
  for each row execute function public.set_updated_at();

-- =========================================================
-- referral_earnings — bonus ledger (one bonus per approved payment)
-- =========================================================
create table if not exists public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid not null references public.registration_payments (id) on delete cascade,
  amount_inr integer not null,
  created_at timestamptz not null default now(),
  unique (payment_id)
);

create index if not exists referral_earnings_referrer_idx on public.referral_earnings (referrer_id, created_at desc);

-- =========================================================
-- submit_registration_payment — called by the mobile app
-- =========================================================
create or replace function public.submit_registration_payment(
  p_upi_reference text,
  p_screenshot_path text default null
)
returns public.registration_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_fee integer;
  v_row public.registration_payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select payment_status into v_status from public.profiles where id = v_uid;
  if v_status = 'approved' then
    raise exception 'Your registration is already approved.';
  end if;

  select registration_fee_inr into v_fee from public.app_settings where id = true;

  insert into public.registration_payments (user_id, amount_inr, upi_reference, screenshot_path, status)
  values (
    v_uid,
    coalesce(v_fee, 250),
    nullif(trim(p_upi_reference), ''),
    nullif(trim(p_screenshot_path), ''),
    'submitted'
  )
  returning * into v_row;

  update public.profiles set payment_status = 'submitted' where id = v_uid;

  return v_row;
end;
$$;

grant execute on function public.submit_registration_payment(text, text) to authenticated;

-- =========================================================
-- approve_registration_payment — admin only; credits referral bonus
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
  v_referrer uuid;
  v_bonus integer;
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

  -- referral bonus, once per payment
  select referred_by into v_referrer from public.profiles where id = v_pay.user_id;
  if v_referrer is not null
     and not exists (select 1 from public.referral_earnings where payment_id = p_payment_id)
  then
    select referral_bonus_inr into v_bonus from public.app_settings where id = true;
    v_bonus := coalesce(v_bonus, 5);

    insert into public.referral_earnings (referrer_id, referred_user_id, payment_id, amount_inr)
    values (v_referrer, v_pay.user_id, p_payment_id, v_bonus);

    update public.profiles
    set referral_balance_inr = referral_balance_inr + v_bonus
    where id = v_referrer;
  end if;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, notes)
  values (v_admin, 'approve_payment', 'registration_payments', p_payment_id, nullif(trim(p_note), ''));
end;
$$;

grant execute on function public.approve_registration_payment(uuid, text) to authenticated;

-- =========================================================
-- reject_registration_payment — admin only
-- =========================================================
create or replace function public.reject_registration_payment(
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
    raise exception 'Only admins can reject payments.';
  end if;

  select * into v_pay from public.registration_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.';
  end if;

  update public.registration_payments
  set status = 'rejected',
      reviewed_by = v_admin,
      reviewed_at = now(),
      admin_note = nullif(trim(p_note), '')
  where id = p_payment_id;

  -- don't downgrade someone who is already approved from an earlier payment
  update public.profiles
  set payment_status = 'rejected'
  where id = v_pay.user_id and payment_status <> 'approved';

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, notes)
  values (v_admin, 'reject_payment', 'registration_payments', p_payment_id, nullif(trim(p_note), ''));
end;
$$;

grant execute on function public.reject_registration_payment(uuid, text) to authenticated;

-- =========================================================
-- block video submissions from users whose payment isn't approved
-- (runs alongside the existing videos_rate_limit trigger)
-- =========================================================
create or replace function public.check_can_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if (select payment_status from public.profiles where id = new.submitted_by) <> 'approved' then
    raise exception 'Your registration payment must be approved before you can post videos.';
  end if;

  return new;
end;
$$;

create trigger videos_check_can_post
  before insert on public.videos
  for each row execute function public.check_can_post();

-- =========================================================
-- reset_all_data — extend the wipe to the new tables
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

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.app_settings enable row level security;
alter table public.registration_payments enable row level security;
alter table public.referral_earnings enable row level security;

create policy "app settings readable by authenticated users"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "admins update app settings"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- registration_payments: reads only. All writes go through the SECURITY DEFINER
-- RPCs above (submit / approve / reject).
create policy "users read their own payments, admins read all"
  on public.registration_payments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "users read their own referral earnings, admins read all"
  on public.referral_earnings for select
  to authenticated
  using (referrer_id = auth.uid() or public.is_admin());

-- =========================================================
-- Storage: private payment-proofs bucket
-- =========================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "payment proofs readable by owner or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "users upload their own payment proof"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own payment proof"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
