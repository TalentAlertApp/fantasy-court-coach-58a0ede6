/**
 * Per-user onboarding resume state + session-scoped skip flag.
 */

export type OnboardingStep = "hero" | "name" | "draft";

export interface OnboardingState {
  step: OnboardingStep;
  teamId?: string;
  teamName?: string;
}

const SESSION_SKIP_KEY = "nba_onboarding_skipped";
const STATE_KEY_PREFIX = "nba_onboarding_state:";

function stateKey(userId: string): string {
  return `${STATE_KEY_PREFIX}${userId}`;
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

/* ---------------- Persistent step state ---------------- */

export function getOnboardingState(userId: string | null | undefined): OnboardingState | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.step !== "hero" && parsed.step !== "name" && parsed.step !== "draft") return null;
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