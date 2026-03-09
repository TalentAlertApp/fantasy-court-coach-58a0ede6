

## Roster Page Redesign + Gameweek/Deadline Logic

This is a large layout overhaul of `/roster` to match the reference image, plus importing the schedule CSV and computing the correct current Gameweek/Day/Deadline.

### Overview of Changes

**A. Import the schedule CSV** into `schedule_games` via the existing `import-game-data` edge function (the CSV has games from GW20.7 onwards with no player stats — just schedule rows).

**B. Add a static deadline lookup** as a new file `src/lib/deadlines.ts` containing all ~170 deadline entries (GW1-Day1 through GW25-Day6) with their UTC datetime strings derived from the user-provided table. Each entry: `{ gw, day, deadline_utc }`.

**C. Compute current GW/Day** client-side: find the next deadline that hasn't passed yet (based on `new Date()`). That tells us the current gameweek and day. Also display the deadline datetime.

**D. Redesign RosterPage layout** to match the reference image:

```text
┌─────────────────────────────────────────────────┐
│  MY TEAM (red label)                            │
│  GAMEWEEK 21 — DAY 1  (bold white)              │
│  ⏰ Deadline: Mon 9 Mar 22:30                   │
│  (full-width nba-blue/navy banner)              │
├────────────────────────────┬────────────────────┤
│ [Court View] [List View]   │                    │
│ FC:2 BC:3 Bank:$X Trans:2  │                    │
│ ───────────────────────     │   AI COACH card   │
│ ⚠ STARTING 5   hint text   │   - Suggest Moves │
│ ┌─────────────────────┐    │   - Best Captain  │
│ │  Court / List view   │    │                    │
│ └─────────────────────┘    │   ROSTER INFO card │
│ 👤 BENCH   5 substitutes   │   - Bank Remaining │
│ ┌─────────────────────┐    │   - Free Transfers │
│ │  Bench cards         │    │   - FC/BC Starters │
│ └─────────────────────┘    │   - Total Starters │
├────────────────────────────┴────────────────────┤
│ CAPTAIN: [dropdown] │ ▶ PLAY  │ GAMEDAYS: 7     │
└─────────────────────────────────────────────────┘
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/lib/deadlines.ts` | **NEW** — Static array of all GW/Day deadlines with UTC datetimes; helper `getCurrentGameday()` that returns `{ gw, day, deadline_utc }` |
| `src/pages/RosterPage.tsx` | Full layout redesign: blue header banner, two-column layout (main + sidebar), section bars for Starting 5 / Bench, bottom action bar with captain/play/gamedays remaining |
| `src/components/KpiTiles.tsx` | Remove (replaced by header banner + toolbar row + sidebar info) |
| `src/components/BottomActionBar.tsx` | Redesign: 3-section bar — captain dropdown (red bg), PLAY button (yellow bg), gamedays remaining (navy bg with count badge) |
| `src/components/RosterCourtView.tsx` | Update section bars: "STARTING 5" with warning icon + "Drag players..." hint on right; "BENCH" with person icon + "5 substitutes" on right; add empty slot placeholders styled as dashed court positions |
| `src/components/RosterSidebar.tsx` | **NEW** — Right sidebar with collapsible AI Coach card (Suggest 3 Moves, Best Captain Today buttons) and Roster Info card (Bank, Transfers, FC/BC starters, totals) |
| `supabase/functions/import-game-data/index.ts` | Minor: ensure schedule-only rows (no player data) still insert into `schedule_games` |

### Deadline Data

The deadline times from the user's table will be stored as UTC ISO strings. For example:
- Gameweek 21 Day 1 → `2026-03-09T22:30:00+00:00`
- Gameweek 21 Day 2 → `2026-03-10T22:30:00+00:00`

The year for all entries is inferred from the season (2025-2026): Oct-Dec = 2025, Jan-Apr = 2026.

`getCurrentGameday()` logic:
1. Get current UTC time
2. Find the first deadline entry where `deadline_utc > now`
3. That entry's `gw` and `day` = current gameday
4. If all deadlines have passed, return the last one

### Gamedays Remaining

Count how many unique days remain in the current gameweek (from the deadlines array) where `deadline_utc > now`.

### AI Coach Sidebar

The sidebar AI Coach card will reuse the existing `aiSuggestTransfers` and `aiPickCaptain` API calls from `AIHubPage.tsx`, simplified into two buttons that trigger those calls and show results in a toast or inline panel.

### Bottom Action Bar

Three sections matching the reference:
1. **Left (red bg)**: "GAMEDAY CAPTAIN" label + captain dropdown
2. **Center (yellow bg)**: "▶ PLAY" button (saves lineup)
3. **Right (navy bg)**: "GAMEDAYS REMAINING" + count badge

