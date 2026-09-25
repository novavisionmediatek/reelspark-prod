-- reset_all_data() truncated public.profiles (and other app tables) but never
-- touched auth.users. Every account that had signed up before an admin ran
-- "Wipe all data" kept its login but permanently lost its profile row —
-- landing on CompleteProfileScreen's "Your account profile is missing.
-- Please contact support." dead end forever, with no way back in. This
-- silently orphaned real accounts (including the project owner's own) over
-- several wipes going back to early September.
--
-- The admin Settings page already describes the wipe as erasing "every row
-- in every table" and says "everything else is gone for good" — the fix
-- below makes that actually true by also removing every other account's
-- auth.users row (which the profiles/videos/etc rows already cascade from),
-- so a wipe can no longer leave a half-deleted, unrecoverable account behind.
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

  -- Remove every other account's login too — on delete cascade already
  -- takes their profiles/videos/registration_payments/etc rows with them.
  delete from auth.users where id <> caller;

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
