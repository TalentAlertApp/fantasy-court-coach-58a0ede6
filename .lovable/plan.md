

## Onboarding routing & copy fixes

Three small, independent fixes.

### 1. Single-team users land directly on `/` after login

**Already working.** `RequireAuth` only redirects to `/welcome/pick-team` when `owned.length >= 2`. Single-team users bypass it and land on `/`. No code change needed — confirming existing behavior.

### 2. Rename "Pick Your Squad" → "Pick Your Team"

**File**: `src/pages/TeamPickerPage.tsx` (line ~80)

```diff
- Pick <span className="text-accent">Your Squad</span>
+ Pick <span className="text-accent">Your Team</span>
```

Also update the supporting subtitle if it reads "squad" elsewhere on that page (it currently says "Which team will you manage today?" — keep as-is).

### 3. DraftStep: back to picker when applicable

Today, on the onboarding `draft` step, the **Back** button always returns to `NameStep`. For users who already own ≥2 teams (came in via "New Team" on the picker), back should return to `/welcome/pick-team` instead.

**Logic** (in `src/pages/OnboardingPage.tsx`):

```ts
const ownedCount = teams.filter((t: any) => t.owner_id === user?.id).length;

const handleDraftBack = () => {
  // If the user owns ≥2 teams (they reached draft via "New Team" on the picker),
  // back returns to the multi-team picker. Otherwise back goes to NameStep.
  if (ownedCount >= 2) {
    clearOnboardingState(user?.id);
    navigate("/welcome/pick-team", { replace: true });
  } else {
    setStep("name");
  }
};
```

Then wire `<DraftStep onBack={handleDraftBack} />` instead of the inline arrow. The existing back button in `DraftPicker.tsx` already supports `onBack` — no changes there.

Edge case: if `ownedCount >= 2` and the user goes back to the picker, the just-created team will already appear there as a selectable option (the team was created in step 2 and `["teams"]` was invalidated). The user can pick it or any other team without losing the new team.

### Files touched

- `src/pages/TeamPickerPage.tsx` — copy change "Squad" → "Team".
- `src/pages/OnboardingPage.tsx` — new `handleDraftBack` handler with branching logic; pass it to `<DraftStep>`.

### Out of scope

- Renaming step labels inside NameStep / DraftStep ("Name Your Franchise", "Draft Your Squad" titles remain — request was specifically about the picker page).
- Changing the picker's auto-bypass when a user has only 1 team (already correct).

