## Goal

After login, any user who already owns **≥1 team** should land on the **Pick Your Team** screen (`/welcome/pick-team`) — which lets them choose an existing team or create a new one. Only true first-run users (0 owned teams) should go to `/welcome` onboarding.

## Current behavior (the bug)

In `src/components/auth/RequireAuth.tsx`:
```ts
if (owned.length >= 2 && !isTeamPickedThisSession()) {
  return <Navigate to="/welcome/pick-team" replace />;
}
```
And in `src/pages/TeamPickerPage.tsx` the auto-bypass:
```ts
} else if (ownedTeams.length === 1) {
  setSelectedTeamId(ownedTeams[0].id);
  markTeamPickedThisSession();
  navigate("/", { replace: true });
}
```

So a returning user with **exactly 1 team** is silently dropped onto `/` (Roster) and never sees a "welcome back / pick or create" screen. They also have no path to create an additional team from a welcoming entry point.

The `WelcomeBackHero` (recap modal) is a separate one-shot session overlay and is fine as-is.

## Fix (2 small edits, frontend only)

### 1. `src/components/auth/RequireAuth.tsx`
Change the picker gate from `>= 2` to `>= 1`:
```ts
if (owned.length >= 1 && !isTeamPickedThisSession()) {
  return <Navigate to="/welcome/pick-team" replace />;
}
```

### 2. `src/pages/TeamPickerPage.tsx`
- Remove the `ownedTeams.length === 1` auto-bypass (keep the `=== 0` redirect to `/welcome`).
- Update the render guard from `ownedTeams.length < 2` to `ownedTeams.length < 1` so single-team users actually see the screen (with their 1 team card + the "New Team" card).

### Result
- 0 teams → `/welcome` (full onboarding) — unchanged.
- 1+ teams → `/welcome/pick-team` shows their team(s) + "New Team" card. Once they pick (or create new), `markTeamPickedThisSession()` prevents redirect loops for the rest of the session.
- `WelcomeBackHero` recap continues to overlay once per session after the pick (unchanged).

## Files to edit
- `src/components/auth/RequireAuth.tsx`
- `src/pages/TeamPickerPage.tsx`

No backend, no schema, no new components.