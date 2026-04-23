import * as React from "react";

/**
 * Generic media-query hook. Returns `true` when the query matches the current
 * viewport. SSR-safe: starts as `false` until the effect runs on the client.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
