const KEY = "nbaf:lastAdvancedTab";

export type AdvancedTab = "play-search" | "playing-time" | "advanced-stats" | "trending";

const VALID: AdvancedTab[] = ["play-search", "playing-time", "advanced-stats", "trending"];

export const ADVANCED_TAB_LABEL: Record<AdvancedTab, string> = {
  "play-search": "NBA Play Search",
  "playing-time": "Playing Time",
  "advanced-stats": "Advanced Stats",
  "trending": "Trending",
};

export function getLastAdvancedTab(): AdvancedTab | null {
  try {
    const v = localStorage.getItem(KEY) as AdvancedTab | null;
    return v && VALID.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function setLastAdvancedTab(tab: string): void {
  try {
    if (VALID.includes(tab as AdvancedTab)) localStorage.setItem(KEY, tab);
  } catch {
    // no-op
  }
}