

## Plan: Fix flash, deletion flow, and unify Step 3 to the light cinematic layout

### Issue 0 · Remove "~60 seconds"
`src/components/onboarding/OnboardingHero.tsx` — change `"3 quick steps · ~60 seconds"` → `"3 quick steps"`.

### Issue 1 · Kill the light→dark flash on `/welcome`
**Cause.** When `/welcome` loads with persisted `step="draft"` but the user already owns a team, `OnboardingPage` paints one frame of the (light-themed) Draft step before the redirect-to-`/` effect fires.

**Fix.** Render-gate `OnboardingPage` until we know we're staying:
```tsx
if (!ready || !shouldOnboard) {
  return <div className="h-screen w-full bg-background" aria-hidden />;
}
```
No headline, no marquee — nothing visible to flash.

### Issue 2 · Deleting a team must send the user back to Step 2 (NameStep)
Reverse my prior proposal. Correct behaviour:

- In `OnboardingPage`'s resume effect, when `step === "draft"` and the saved `createdTeamId` is no longer owned by the user (deleted), do NOT silently re-create. Instead:
  - Clear `createdTeamId` and `createdTeamName` in local state.
  - Persist `{ step: "name" }` (no `teamId`, no `teamName`) via `setOnboardingState`.
  - `setStepRaw("name")` so the user lands on the NameStep ready to choose a fresh name.
- If multiple owned teams exist (edge case where user deleted only one of several), pick the most recent owned team and stay on `"draft"` — only fall back to NameStep when zero owned teams remain.

```tsx
useEffect(() => {
  if (!ready || step !== "draft") return;
  const ownedNow = teams.filter((t: any) => t.owner_id === user?.id);
  const stillOwns = createdTeamId && ownedNow.some((t) => t.id === createdTeamId);
  if (stillOwns) { setSelectedTeamId(createdTeamId!); return; }
  if (ownedNow.length > 0) {
    const fb = ownedNow[ownedNow.length - 1];
    setCreatedTeamId(fb.id); setCreatedTeamName(fb.name);
    setSelectedTeamId(fb.id);
    setOnboardingState(user?.id, { step: "draft", teamId: fb.id, teamName: fb.name });
    return;
  }
  // Zero owned teams → back to NameStep for a fresh franchise name
  setCreatedTeamId(null); setCreatedTeamName("");
  setStepRaw("name");
  setOnboardingState(user?.id, { step: "name" });
}, [ready, step, createdTeamId, teams, user?.id]);
```

### Issue 3 · Step 3 must always render the LIGHT cinematic layout — never the embedded dark variant
Right now `RosterPage` shows the dark `embedded` variant when a team has zero players (image 222). That state should never be reached, but to guarantee it: **collapse the two variants into one canonical Step 3 design (the light cinematic one from `Screenshot_2026-04-21_171006-2.png`)** and always show that.

- `src/components/onboarding/DraftPicker.tsx`: drop the `variant` prop entirely. Single layout = the onboarding (light cinematic) layout: `h-screen` neutral background, 3-dot indicator, `STEP 3 OF 3` eyebrow, big `clamp(2.5rem,8vh,5rem)` heading `Draft <accent>{teamName}</accent>`, subtitle, 3 option cards in `max-w-4xl`, primary CTA, bottom chips pinned `mt-auto`. Add Back ghost button next to CTA (only shown when `onBack` prop is provided).
- `src/components/onboarding/DraftStep.tsx`: render `<DraftPicker teamName={...} onFinish={...} onBack={() => setStep("name")} />`.
- `src/pages/RosterPage.tsx`: when `isRosterEmpty`, render `<DraftPicker teamName={teamName} onFinish={() => refetchRoster()} />` **as a full-bleed overlay** that covers the whole RosterPage body (including hiding the yellow GAMEWEEK banner) so the visual is identical to onboarding Step 3. Wrap in:
  ```tsx
  <div className="fixed inset-0 z-40 bg-background overflow-auto">
    <DraftPicker ... />
  </div>
  ```
  This guarantees a single Step 3 UI everywhere — no second design ever appears.

### Theme note
Both screenshots are correct: the light cinematic look comes from the user's app theme being set to LIGHT. The onboarding components use semantic tokens, so they automatically follow the global theme. No code change to lock theme — request will only ship if explicitly asked.

### Files
- `src/components/onboarding/OnboardingHero.tsx` — remove "~60 seconds".
- `src/pages/OnboardingPage.tsx` — render-gate; deletion → fall back to NameStep (clear name).
- `src/components/onboarding/DraftPicker.tsx` — remove `variant`, single cinematic layout, optional Back button.
- `src/components/onboarding/DraftStep.tsx` — pass `onBack` to picker.
- `src/pages/RosterPage.tsx` — render `DraftPicker` as full-bleed overlay when roster is empty.

### Acceptance
- Hero microcopy: `3 quick steps` (no seconds).
- `/welcome` never shows a one-frame flash before redirecting to `/`.
- Deleting the team while on Step 3 returns the user to Step 2 (NameStep) with an empty name field, ready for a fresh franchise name.
- Step 3 looks **exactly** like `Screenshot_2026-04-21_171006-2.png` everywhere — onboarding flow and any zero-roster state on `/`. The dark embedded layout (image 222) is gone.

