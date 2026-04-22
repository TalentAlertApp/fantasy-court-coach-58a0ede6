

## Plan: Onboarding polish + roster picker court preview + roster/transactions/schedule/modal upgrades

This is a large bundle. I'll group changes into 7 sections. Each acceptance bullet is independently verifiable.

---

### A · Onboarding Step 3 (DraftPicker) — full‑screen, premium, Back, premium icons

**File: `src/components/onboarding/DraftPicker.tsx`**

1. **Back button (top‑left)** — replace the Back button currently inline with the CTA. Add a top‑left ghost button (mirror of the StepIndicator position) that calls `onBack`. Carries persisted `picks` state through navigation (state already lives in `OnboardingPage` via `createdTeamName`; nothing extra to persist for picks since draft hasn't been saved yet — the user will simply re‑open Step 3 with the same team and start fresh; this matches Steps 1↔2 round‑trip behaviour).
2. **Bottom chip strip yellow text in dark mode** — change chip class from `text-black font-bold` to `text-black dark:text-[hsl(var(--nba-yellow))] font-bold`. Ensure `mt-auto` actually pins them to the bottom of the screen (currently the parent uses `justify-center` which kills `mt-auto`). Restructure the page wrapper to a 3‑row flex column: `[StepIndicator/Back top] · [hero+cards centered grow] · [chips bottom]`.
3. **Replace Trophy icons** with context‑sensitive premium icons:
   - Auto‑Draft CTA → `Wand2` (magic auto)
   - AI Coach CTA → `Sparkles`
   - Manual "Start Picking" → `MousePointerClick`
   - "Pick N More" → `ListPlus`
   - Save valid roster → keep `Check`
4. **Drafting overlay icon** — swap Trophy → `Wand2` to match.
5. **Manual progress strip** — drop the inline pill list (it becomes redundant once the basketball court preview exists in the picker dialog — see section B). Keep only the "+ Add more players" link if `picks.length < 10`.

**File: `src/components/onboarding/DraftStep.tsx`** — already passes `onBack`. No change.

**Acceptance**
- Back button visible top‑left on Step 3, returns to NameStep with previous name preserved.
- In dark theme, the 4 bottom chips on Step 1 (Hero) AND Step 3 render with NBA‑yellow text.
- Bottom chips are pinned to the bottom edge on Step 3, matching Step 1 vertical placement.
- All draft action buttons use the new icon set; no Trophy anywhere in the onboarding flow.

---

### B · PlayerPickerDialog — court preview side panel

**File: `src/components/PlayerPickerDialog.tsx`**

Restructure the dialog into a **two‑column layout** when `showCourtPreview` is true (new prop, defaulted off, opted‑in by `DraftPicker`):

```
┌──────────────────────────────┬──────────────────────────────┐
│  LEFT (existing) — search    │  RIGHT (new) — court panel   │
│  + filters + player list     │  Top counters + 5 FC slots   │
│                              │  + 5 BC slots + remove ✕     │
└──────────────────────────────┴──────────────────────────────┘
```

Right panel spec:
- **Header counters row**: Picked `N/10` · `FC N/5` · `BC N/5` · **Budget**: green `font-bold` if `bankRemaining > 0`, red if `< 0`, neutral when `= 0`.
- **Court image** (reuse `@/assets/court-bg.png`) with the same Starting‑5 formation already used in `RosterCourtView` (top row = up to 5 FC, bottom row = up to 5 BC). Empty slots render the shadcn `Avatar` fallback (initials‑less circle).
- Each filled slot: round photo + small name + small `$X.X` chip + a top‑right `X` button (Trash icon) that calls `onRemovePick(id)` to pop the player and update counters.
- Remove the budget badge from the LEFT header (now lives in the right panel).
- The dialog widens to `max-w-4xl` only in this two‑column mode; single‑column mode (used elsewhere on /transactions etc.) keeps current `max-w-md`.

**Player‑card list change** (per item 10b): replace `FP5: {fp5}` with `FP: {season.fp_pg}` (pulled from the existing `season.fp_pg` field already on `PlayerListItem`).

**Wiring in `DraftPicker.tsx`**: pass `picks`, `onRemovePick`, and `showCourtPreview={true}`.

**Acceptance**
- Opening the manual picker shows the court on the right with empty slots.
- Selecting a player slots them top (FC) or bottom (BC); counters tick; budget colour reflects sign.
- Clicking the X on a slotted player removes them and re‑opens that slot.
- Player list rows show season FP (not FP5).

---

### C · /  My Roster — Court team‑badge, List view alignment + Total FP column

**File: `src/components/PlayerCard.tsx`** (court variant)
- **Remove the watermark** team logo (lines 188‑192 — the centered `opacity-15` overlay).
- Add a **small team badge** in the top‑right corner of the player photo circle: absolute‑positioned `w-7 h-7` logo over the right edge of the round photo, with white ring + shadow.

**File: `src/components/PlayerRow.tsx`** + **`src/components/RosterListView.tsx`**
- **Move team badge** out of its current left position. Render the photo larger (`w-10 h-10` rounded), then below the player name display `TEAM` + small inline `<img>` badge (`w-4 h-4`) right after the tricode.
- **Column alignment**: the FC/BC column inherits default left alignment which causes mismatch with the right‑aligned numeric columns. Add `text-center w-20` to both `<TableHead>` and `<TableCell>` for FC/BC. Apply consistent `w-24` widths on Salary/FP5/Value5/Last FP/Total FP to lock alignment between Starters and Bench tables (both use the same `header` so one edit covers both).
- **New "Total FP" column**: insert a `<TableHead className="text-right">Total FP</TableHead>` after Last FP. In `PlayerRow.tsx` render `{(player.season.fp_pg * player.season.gp).toFixed(0)}` (season FP × GP gives accumulated FP since season start, matching the `mem://logic/performance-stats-aggregation` formula).

**Acceptance**
- Court view: no watermark logo behind player; small team badge sits on the top‑right of the player circle.
- List view: photo is bigger, team badge sits beside the tricode below the name; every column aligns vertically between Starters and Bench; new Total FP column appears after Last FP.

---

### D · /transactions — Trade dropdown, AI Coach, budget counter, chips

**File: `src/pages/PlayersPage.tsx`** (route `/transactions`)

Add a **top toolbar row** above the existing players table:

1. **Trade multi‑select dropdown** ("Players to release") — uses shadcn Popover + Command (similar to `PlayerCombobox` in `AdvancedPage.tsx`). Sourced from current roster (`rosterData.starters + rosterData.bench` resolved via players list). Selecting toggles a player into a `releasing: number[]` state. Cap = `2` unless `chipAllStar` or `chipWildcard` is on (then cap = 10). Selected players appear as removable pills below the dropdown.
2. **Live budget counter** — `availableBudget = (roster.bank_remaining ?? 0) + sum(salary of releasing players) − sum(salary of newly added)`. Render as a green/red bold number in a chip.
3. **Chips: All‑Star, Wildcard** — same visual style as on `/` (`Sparkles`, `RefreshCw`). Toggling raises the release cap.
4. **AI Coach button** (right edge, inline with dropdown) — `Bot` icon, opens the existing `AICoachModal` (`<AICoachModal open={aiCoachOpen} onOpenChange={setAiCoachOpen} />`).
5. The existing players table below stays put (height/position unchanged); pagination already exists.
6. **Add‑to‑roster gating** in the table's existing `Plus` button: disable when `rosterIds.size − releasing.length >= 10`, when `availableBudget < player.salary`, when team count ≥ 2 (existing logic), or when 5 FC / 5 BC of that position already filled (after factoring releases).
7. On confirm ("Apply trades" button next to chips): call `saveRoster` with the new starter/bench arrays (drop released, append picked, fill empty 0s). Use existing `saveMutation` pattern from `RosterPage.tsx`.

**Acceptance**
- Trade dropdown lets the user release up to 2 (or up to 10 with chip), counters update.
- Budget counter recalculates live in green/red bold.
- AI Coach button opens the same modal as on `/`.
- Existing players table position and pagination unchanged.

---

### E · PlayerModal — History at bottom, NBA logo watermark, game click

**File: `src/components/PlayerModal.tsx`**

1. **History tab layout**: wrap the listed games in a `flex flex-col flex-1` container with games rendered inside a `mt-auto` block so the list pins to the bottom of the modal body.
2. **Click → Game Detail**: each game row currently opens via internal `useGameBoxscoreQuery` summary. Wire row `onClick` to open the existing `GameDetailDialog` (already implemented in `ScheduleList.tsx`; extract it to `src/components/GameDetailModal.tsx` so PlayerModal can reuse it). Pass `{game_id, home_team, away_team, home_pts, away_pts, ...}`.
3. **NBA logo watermark**: add an absolutely‑positioned, `pointer-events-none`, `opacity-[0.04]` `<img src={nbaLogo}>` centered in the `DialogContent` — present on every tab (place inside the outer flex container, before the Tabs list).

**Acceptance**
- History tab list always sits at the bottom of the modal regardless of player.
- Clicking a history row opens the Game Detail modal (same one used on /schedule).
- NBA logo is faintly visible behind every tab's content.

---

### F · /schedule Grid view + TOTW + Injury Report card polish

**Schedule grid game cards** (`src/components/ScheduleList.tsx`, grid mode block — to be located around the `viewMode === "grid"` branch):
- **Move action icons strip** (Recap, BoxScore, Charts, PbP, NBA) from below the home team to the very bottom row, inline with the home team venue name. Keeps the same icon component, just relocated to the venue row container.
- **Move team badges to the centre** of the card (instead of far‑left/far‑right). Increase logo size to `w-16 h-16` (from current `w-8`/`w-10`) and add `transition-transform hover:scale-110 drop-shadow-[0_0_18px_hsl(var(--accent)/0.45)]` for the glow. Default state stays in normal team colours (no greyscale).
- **Fix card border clipping** on the top row: parent container has `overflow-hidden` on the row wrapper that crops the outer `border` of cards. Add `pt-1 pb-1 px-1` padding around the row OR remove the outer `overflow-hidden` and apply it only to inner image children.

**TOTW modal** (`src/components/TeamOfTheWeekModal.tsx`):
- The "FP (G)" line under each player (e.g. `78 FP (2G)`) becomes a single soft‑edge container: `rounded-xl px-3 py-1 text-card-foreground bg-[matching‑accent]` with width = `w-[calc(2*chipWidth+gap)]` — i.e. spans the same total width as the FC/BC + $X.XM row above it. Background colour matches the existing accent palette of that card slot (yellow on starters, etc.).

**Injury Report modal** (`src/components/InjuryReportModal.tsx`):
- Reorder a row to: `[OUT pill] [team badge] [player name + pos] ........ [injury type] [date]`.
- Remove the player photo from the row; instead absolute‑position it as a watermark centered in the row (`opacity-[0.06] hover:opacity-[0.16] hover:scale-110 transition` — picks up the existing surge style).

**Acceptance**
- Grid cards: icons under venue at the bottom; large centered team badges with glow on hover; no clipped borders on top row.
- TOTW: the FP/G stat is a single soft pill, width = full row above, matching colour, dark text.
- Injury rows: badge moved left, injury text right‑of‑name‑near‑date, photo as watermark.

---

### G · TeamModal Played tab + Game Detail modal upgrade

**TeamModal** (`src/components/TeamModal.tsx`):
- In the Played tab game list: move the opponent team logo from the far left of the row to right after the `@ XXX` / `vs XXX` text.
- Wrap the score/result button (`W/L` chip and `home–away` score) in a `<button onClick={...}>` that opens the new shared `GameDetailModal` (extracted in section E) for that `game_id`.

**Game Detail modal** (new `src/components/GameDetailModal.tsx`, extracted from `ScheduleList.GameDetailDialog`):
- **If played** (status contains FINAL): keep the score header + 4 action icons currently shown, but **replace the lower body** with the same expandable boxscore table used inside `ScheduleList.GameBoxScore` (Player rows + FC/BC + team filters + sortable columns). Reuse `useGameBoxscoreQuery(gameId)`.
- **If not played**: keep the modal exactly as it is now (header + Watch Recap link disabled, nothing more).

**Acceptance**
- TeamModal Played tab: badge sits beside `vs XXX`; clicking the score opens the Game Detail modal.
- Game Detail modal for finished games: shows the full sortable boxscore table (with FC/BC + team filters), matching the /schedule expandable view.
- Game Detail modal for unplayed games: unchanged from current layout.

---

### Files (summary)

**Edit**
- `src/components/onboarding/DraftPicker.tsx` — Back top‑left, premium icons, dark‑mode chip text colour, mt‑auto fix.
- `src/components/PlayerPickerDialog.tsx` — two‑column court preview with counters & budget, FP (season) instead of FP5.
- `src/components/PlayerCard.tsx` — court variant: drop watermark, add corner team badge.
- `src/components/PlayerRow.tsx` — bigger photo, team badge after tricode, fixed widths, Total FP cell.
- `src/components/RosterListView.tsx` — header gets Total FP column, fixed widths.
- `src/pages/PlayersPage.tsx` — Trade dropdown, chips, budget counter, AI Coach button, add‑to‑roster commit flow.
- `src/components/PlayerModal.tsx` — History at bottom, NBA watermark, click‑to‑open Game Detail.
- `src/components/ScheduleList.tsx` — grid card layout (icons, badges, border fix).
- `src/components/TeamOfTheWeekModal.tsx` — unified soft‑pill FP/G stat.
- `src/components/InjuryReportModal.tsx` — row reorder + photo watermark.
- `src/components/TeamModal.tsx` — Played tab badge move + click‑to‑open Game Detail.

**Create**
- `src/components/GameDetailModal.tsx` — extracted shared modal that shows boxscore table for finished games, lightweight header for unplayed games.

### Acceptance summary

All 15 user requests covered, each verifiable per section above. No DB migrations required — everything is presentational + state.

