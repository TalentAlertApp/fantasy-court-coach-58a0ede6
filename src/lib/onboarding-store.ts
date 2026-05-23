/**
 * Per-user onboarding resume state + session-scoped skip flag.
 */

export type OnboardingStep = "hero" | "name" | "league" | "draft";

export interface OnboardingState {
  step: OnboardingStep;
  teamId?: string;
  teamName?: string;
  sport?: "nba" | "wnba" | "euroleague";
}

const SESSION_SKIP_KEY = "nba_onboarding_skipped";
const SESSION_CREATING_NEW_TEAM_KEY = "nba_onboarding_creating_new_team";
const STATE_KEY_PREFIX = "nba_onboarding_state:";
const DRAFT_KEY_PREFIX = "nba_onboarding_draft:";

function stateKey(userId: string): string {
  return `${STATE_KEY_PREFIX}${userId}`;
}

function draftKey(userId: string): string {
  return `${DRAFT_KEY_PREFIX}${userId}`;
}

/* ---------------- In-progress draft (mid-onboarding) ---------------- */

export interface OnboardingDraft {
  name: string;
  sport: "nba" | "wnba" | "euroleague";
  extraLeagueIds: string[];
}

export function getOnboardingDraft(userId: string | null | undefined): OnboardingDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.name !== "string") return null;
    if (parsed.sport !== "nba" && parsed.sport !== "wnba" && parsed.sport !== "euroleague") return null;
    if (!Array.isArray(parsed.extraLeagueIds)) return null;
    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
}

export function setOnboardingDraft(userId: string | null | undefined, draft: OnboardingDraft): void {
  if (!userId) return;
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch { /* ignore */ }
}

export function clearOnboardingDraft(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(draftKey(userId));
  } catch { /* ignore */ }
}

/* ---------------- Session skip ---------------- */

export function getOnboardingSkipped(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingSkipped(): void {
  try {
    sessionStorage.setItem(SESSION_SKIP_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearOnboardingSkipped(): void {
  try {
    sessionStorage.removeItem(SESSION_SKIP_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------- Session "creating new team" flag ---------------- */

export function isCreatingNewTeam(): boolean {
  try {
    return sessionStorage.getItem(SESSION_CREATING_NEW_TEAM_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCreatingNewTeam(): void {
  try {
    sessionStorage.setItem(SESSION_CREATING_NEW_TEAM_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearCreatingNewTeam(): void {
  try {
    sessionStorage.removeItem(SESSION_CREATING_NEW_TEAM_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------- Persistent step state ---------------- */

export function getOnboardingState(userId: string | null | undefined): OnboardingState | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      parsed.step !== "hero" &&
      parsed.step !== "name" &&
      parsed.step !== "league" &&
      parsed.step !== "draft"
    ) return null;
    return parsed as OnboardingState;
  } catch {
    return null;
  }
}

export function setOnboardingState(userId: string | null | undefined, state: OnboardingState): void {
  if (!userId) return;
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearOnboardingState(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(stateKey(userId));
  } catch {
    /* ignore */
  }
}

/** Clears all onboarding-related browser storage. Used on sign-out. */
export function clearAllOnboardingStorage(): void {
  try {
    clearOnboardingSkipped();
    // Wipe every per-user state key
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STATE_KEY_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}