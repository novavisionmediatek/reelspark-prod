-- 1) Prevent a non-admin from self-promoting via profile self-update.
-- RLS on `profiles` only checks row ownership (auth.uid() = id), not which
-- columns changed — without this guard, any user could UPDATE their own
-- row and set role='admin' or is_banned=false.
create function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
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

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- 2) Safe, narrow way for any authenticated user to bump a video's in-app
-- view count, without granting general UPDATE rights on other users' videos.
create function public.increment_view_count(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.videos
  set view_count_in_app = view_count_in_app + 1
  where id = p_video_id and status = 'approved' and is_deleted = false;
end;
$$;

grant execute on function public.increment_view_count(uuid) to authenticated;
