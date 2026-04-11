

## Plan

### 1. Standings — Fit Conference & Division without scrolling

**File:** `src/components/standings/StandingsTable.tsx`

Add a `compact` prop. When `true`, show only core columns: #, Team, GP, W, L, PCT, GB, HOME, AWAY. Hide CONF, DIV, PPG, OPP, DIFF, L10, STRK to fit within viewport.

**File:** `src/components/standings/StandingsPanel.tsx`

Pass `compact` to `StandingsTable` when `view === "conference"` or `view === "division"`. League view keeps all columns.

### 2. Box Score — Red $ and V headers/values

**File:** `src/components/ScheduleList.tsx`

- Change `highlight` color from `text-amber-400` to `text-red-500 font-bold` on the `$` and `V` header buttons
- Add `text-red-500` (no bold) to the salary and value data cells in the player rows

### 3a. Roster — Remove Gameday Captain from bottom bar

**File:** `src/components/BottomActionBar.tsx`

Remove the entire left section (the red `bg-destructive` div with the captain selector). Keep only the center "Play" button and the right "Gamedays Remaining" section.

### 3b. Roster — Basketball court layout for Starting 5

**Asset:** Copy `user-uploads://NBApitch.png` to `src/assets/court-bg.png`

**File:** `src/components/RosterCourtView.tsx`

Replace the current horizontal grid layout with a two-column layout:

- **Left column (Starting 5):** A portrait basketball court using the uploaded image as background. Players positioned absolutely on the court in a basketball formation: 2 players near the baseline (guards/BC) and 3 near midcourt/paint (forwards/FC) — or 3BC+2FC, respecting actual roster composition. Each player rendered as a compact card (photo + name + FC/BC badge). Drag-and-drop and swap button still work.

- **Right column (Bench):** 5 player cards stacked vertically in a column beside the court.

The court container will be `aspect-[3/5]` with `position: relative` and the background image set via CSS. Player cards are positioned using `absolute` with percentage-based coordinates for the 5 formation spots.

All existing interactions preserved: drag-and-drop between any two players (starter-to-starter, bench-to-bench, starter-to-bench), click to open PlayerModal, swap button to open PlayerPickerDialog.

### Files Summary

| File | Change |
|------|--------|
| `src/components/standings/StandingsTable.tsx` | Add `compact` prop to hide extra columns |
| `src/components/standings/StandingsPanel.tsx` | Pass `compact` for conference/division views |
| `src/components/ScheduleList.tsx` | Red color for $ and V headers and values |
| `src/components/BottomActionBar.tsx` | Remove captain selector section |
| `src/components/RosterCourtView.tsx` | Basketball court layout with portrait image + bench on right |
| `src/assets/court-bg.png` | Copy uploaded court image |

