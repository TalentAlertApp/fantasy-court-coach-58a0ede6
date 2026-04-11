

## Plan

### 1. Player Modal — Fix scrollbar hiding table content
**File:** `src/components/PlayerModal.tsx`

The History tab table columns are being clipped by the ScrollArea scrollbar on the right. Fix by adding right padding to the table container inside the ScrollArea so the last column (`S` / STL) isn't hidden behind the scrollbar. Add `pr-3` to the table wrapper or reduce column widths slightly. The simplest fix: wrap the `<Table>` in a `<div className="pr-4">` inside the ScrollArea to give space for the scrollbar.

### 2. Team Modal — Add game action icons to played game rows
**File:** `src/components/TeamModal.tsx`

Currently only shows a `Table2` (BoxScore) icon. Add icons for:
- **Charts** (`BarChart3`) — links to `game_charts_url`, opens in new tab
- **Play-by-Play** (`Mic`) — links to `game_playbyplay_url`, opens in new tab  
- **Game URL** (`ExternalLink`) — links to `nba_game_url`, opens in new tab
- **YouTube Recap** (`Youtube` or `Tv2`) — shown in **green** only when `youtube_recap_id` exists. On click, instead of opening a new tab, expand an inline YouTube embed (`iframe`) below the game row using `https://www.youtube.com/embed/{youtube_recap_id}`

Implementation:
- Add state `expandedRecap: string | null` tracking which game_id has its recap expanded
- Each game row gets the additional icons after the existing BoxScore icon (all with `e.stopPropagation()` to not trigger the NBAGameModal)
- The YouTube recap icon uses `Tv2` with `text-green-500` coloring when `youtube_recap_id` is present, hidden otherwise
- Clicking the recap icon toggles `expandedRecap` to that game_id
- Below the game row, conditionally render a `<div>` with an embedded YouTube iframe (16:9 aspect ratio, ~full width of the list)
- Import `BarChart3`, `Mic`, `ExternalLink`, `Tv2` from lucide-react

### Files Summary

| File | Change |
|------|--------|
| `src/components/PlayerModal.tsx` | Add `pr-4` padding inside ScrollArea for History and Schedule tabs |
| `src/components/TeamModal.tsx` | Add Charts, Play-by-Play, Game URL, YouTube Recap icons to played game rows; inline YouTube embed on recap click |

