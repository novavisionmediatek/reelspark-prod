export type DetectedPlatform = 'youtube' | 'instagram' | null;

const YOUTUBE_PATTERNS = [
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
];

const INSTAGRAM_PATTERN = /instagram\.com\/(?:reel|reels)\/([a-zA-Z0-9_-]+)/;

export function detectPlatform(url: string): { platform: DetectedPlatform; videoId: string | null } {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return { platform: 'youtube', videoId: match[1] };
  }
  const igMatch = url.match(INSTAGRAM_PATTERN);
  if (igMatch) return { platform: 'instagram', videoId: igMatch[1] };
  return { platform: null, videoId: null };
}
