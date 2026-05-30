import * as React from "react";

/**
 * Generic media-query hook. Returns `true` when the query matches the current
 * viewport. SSR-safe: falls back to `false` when `window` is unavailable, but
 * reads the real match synchronously on the client so the first render is
 * already correct (prevents a one-frame flash of mismatched UI).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState<boolean>(() =>
    typeof window !== "undefined" && "matchMedia" in window
      ? window.matchMedia(query).matches
      : false,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
