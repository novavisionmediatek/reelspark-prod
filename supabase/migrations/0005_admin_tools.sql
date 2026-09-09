-- Admin dashboard tools:
--   1) promote_to_admin(email)  — grant admin role to an existing account by email
--   2) reset_all_data()         — truncate every app table (full data wipe)
-- Both are SECURITY DEFINER and refuse to run unless the caller is an admin.

-- =========================================================
-- promote_to_admin — used by the "Add an admin" form.
-- The person must already have signed up in the mobile app
-- (so a profiles row exists). Returns the promoted profile id.
-- =========================================================
create or replace function public.promote_to_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins can promote other users.';
  end if;

  update public.profiles
  set role = 'admin'
  where lower(email) = lower(trim(p_email))
  returning id into target_id;

  if target_id is null then
    raise exception 'No account found for %. Ask them to sign up in the app first.', p_email;
  end if;

  return target_id;
end;
$$;

grant execute on function public.promote_to_admin(text) to authenticated;

-- =========================================================
-- reset_all_data — wipes all rows from every app table.
-- The calling admin's own profile row is recreated afterwards
-- so the dashboard stays usable; everything else is blank.
-- auth.users is left untouched (users can still log in, but
-- won't have a profile until the signup trigger runs again).
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
    public.reports,
    public.videos,
    public.profiles
  restart identity cascade;

  insert into public.profiles (id, email, role)
  values (caller, caller_email, 'admin');
end;
$$;

grant execute on function public.reset_all_data() to authenticated;
