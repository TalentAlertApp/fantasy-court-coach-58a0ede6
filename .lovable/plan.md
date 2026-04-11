

## Plan: Multi-Feature Update (A–F)

### A. Schedule Game Card — Team & FC/BC Filters in Box Score

**File:** `src/components/ScheduleList.tsx`

In the `GameBoxScore` component, add inline filter buttons right after "PLAYER" in the table header:
- Two clickable team badges (away logo + home logo) that filter the box score to only show players from that team
- Two FC/BC toggle buttons that filter by position
- All four filters sit inline in the header row after "Player"
- State: `filterTeam: string | null`, `filterFcBc: string | null` — when set, filter the `sorted` array before rendering

Pass `awayTeam` and `homeTeam` props into `GameBoxScore`.

### B. AI Hub → AI Coach Modal in Roster Header

**Files:** `src/components/layout/AppLayout.tsx`, `src/pages/RosterPage.tsx`, `src/App.tsx`, `src/components/AICoachModal.tsx` (new)

1. Remove the AI Hub nav item from `navItems` in AppLayout
2. Remove the `/ai` route from App.tsx (keep AIHubPage import for the modal content)
3. Create `AICoachModal.tsx` — a Dialog with 5 tabs (Analyze Roster, Best Captain, Suggest Transfers, Injury Monitor, Explain Player), reusing the logic from `AIHubPage.tsx`
4. In `RosterPage.tsx`, add an "AI COACH" button at the far right of the blue header banner (the `bg-primary` div), which opens this modal

### C. Remove AI Coach Card from Roster Sidebar

**File:** `src/components/RosterSidebar.tsx`

- Remove the entire AI Coach collapsible section (the `<div>` with `Bot` icon, suggest moves, captain buttons, and their results)
- Keep only the "Roster Info" card
- The sidebar will be shorter and the Roster Info card moves up naturally

### D. Add "Advanced" Tab

**Files:** `src/components/layout/AppLayout.tsx`, `src/App.tsx`, `src/pages/AdvancedPage.tsx` (new)

- Add a new nav item `{ to: "/advanced", label: "Advanced", icon: Gauge }` after Schedule
- Create a placeholder `AdvancedPage.tsx` with a title and "Coming soon" message
- Add the route in App.tsx

### E. Info Tooltips on Transactions Table Headers

**File:** `src/pages/PlayersPage.tsx`

- Add info icon tooltips to the column headers (PTS, MP, REB, AST, STL, BLK, FP)
- Per Game tab: tooltips explain "Points per game", "Minutes per game", etc.
- Totals tab: tooltips explain "Total points scored this season", etc.
- Use the existing `Tooltip` component from shadcn

### F. Player Modal — Add MPG to Stats + Full Season Stats Toggle

**File:** `src/components/PlayerModal.tsx`

1. **Stats tab**: Add "MPG (season)" and "MPG (L5)" rows to the stats grid — values from `data.player.season.mpg` and `data.player.last5.mpg5`
2. **FP Breakdown card**: Add a toggle (two small buttons: "Last Game" / "Full Season") that switches between:
   - Current "Last Game FP Breakdown" (PTS, REB, AST×2, STL×3, BLK×3, FP from lastGame)
   - "Full Season Stats" showing season per-game averages (PTS, REB, AST, STL, BLK, FP from season data)
   - Default to "Full Season Stats"

### Files Summary

| File | Change |
|------|--------|
| `src/components/ScheduleList.tsx` | Add team/FC/BC filter buttons in box score header |
| `src/components/AICoachModal.tsx` | New — 5-tab AI Coach dialog |
| `src/pages/RosterPage.tsx` | Add AI Coach button in header, remove AI Coach from sidebar dependency |
| `src/components/RosterSidebar.tsx` | Remove AI Coach section |
| `src/components/layout/AppLayout.tsx` | Remove AI Hub nav, add Advanced nav |
| `src/App.tsx` | Remove /ai route, add /advanced route |
| `src/pages/AdvancedPage.tsx` | New placeholder page |
| `src/pages/PlayersPage.tsx` | Add info tooltips to table headers |
| `src/components/PlayerModal.tsx` | Add MPG to stats, add season/last-game toggle on breakdown card |
| `src/components/TopPlayersStrip.tsx` | Add Value layer with vertical FP/Value toggle |

