import { bestYtThumbnail } from './ytThumb';

export interface OEmbedResult {
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
}

// Public, free, no API key required. Called directly from the app for now —
// see PROJECT_PLAN.md §5 for moving this behind a Supabase Edge Function later
// (needed for Instagram, which requires a Meta access token server-side).
export async function fetchYouTubeOEmbed(url: string): Promise<OEmbedResult> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    return { title: null, authorName: null, thumbnailUrl: null };
  }
  const data = await res.json();
  return {
    title: data.title ?? null,
    authorName: data.author_name ?? null,
    thumbnailUrl: bestYtThumbnail(data.thumbnail_url) ?? null,
  };
}
