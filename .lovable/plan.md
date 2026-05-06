## 1) GameDetailModal — shorter header

`src/components/GameDetailModal.tsx`
- Outer wrapper `p-4` → `px-4 pt-3 pb-2`.
- Drop the title row entirely (keep `DialogTitle` as `sr-only` for a11y) — the matchup line below is enough.
- Team rows `h-16` → `h-12`; team-name text `text-base` → `text-sm`; watermark `h-20 w-20` → `h-16 w-16`.
- Score `text-2xl` → `text-xl`; outer matchup `py-3` → `py-1.5`.
- Action chips: `py-1` → `py-0.5`, gap `gap-2` → `gap-1.5`. Recap link `py-1.5` → `py-1`, `pt-1` wrapper → `pt-0.5`.

## 2) TeamCompareModal — wire team name + badge → TeamModal

`src/components/TeamCompareModal.tsx`
- Add internal state `const [openTricode, setOpenTricode] = useState<string | null>(null)`.
- In `TeamHeader`, wrap the badge container and team-name in a single `<button>` that calls `onOpen(tricode)` (new prop). Add hover styling (cursor-pointer, hover:opacity-90).
- At the bottom, render `<TeamModal tricode={openTricode} open={!!openTricode} onOpenChange={(o)=>!o && setOpenTricode(null)} />` (lazy import to avoid cycles if needed).
- Keep the existing GameDetailModal mount.

## 3) Roster opponent slots

### 3a) Pop-out hover effect

`src/components/PlayerCard.tsx` (`OpponentSlot`) and the inline slot in `src/components/PlayerRow.tsx`:
- Outer round container: add `overflow-visible relative group/slot` and remove the existing `hover:scale-110` on the wrapper.
- Inner `<img>` logo: `transition-transform duration-200 group-hover/slot:scale-[1.9] group-hover/slot:-translate-y-0.5 group-hover/slot:drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] group-hover/slot:z-30 origin-center`.
- Add `relative z-10` on the slot so the popped logo floats above sibling slots.

### 3b) Click slot → open GameDetailModal

Plumb a `gameId` (and a few schedule fields) down so the roster can render `GameDetailModal`.

`src/hooks/useUpcomingByTeam.ts`
- Extend select to: `game_id, home_team, away_team, home_pts, away_pts, status, tipoff_utc, game_boxscore_url, game_charts_url, game_playbyplay_url, game_recap_url, nba_game_url`.
- Add those fields onto `UpcomingGame` (all optional except `game_id`). Both `getTeamUpcoming` and `getTeamGameweekSlots` already pass through whole `UpcomingGame`s — no signature change needed.

`src/pages/RosterPage.tsx`
- Add `const [gameDetail, setGameDetail] = useState<GameDetailGame | null>(null);`
- Pass `onSlotClick={(g) => setGameDetail({...})}` to both `RosterCourtView` and `RosterListView`.
- Mount `<GameDetailModal game={gameDetail} open={!!gameDetail} onOpenChange={(o)=>!o && setGameDetail(null)} />`.

`src/components/RosterCourtView.tsx` and `RosterListView.tsx`
- Add `onSlotClick?: (g: UpcomingGame) => void` prop and forward to `PlayerCard` / `PlayerRow`.

`src/components/PlayerCard.tsx` and `PlayerRow.tsx`
- Add `onSlotClick` prop. In each populated `OpponentSlot`/inline slot, wrap with `<button onClick={(e) => { e.stopPropagation(); day && onSlotClick?.(day); }}>` so the row click handler is not triggered. Empty slots stay non-interactive.

## 4) ScoringPage — picker fits 10 with no scroll

`src/pages/ScoringPage.tsx` (lines ~628–690)
- Make rows leaner: photo `w-9 h-9` → `w-7 h-7`, ring padding `p-[1.5px]` → `p-[1px]`, row padding `px-2.5 py-1.5` → `px-2 py-1`, gap `gap-2.5` → `gap-2`, watermark `h-12 w-12` → `h-10 w-10`.
- Replace `max-h-[480px] overflow-y-auto` with `space-y-1`. Remove `overflow-y-auto` so popover sizes to content.
- Cap visible players to 10 deterministically: `allPlayersInRoster.slice(0, 10)` only when not selected; or simpler, leave full list since roster is ≤10.

## Files

- `src/components/GameDetailModal.tsx` (header trim)
- `src/components/TeamCompareModal.tsx` (team-name → TeamModal)
- `src/hooks/useUpcomingByTeam.ts` (carry game_id + scoring/url fields)
- `src/pages/RosterPage.tsx` (mount GameDetailModal + pass `onSlotClick`)
- `src/components/RosterCourtView.tsx`, `src/components/RosterListView.tsx` (forward `onSlotClick`)
- `src/components/PlayerCard.tsx`, `src/components/PlayerRow.tsx` (slot pop-out + click handler)
- `src/pages/ScoringPage.tsx` (compact picker)

No DB or schema changes; no new dependencies.
