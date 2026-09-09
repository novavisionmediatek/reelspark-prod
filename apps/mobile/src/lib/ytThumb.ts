// The oEmbed hands back the 4:3 `hqdefault.jpg` (480x360), which pillarboxes a
// Short's art in white bars. `oardefault.jpg` is the Short's real 1080x1920
// frame — use that so the poster covers the feed with the right aspect ratio.
function ytFile(url: string, file: string): string {
  return url.replace(
    /^(https?:\/\/i\.ytimg\.com\/vi\/[^/]+\/)[a-z0-9_]+\.jpg(\?.*)?$/i,
    `$1${file}.jpg`,
  );
}

export function bestYtThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  return ytFile(url, 'oardefault');
}

// oardefault.jpg 404s for the occasional video — fall back to the stored URL.
export function ytThumbnailFallback(url: string | null | undefined, currentSrc: string): string | null {
  if (!url || currentSrc === url) return null;
  return url;
}
