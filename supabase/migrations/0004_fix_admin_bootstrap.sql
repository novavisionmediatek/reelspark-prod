-- The privilege-escalation guard added in 0003 blocked ALL role/ban changes,
-- including ones run directly in the SQL Editor — which made it impossible to
-- ever set the first admin. Fix: only block the change when it's coming from
-- a logged-in app user (auth.uid() is set) who isn't already an admin. SQL
-- Editor / migrations run with no JWT context (auth.uid() is null) and stay
-- unaffected, since dashboard access is already a trusted boundary.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
      or new.is_banned is distinct from old.is_banned
      or new.banned_reason is distinct from old.banned_reason
      or new.banned_at is distinct from old.banned_at
    then
      raise exception 'Only admins can change role or ban status.';
    end if;
  end if;
  return new;
end;
$$;
