## Findings

**Issue 2 — intro leaks at login:** `RequireAuth` consumes `sessionStorage["nba_show_entry_intro_once"]` on *every* mount, regardless of route. The flag is intentionally set by `OnboardingPage.handleFinish` for the "brand-new team enters the Court" moment, but nothing prevents it from being read on `/welcome/pick-team` or other routes during a later sign-in within the same tab session.

**Issue 1 — WB recap shown for a brand-new team:** `handleFinish` already calls `markWelcomeBackSeenThisSession()`, but in edge cases (navigation race, second mount of RequireAuth before sessionStorage settles) the recap can still slip through. The brand-new team flow can be made bulletproof by also treating the queued entry-intro flag as a hard "skip WB" signal.

User wants to **keep** the rotating-logo intro for the new-team "Enter the Court" moment (post-draft) — only remove the random pre-login appearance and the recap leak.

## Plan

Two files, presentation only.

### 1. `src/components/auth/RequireAuth.tsx`

- Keep `entryIntroOpen` state, the `BallersIQEntryIntro` import, and the overlay render.
- Tighten the consumption useEffect:
  - Only read/consume `sessionStorage["nba_show_entry_intro_once"]` when `location.pathname` is **not** `/welcome` and **not** `/welcome/pick-team`. On those routes do nothing — the flag stays queued for the next "real" app route (which is exactly where the new-team flow lands: `/roster`).
  - Add a guard so the effect only fires once per pathname change (avoid re-consuming during in-route re-renders).
- Inside the `welcomeOpen` useEffect, treat a present `nba_show_entry_intro_once` flag as equivalent to "WB already seen" — i.e. `setWelcomeOpen(false)` whenever that flag is queued. This guarantees the brand-new-team session never shows the recap, even if `markWelcomeBackSeenThisSession()` is racing.
- Leave the WelcomeBackHero `onEnter` callback as-is: it still calls `setEntryIntroOpen(true)` so returning users continue to see the intro after Enter Court.

### 2. `src/pages/OnboardingPage.tsx`

No changes needed. `handleFinish` keeps setting `nba_show_entry_intro_once` and `markWelcomeBackSeenThisSession()` exactly as today; the RequireAuth changes make those signals behave correctly.

### Out of scope

- `BallersIQEntryIntro`, `WelcomeBackHero`, `TeamPickerPage`, routing, contexts, queries — unchanged.

### Expected behavior

1. Brand-new team finishes draft → lands on `/roster` → rotating-logo intro plays (kept). No Welcome Back recap.
2. Returning user signs in → either goes to `/welcome/pick-team` (multi-team) or sees Welcome Back recap (single-team) → rotating-logo intro never appears here.
3. Returning user taps "Enter Court" on the recap → rotating-logo intro plays (kept).
