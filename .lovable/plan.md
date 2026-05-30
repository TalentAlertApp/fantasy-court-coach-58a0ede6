## Goal

Polish the Ballers.IQ Market Watch + Player Explain experience and the shared Bring In modal, and make "Bring In" reachable directly from a Player Explain search so the user can preview how any player fits the current roster.

---

## 1. Market Watch — Best Swap photos (`MarketWatchStudio.tsx`)

In the BEST SWAP AVAILABLE card, remove the ring/border around both player photos:
- Drop player photo (line ~540): remove `ring-1 ring-rose-300/50`.
- Add player photo (line ~562): remove `ring-1 ring-emerald-300/50`.

Keep size/rounding/object positioning unchanged.

---

## 2. Player Explain — make "Bring In" reachable from search

Today the Bring In CTA only appears inside a generated report and only when the verdict is "ADD". Add a direct path so the user can preview fit for any searched player:

- In `PlayerExplainStudio.tsx`, add a small Crosshair "Bring In" / "Fit my roster" trigger to each row of the search dropdown (next to the FP5 value) and to the report player card. Clicking it sets the target and opens the existing `BringInModal` without requiring a full AI report.
- Reuse the existing `bringInOpen` state + `BringInModal` already wired in the report state; lift that modal so it also renders in the pre-selection/search state, driven by a `bringInTarget` (resolved from the clicked player's `core`).
- In `ExplainReport.tsx`, always render the Bring In button on the player card (not gated to `action === "add"`), so any reported player can be planned.

---

## 3. Player Explain card + Scoring Drivers (`ExplainReport.tsx`)

### 3a. Player card (report hero)
- Import `useLeague`. Apply EuroLeague photo framing like elsewhere: `league === "euroleague" ? "object-top" : "object-[center_15%]"` on the hero photo.
- Remove the small inline team badge shown next to the team name (the little `<img>` logos), keeping the clickable team name → Team modal.
- Promote the existing faint top-right logo into a prominent team-badge watermark: larger size, anchored top-right, with a hover surge (`group-hover:opacity-… group-hover:scale-110 transition-all`). Add `group` to the hero container.

### 3b. Scoring Drivers
- Replace the vertical `divide-y` stacked list with a horizontally scrolling rail: a flex row (`overflow-x-auto`, snap optional) of fixed-min-width driver cards (icon + factor + impact pill + note). Keep the same data and impact styling.

---

## 4. Bring In modal (`BringInModal.tsx`)

### 4a. Header
- Import `useLeague`; apply EuroLeague photo framing to the target photo.
- Remove the current small team badge next to the name; add a large team-badge **watermark** in the header's top-right with hover surge (wrap header in `group`).
- Make the team 3-letter code a button that opens the Team modal.

### 4b. Content links
- Make the target name and the player chips (out/in) clickable to open the corresponding Player modal.
- Render nested `PlayerModal` and `TeamModal` inside `BringInModal`, at a z-index above the modal (it already uses `z-[120]`; nested dialogs must sit above it).

### 4c. Height + staging
- Increase modal height: raise content scroll area from `max-h-[55vh]` to roughly `max-h-[70vh]` (keep `overflow-y-auto` so it stays scrollable) and allow the dialog to grow.
- On "STAGE IN TRADE CENTER": keep the existing `navigate('/transactions?…')` staging, then close the Bring In modal **and** notify the host to close its parent overlay. Add an optional `onStaged` callback prop:
  - `PlayerModal` passes `onStaged` that closes the player modal.
  - `PlayerExplainStudio` and `MarketWatchStudio` pass `onStaged` that calls their existing `onClose` (closes the Ballers.IQ modal), so the staged trade is visible on `/transactions` exactly as it works from the Player modal.

---

## Technical notes

- EuroLeague framing helper already established in `PlayerModal.tsx` (`object-top` vs `object-[center_15%]`); mirror it.
- Team-badge surge-on-hover pattern mirrors existing watermark logos (absolute, negative offsets, `group-hover:scale`/`opacity`).
- Staging already flows through `routeToStageParams` → `/transactions` query params consumed by `PlasyersPage.tsx`; no change to staging logic, only modal/overlay close behavior via the new `onStaged` prop.
- No scoring/cap/FC-BC/max-2-team/GW-cap rule changes; modal still only stages/previews and never commits.

### Files touched
- `src/components/ballers-iq/MarketWatchStudio.tsx`
- `src/components/ballers-iq/PlayerExplainStudio.tsx`
- `src/components/ballers-iq/ExplainReport.tsx`
- `src/components/acquisition/BringInModal.tsx`
- `src/components/PlayerModal.tsx`
