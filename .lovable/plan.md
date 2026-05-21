## Goal

Play the existing onboarding background bed (`useOnboardingAudio` → `court-show-bed.mp3`) across every onboarding / team-setup / league-setup screen, not only on `WelcomeBackHero` and `OnboardingPage`.

Today it's only mounted on:
- `src/components/welcome-back/WelcomeBackHero.tsx`
- `src/pages/OnboardingPage.tsx`

Missing on:
- `src/pages/TeamPickerPage.tsx` (the "Pick Your Team" screen the user just shared)
- `src/pages/CreateLeaguePage.tsx` (multi-step league builder)

All three already share the same `localStorage` toggle key (`courtshow.audio.enabled`) and the same volume-icon button pattern, so adding the hook + a tiny mute toggle in each header keeps everything in sync.

## Plan

Two files, presentation only.

### 1. `src/pages/TeamPickerPage.tsx`

- Import `useOnboardingAudio` and call `const { enabled: audioEnabled, toggle: toggleAudio } = useOnboardingAudio(true);`
- Add a `Volume2 / VolumeX` toggle button in the top-right header bar next to the existing "Sign out" button, matching the style used in `WelcomeBackHero` (same classes, same `title`/`aria-label`).
- No behavior or routing changes.

### 2. `src/pages/CreateLeaguePage.tsx`

- Same: import `useOnboardingAudio`, call it with `active=true`, add the matching volume toggle button in the page header.
- The audio keeps playing as the user steps through wizard steps 1→7 (single component, single mount = no gaps).

### Continuity note

Each page mounts its own `<Audio>` element, so there is a brief gap on each route change (e.g. picker → WB → onboarding). This already happens between WB and Onboarding today and the user has not flagged it; matching that behavior keeps scope tight. If they later want gapless continuity, we can lift the hook to a shared provider — out of scope for now.

### Out of scope

- `useOnboardingAudio` itself, the mp3 asset, the Court Show audio, RequireAuth, contexts, or any non-onboarding routes.
- Gapless cross-route playback.
