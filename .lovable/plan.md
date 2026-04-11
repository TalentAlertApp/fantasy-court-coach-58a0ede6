

## Plan

### 1. Team Modal — Show Tv2 icon for all games, remove NBAGameModal
**File:** `src/components/TeamModal.tsx`

- Show the `Tv2` icon on every played game row, but style it differently: `text-green-500` when `youtube_recap_id` exists, `text-muted-foreground/30` (greyed out, non-clickable) when it doesn't
- Remove the `onClick={() => setSelectedGame(g)}` from the game row div — rows should no longer open the NBAGameModal
- Remove the `selectedGame` state, the `NBAGameModal` import, and the `<NBAGameModal>` render at the bottom
- Keep all the individual icon links (BoxScore, Charts, PbP, NBA.com, Recap) as the primary interaction

### 2. Player Modal History — Add game action icons
**File:** `src/components/PlayerModal.tsx`

- Each history row currently opens a boxscore dialog on click. Add small action icons at the end of each row (after the STL column):
  - `Table2` (BoxScore) — keep the existing click-to-boxscore behavior via this icon
  - `BarChart3` (Charts) — link to `h.game_charts_url`, new tab
  - `Mic` (Play-by-Play) — link to `h.game_playbyplay_url`, new tab
  - `Tv2` (Video Recap) — green when `h.youtube_recap_id` exists, grey otherwise
- Add a new column header "Links" to the table
- The row itself should no longer trigger boxscore on click (move that to the Table2 icon)
- Import `Table2, Mic, ExternalLink, Tv2` from lucide-react

### 3. Teams Page — Remove "remaining" badge
**File:** `src/pages/TeamsPage.tsx`

- Line 166: remove the `<Badge>` showing `{t.gamesRemaining} remaining` — it shows games remaining in the season which isn't meaningful for this context

### 4. Roster Page — Align ROSTER INFO to court bottom, remove Bank/Trans from toolbar
**File:** `src/components/RosterCourtView.tsx`

- Make the right column (bench + roster info) use `flex flex-col` with the column height matching the court height
- Use `flex-1` on the bench section and push ROSTER INFO to the bottom with `mt-auto`
- This ensures the ROSTER INFO card aligns with the bottom of the court

**File:** `src/pages/RosterPage.tsx`

- Remove the `Bank: $...` and `Trans: ...` text from the toolbar row (lines 319-320) since this info is already in ROSTER INFO

### Files Summary

| File | Change |
|------|--------|
| `src/components/TeamModal.tsx` | Show Tv2 on all rows (green/grey), remove NBAGameModal, remove row click |
| `src/components/PlayerModal.tsx` | Add game action icons to history rows, move boxscore trigger to icon |
| `src/pages/TeamsPage.tsx` | Remove "remaining" badge |
| `src/components/RosterCourtView.tsx` | Align ROSTER INFO to bottom of court |
| `src/pages/RosterPage.tsx` | Remove Bank/Trans from toolbar |

