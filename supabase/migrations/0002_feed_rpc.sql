-- Cursor-paginated feed query, used by the mobile app's FeedScreen.
create or replace function public.get_feed_page(
  cursor_created_at timestamptz default null,
  cursor_id uuid default null,
  page_size int default 10
)
returns setof public.videos
language sql
stable
as $$
  select *
  from public.videos
  where status = 'approved'
    and is_deleted = false
    and (
      cursor_created_at is null
      or (created_at, id) < (cursor_created_at, cursor_id)
    )
  order by created_at desc, id desc
  limit page_size;
$$;
