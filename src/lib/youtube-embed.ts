/** Resolve a YouTube embed URL from a raw URL and/or known video id. */
export function toYouTubeEmbed(url: string | null | undefined, ytId?: string | null): string | null {
  if (ytId && /^[A-Za-z0-9_-]{6,}$/.test(ytId)) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
  }
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.replace(/^\//, "").split("/")[0] || null;
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      id = u.searchParams.get("v");
      if (!id && u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/")[2] ?? null;
      }
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}