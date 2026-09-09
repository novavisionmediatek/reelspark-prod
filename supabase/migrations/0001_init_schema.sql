-- ReelSpark initial schema: profiles, videos, reports, RLS policies.
-- Run this once in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- =========================================================
-- profiles
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  phone text,
  instagram_handle text,
  youtube_handle text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  is_banned boolean not null default false,
  banned_reason text,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- videos (submissions)
-- =========================================================
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram')),
  original_url text not null,
  platform_video_id text not null,
  canonical_url text,
  thumbnail_url text,
  title text,
  author_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'flagged')),
  rejection_reason text,
  moderated_by uuid references public.profiles (id),
  moderated_at timestamptz,
  view_count_in_app integer not null default 0,
  report_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_video_id)
);

create index videos_feed_idx on public.videos (status, created_at desc) where is_deleted = false;
create index videos_submitted_by_idx on public.videos (submitted_by);

-- =========================================================
-- reports
-- =========================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('broken_link', 'spam', 'inappropriate', 'not_own_content', 'other')),
  notes text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (video_id, reported_by)
);

-- =========================================================
-- admin_actions (audit log, written by admin Edge Functions later)
-- =========================================================
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  action_type text not null,
  target_table text not null,
  target_id uuid not null,
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- is_admin() helper — used by RLS policies below
-- =========================================================
create function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$;

-- =========================================================
-- handle_new_user() — auto-create a profile row on signup
-- =========================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- updated_at maintenance
-- =========================================================
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- =========================================================
-- report_count maintenance — bump videos.report_count and
-- auto-flag once report_count crosses a threshold
-- =========================================================
create function public.handle_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.videos
  set report_count = report_count + 1,
      status = case when report_count + 1 >= 3 and status = 'approved' then 'flagged' else status end
  where id = new.video_id;
  return new;
end;
$$;

create trigger on_report_created
  after insert on public.reports
  for each row execute function public.handle_new_report();

-- =========================================================
-- submission rate limit — max 10 videos per user per 24h
-- =========================================================
create function public.check_submission_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
  from public.videos
  where submitted_by = new.submitted_by
    and created_at > now() - interval '24 hours';

  if recent_count >= 10 then
    raise exception 'Submission limit reached: max 10 videos per 24 hours.';
  end if;

  return new;
end;
$$;

create trigger videos_rate_limit
  before insert on public.videos
  for each row execute function public.check_submission_rate_limit();

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;

-- profiles
create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- videos
create policy "approved videos are publicly readable"
  on public.videos for select
  to authenticated
  using (
    (status = 'approved' and is_deleted = false)
    or submitted_by = auth.uid()
    or public.is_admin()
  );

create policy "users can submit their own videos"
  on public.videos for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "users can edit their own pending videos, admins edit any"
  on public.videos for update
  to authenticated
  using ((submitted_by = auth.uid() and status = 'pending') or public.is_admin())
  with check ((submitted_by = auth.uid() and status = 'pending') or public.is_admin());

create policy "users delete their own videos, admins delete any"
  on public.videos for delete
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

-- reports
create policy "users read their own reports, admins read all"
  on public.reports for select
  to authenticated
  using (reported_by = auth.uid() or public.is_admin());

create policy "users can file reports"
  on public.reports for insert
  to authenticated
  with check (reported_by = auth.uid());

create policy "admins manage reports"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins delete reports"
  on public.reports for delete
  to authenticated
  using (public.is_admin());

-- admin_actions
create policy "admins read the audit log"
  on public.admin_actions for select
  to authenticated
  using (public.is_admin());

create policy "admins write the audit log"
  on public.admin_actions for insert
  to authenticated
  with check (public.is_admin());

-- =========================================================
-- Storage: avatars bucket
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "users upload to their own avatar folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
