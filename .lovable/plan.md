## Root cause

When the user clicks **Create New League** inside the onboarding's Choose Your League step, `ChooseLeagueStep` does:

```ts
navigate("/leagues/create", { state: { returnTo: "/welcome", fromOnboarding: true } });
```

`/leagues/create` is wrapped in `RequireAuth`. In `RequireAuth.tsx`, the **multi-team picker gate** (lines 91–107) already excludes `/leagues/create` via `onCreateLeagueRoute`, but the **Welcome Back gate** right below it (lines 110–139) does NOT. So for a returning user who hasn't yet seen the recap this session, navigating directly to `/leagues/create` triggers `WelcomeBackHero` ("Here's what you missed") before they ever reach the league-builder. After tapping "Enter Court", they then land on `/leagues/create` (because the recap consumes the navigation), creating the wrong-feeling detour the user described.

The post-creation hop back to `/welcome` with `resumeChooseLeague: true` already works correctly — that part isn't broken.

## Fix (one file)

**`src/components/auth/RequireAuth.tsx`** — add `!onCreateLeagueRoute` to the Welcome Back conditional so the recap can never intercept the league-builder route. Same guard pattern that already protects the multi-team picker redirect.

```ts
if (
  !skipOnboardingGate &&
  !onCreateLeagueRoute &&   // NEW
  !forceNewTeam &&
  !resumeChooseLeague &&
  ready &&
  !shouldOnboard &&
  welcomeOpen &&
  user
) { /* WelcomeBackHero */ }
```

No other changes needed. After this:

- d) Create New League → g) `/leagues/create` directly (no Welcome Back detour)
- h) League created → i) back to Choose Your League with the new league preselected (unchanged)
- The Welcome Back recap still appears the first time the user lands on a normal app route in the session.

## Out of scope

No edits to `CreateLeaguePage.tsx`, `OnboardingPage.tsx`, or `ChooseLeagueStep.tsx`. No backend changes.
