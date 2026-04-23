const SIGNOUT_PREFIX = "nba_last_signout:";
const SESSION_SEEN_KEY = "nba_welcome_back_seen";
const TEAM_PICKED_SESSION_KEY = "nba_team_picked_this_session";

export function recordSignOut(userId: string | null | undefined) {
  if (!userId) return;
  try {
    localStorage.setItem(SIGNOUT_PREFIX + userId, new Date().toISOString());
  } catch { /* noop */ }
}

export function getLastSignOut(userId: string | null | undefined): Date | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(SIGNOUT_PREFIX + userId);
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function clearLastSignOut(userId: string | null | undefined) {
  if (!userId) return;
  try {
    localStorage.removeItem(SIGNOUT_PREFIX + userId);
  } catch { /* noop */ }
}

export function isWelcomeBackSeenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeBackSeenThisSession() {
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, "1");
  } catch { /* noop */ }
}

/** True if user signed out >1h ago and we haven't shown the recap yet this session. */
export function shouldShowWelcomeBack(userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (isWelcomeBackSeenThisSession()) return false;
  const last = getLastSignOut(userId);
  if (!last) return false;
  const ONE_HOUR = 60 * 60 * 1000;
  return Date.now() - last.getTime() > ONE_HOUR;
}

export function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const y = Math.floor(mo / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

/** Multi-team picker is one-shot per session. */
export function isTeamPickedThisSession(): boolean {
  try {
    return sessionStorage.getItem(TEAM_PICKED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTeamPickedThisSession() {
  try {
    sessionStorage.setItem(TEAM_PICKED_SESSION_KEY, "1");
  } catch { /* noop */ }
}

export function clearTeamPickedThisSession() {
  try {
    sessionStorage.removeItem(TEAM_PICKED_SESSION_KEY);
  } catch { /* noop */ }
}
