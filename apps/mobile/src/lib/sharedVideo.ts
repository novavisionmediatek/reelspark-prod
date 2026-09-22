// Shared-reel deep linking (web build). A reel's share link is
// `<origin>/?v=VIDEO_ID`. On first load we lift the id out of the URL into
// sessionStorage and clean the address bar — mirrors referral.ts — so a page
// reload, or a detour through sign-up/login for a viewer who isn't signed in
// yet, still lands on the shared reel once they reach the feed.

const KEY = 'reelspark.sharedVideo';

function readStore(): string {
  try {
    return window.sessionStorage?.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/** Call once on app start. Returns the video id found in the URL or store, if any. */
export function captureSharedVideoFromUrl(): string {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('v');
    if (raw && raw.trim()) {
      const id = raw.trim();
      window.sessionStorage?.setItem(KEY, id);
      url.searchParams.delete('v');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return id;
    }
  } catch {
    /* ignore */
  }
  return readStore();
}

export function getStoredSharedVideoId(): string {
  return readStore();
}

export function clearStoredSharedVideoId(): void {
  try {
    window.sessionStorage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function sharedVideoLink(videoId: string): string {
  try {
    return `${window.location.origin}/?v=${encodeURIComponent(videoId)}`;
  } catch {
    return videoId;
  }
}
