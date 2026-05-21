## Goal
Polish the multi-team picker (`/welcome/pick-team`) and fix the "New Team" routing so a returning user with multiple teams can pick, scroll, or create another team cleanly.

## Changes

### 1. `src/pages/TeamPickerPage.tsx` — Premium layout + scroll + username
- Replace the fixed-height (`h-screen ... overflow-hidden`) shell with `min-h-screen` and natural vertical scroll so users with many teams can scroll the list.
- Add the user identity to the header: keep the `WELCOME BACK` eyebrow, then render `Pick Your Team` and **append the user's display name / email handle** (e.g. `WELCOME BACK · {name}`), styled like the existing "WELCOME BACK · WNBA TA" eyebrow on the recap screen.
  - Source: `user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split("@")[0]`.
- Shrink and premium-ify the team cards:
  - Smaller card (`h-32`, tighter padding `p-4`, grid `minmax(180px, 1fr)`), denser typography.
  - Replace the generic `Shield` icon block with the **league logo** (NBA/WNBA) rendered as a small badge top-left (matches the left-rail pill style used elsewhere).
  - Keep the watermarked league logo top-right but soften (`opacity-[0.12]`, no blur), with a subtle hover surge (`group-hover:opacity-25 group-hover:scale-105`).
  - Add a thin accent underline on hover, refined border (`border-foreground/8`), gradient inner shadow (`bg-gradient-to-br from-foreground/[0.03] to-transparent`), and a small chevron on hover to telegraph the click.
  - Show a secondary meta row under the name: league code (NBA/WNBA) in small uppercase tracked text.
- Keep the "New Team" tile in the same grid but visually quieter (dashed border, same height).
- Wrap content in a centered container with `py-12` and inner `max-w-6xl` so the list scrolls within page flow.

### 2. `src/pages/TeamPickerPage.tsx` — Fix "New Team" routing
- Change `handleCreateNew` to navigate to `/welcome` with explicit state: `navigate("/welcome", { state: { forceNewTeam: true } })` (do **not** mark team-picked-this-session, so other guards still behave correctly when the user cancels).

### 3. `src/components/auth/RequireAuth.tsx` — Skip welcome-back hero when forcing new team
- Read `location.state?.forceNewTeam`. When true:
  - Skip the multi-team picker redirect (don't bounce back to `/welcome/pick-team`).
  - Skip the `WelcomeBackHero` one-shot (the user already saw the picker and explicitly chose to create another team).

### 4. `src/pages/OnboardingPage.tsx` — Honor `forceNewTeam` and jump straight to NameStep
- Read `navState.forceNewTeam`.
- When true:
  - Bypass the `if (ready && !shouldOnboard && !preselectedLeagueId) navigate("/")` guard (currently bounces returning users back to `/`).
  - Initialize `step` to `"name"` instead of `"hero"` (skip the OnboardingHero "Draft Your Squad" splash — user is an existing user adding another franchise).
  - Clear any stale persisted onboarding state for this user before initializing so we don't resume into a stranded `draft` step from a prior session.

## Out of scope
- No edge-function changes.
- No changes to the welcome-back recap content or the NameStep itself beyond entry routing.

## Files to edit
- `src/pages/TeamPickerPage.tsx`
- `src/components/auth/RequireAuth.tsx`
- `src/pages/OnboardingPage.tsx`
