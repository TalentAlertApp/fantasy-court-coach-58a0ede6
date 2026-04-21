

## Plan: Unify the empty-roster UX, wire all 3 draft options to actually create rosters, document theming

### 1 · Make the "Choose your draft style" card the canonical empty-roster screen

**Problem.** Today there are two different "you have no players" experiences:
- **`/` (RosterPage empty-state)** — old card with two buttons: `AUTO-PICK ROSTER` and `ADD PLAYERS MANUALLY` (image 218).
- **`/welcome` Step 3** — new premium 3-card picker: Auto-Draft / Manual / AI Coach (image 217).

Whenever the active team has zero players (whether the user just created it via `/welcome` OR they already had `BUCKETS INC.` from a previous session), they should see the **same** premium 3-card picker. The `/` page should not have its own divergent empty-state.

**Implementation.**
- Extract the `<DraftStep>` body (the three option cards + progress strip + manual picker + AI coach handoff + auto-pick logic) into a shared component `src/components/onboarding/DraftPicker.tsx`. It accepts:
  - `teamName: string`
  - `onFinish: () => void` (defaults to a no-op refetch)
  - `variant: "onboarding" | "embedded"` — controls whether it renders the step-indicator dot strip + "Step 3 of 3" eyebrow + outer `h-screen` wrapper (onboarding) or just the inner content sized to fill its parent (embedded).
- `DraftStep.tsx` becomes a thin wrapper that renders `<DraftPicker variant="onboarding" teamName={...} onFinish={...} />`.
- `RosterPage.tsx` empty-state branch (`isRosterEmpty`) is replaced with `<DraftPicker variant="embedded" teamName={teamName} onFinish={() => refetchRoster()} />`. The big yellow `GAMEWEEK X — DAY Y` header at the top of the page stays — the picker takes over the body region only.
- Remove the old empty-state card markup (NBA logo + 2 buttons) entirely so there is exactly one design.

**Result.** Whether the user arrives via `/welcome` (first run) or hits `/` with an existing-but-empty team like `BUCKETS INC.`, they see the identical 3-card drafting picker.

### 2 · Make all 3 draft options actually create the roster

The Auto-Draft path already calls the rewritten `roster-auto-pick` edge function. The Manual path already calls `saveRoster`. The AI Coach path is currently broken — clicking "Open AI Coach" opens the modal, but on close `handoff()` runs unconditionally and routes the user to `/` regardless of whether they actually created a roster.

**Wire AI Coach correctly.**
- `AICoachModal` already exposes the **Transfers** tab with `commitTransaction()` and the **Captain** tab with `saveRoster()` — both write to the active team. But for a brand-new empty team, "Transfers" is meaningless because there is no roster yet. Add a new lightweight first-class action specifically for drafting from empty:
  - In `AICoachModal`, detect when `rosterData?.roster?.starters` is all zeros (empty roster). When empty, show a banner at the top of the modal: "No roster yet — let me build one for you" with a single primary button **"Draft my squad with AI"**.
  - That button calls a new helper `aiDraftRoster({ gw, day, style })` (the user's free-text style is already collected via the existing AI prompt input on the Analyze tab — reuse it, default to "balanced"). The helper hits a new edge function action OR — to avoid a new function — calls `aiSuggestTransfers` with a special `objective: "draft_from_empty"` flag and then commits each suggested move.
  - Simpler path that needs no backend changes: the button calls `autoPickRoster({ gw, day, strategy: "value5" }, teamId)` (deterministic auto-draft) AND then immediately runs `aiPickCaptain` to pick the captain. Then closes the modal and triggers `onFinish()`.
- In `DraftStep` / `DraftPicker`: when strategy = `"ai"`, do **not** auto-handoff on modal close. Instead, after the modal closes, refetch `roster-current` and only call `onFinish()` when at least one starter > 0. Otherwise leave the user on the picker so they can try again or switch strategy.

**Verify the other two paths** (already in place — just confirming no regression):
- Auto-Draft → `autoPickRoster()` → edge function writes 10 rows to `roster` table → `handoff()` invalidates queries → router replaces to `/`.
- Manual → user picks 10 valid players → `saveRoster()` → same handoff.

**Acceptance check.** From an empty roster (either fresh team or zero-player legacy team), each of the three options ends with a populated roster on `/`:

```text
[Auto-Draft]   click → spinner → roster shows 10 players, captain set
[Manual]       click → picker dialog × 10 → progress strip 10/10 → save → roster shows 10 players
[AI Coach]     click → modal banner "Draft my squad with AI" → click → spinner → modal closes → roster shows 10 players + AI-picked captain
```

### 3 · Theme answer (no code change needed unless requested)

The two-tone screenshots the user is seeing (light/white version in image 217, dark version in image 219) **are** driven by the app's global light/dark theme toggle in the sidebar (the `LIGHT` / dark switch visible at the bottom-left of image 218). The onboarding components use semantic Tailwind tokens (`bg-background`, `text-foreground`, `text-accent`, `border-foreground/10`, etc.) defined in `src/index.css` — they are not hardcoded to either theme. So:
- The light-mode screenshot in image 217 is what you see when the app is in `light` mode.
- The dark-mode screenshot in image 219 is what you see when the app is in `dark` mode (default).

Both renders are correct and intentional. **No change required** unless you want the onboarding flow to lock to dark for a more cinematic feel — say the word and we'll add `<html className="dark">` only on `/welcome`.

### Files

**Create**
- `src/components/onboarding/DraftPicker.tsx` (extracted shared component, `variant` prop)

**Edit**
- `src/components/onboarding/DraftStep.tsx` → thin wrapper around `DraftPicker`
- `src/pages/RosterPage.tsx` → replace `isRosterEmpty` branch with `<DraftPicker variant="embedded" />`, drop old empty-state markup and the unused `handleAutoPick` button block
- `src/components/AICoachModal.tsx` → add empty-roster banner + "Draft my squad with AI" action that calls `autoPickRoster` + `aiPickCaptain`, plus an `onDraftComplete?: () => void` callback so the picker can detect success

### Acceptance

- Logging in as a user whose only team is empty (e.g. `BUCKETS INC.`) shows the **same 3-card picker** at `/` as `/welcome` Step 3.
- Auto-Draft, Manual, and AI Coach **all** end with 10 real players on the roster and route to the populated `/` court view.
- The yellow gameweek banner at the top of `/` is preserved when the picker is embedded.
- The AI Coach modal, when opened from an empty roster, surfaces the new "Draft my squad with AI" CTA at the top.
- Light/dark behaviour is confirmed as intended; no theme code changes ship unless explicitly requested.

