/**
 * Options that control the YouTube embed URL shape. Each context opts into the
 * params it currently uses so existing playback behavior is preserved exactly.
 */
export interface YouTubeEmbedOptions {
  autoplay?: boolean;
  enableJsApi?: boolean;
  nocookie?: boolean;
  muted?: boolean;
  /** Preserve `modestbranding=1` for contexts that already use it. */
  modestBranding?: boolean;
}

/**
 * Extract a YouTube video id from a known id and/or a raw URL.
 * Supports: raw ids, youtu.be, youtube.com/watch?v=, /shorts/, /embed/, and
 * youtube-nocookie.com/embed/. Pure — no side effects.
 */
export function extractYouTubeId(
  url?: string | null,
  ytId?: string | null,
): string | null {
  if (ytId && /^[A-Za-z0-9_-]{6,}$/.test(ytId)) return ytId;
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? null;
      const v = u.searchParams.get("v");
      if (v) return v;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a YouTube embed URL from a video id. Param order is deterministic so
 * each caller reproduces its current URL exactly:
 *   autoplay → rel(=0) → modestbranding → enablejsapi → mute
 */
export function buildYouTubeEmbedUrl(id: string, options: YouTubeEmbedOptions = {}): string {
  const {
    autoplay = false,
    enableJsApi = false,
    nocookie = false,
    muted = false,
    modestBranding = false,
  } = options;
  const host = nocookie ? "www.youtube-nocookie.com" : "www.youtube.com";
  const params: string[] = [];
  if (autoplay) params.push("autoplay=1");
  params.push("rel=0");
  if (modestBranding) params.push("modestbranding=1");
  if (enableJsApi) params.push("enablejsapi=1");
  if (muted) params.push("mute=1");
  return `https://${host}/embed/${id}?${params.join("&")}`;
}

/**
 * Resolve a YouTube embed URL from a raw URL and/or known video id.
 * Defaults to autoplay-on to preserve existing behavior for callers that don't
 * pass options (GameRecapsModal, GameDetailModal).
 */
export function toYouTubeEmbed(
  url?: string | null,
  ytId?: string | null,
  options: YouTubeEmbedOptions = { autoplay: true },
): string | null {
  const id = extractYouTubeId(url, ytId);
  if (!id) return null;
  return buildYouTubeEmbedUrl(id, options);
}