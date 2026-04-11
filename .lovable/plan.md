

## Plan

### 1. Court layout: FC at top, BC at bottom; bench below court

**File:** `src/components/RosterCourtView.tsx`

- Swap FC/BC positions: FC rows use `top: "28%"` (near basket/top), BC rows use `top: "72%"` (bottom/perimeter)
- Move bench from right column to below the court — change from `flex-row` to `flex-col` layout
- Bench rendered as a horizontal row of 5 cards (same size as court cards) below the court
- Remove the `lg:w-[200px]` sidebar layout; bench becomes `grid grid-cols-5 gap-2` below the court
- Court width can now span wider since bench is below, not beside it

### 2. Rounded edges on all player cards

**File:** `src/components/PlayerCard.tsx`

- Replace all `rounded-sm` with `rounded-lg` on the outer card container (both compact and non-compact variants)
- Replace `rounded-sm` on inner elements (badges, buttons) with `rounded-md`
- This applies to both Starting 5 (court) and Bench cards

### 3. Bench cards same size as court cards

**File:** `src/components/PlayerCard.tsx`

- Remove the separate non-compact variant entirely — use the same compact layout for both court and bench
- Both use identical sizing (photo, text, badges, upcoming section)

**File:** `src/components/RosterCourtView.tsx`

- Pass `compact={true}` to all cards (starters and bench)
- Bench cards displayed in a horizontal grid-cols-5 row below the court

### 4. Box score column alignment fix

**File:** `src/components/ScheduleList.tsx`

The header has `overflowY: "scroll"` with `scrollbarGutter: "stable"` but the scrollbar gutter may not match between header and body. Fix by:
- Remove `overflowY: "scroll"` from the header div (it doesn't scroll)
- Add `paddingRight` to the header equal to the scrollbar width, or use `overflow-y: overlay` on the data container
- Simplest fix: add `overflow-y: hidden` on header and keep `scrollbar-gutter: stable` on both — ensuring the gutter space is consistent

### 5. Playing Time Trends on /advanced

**New file:** `src/pages/AdvancedPage.tsx` — complete rewrite

- Fetch data from Supabase: query `player_game_logs` joined with `players` table
- For "last 7 days": get games where `game_date >= (today - 7 days)`, compute per-player avg MP
- For "season avg": use `players.mpg` field (already stored)
- Compute delta = last7avg - seasonAvg
- Split into two lists: positive delta (increased) and negative delta (decreased)
- Sort increased descending by delta, decreased descending by absolute delta

Layout: two side-by-side panels (grid-cols-2 on desktop, stacked on mobile)

Each table columns: PLAYER (photo + name + team badge) | GP | SEASON AVG | PAST 7 DAYS | INCREASE or DECREASE

- "Last updated" timestamp shown at top
- Dark theme styling matching existing app
- Compact rows with alternating background

**New hook:** `src/hooks/usePlayingTimeTrends.ts`

Queries Supabase directly:
```sql
SELECT p.id, p.name, p.team, p.photo, p.mpg as season_avg,
       COUNT(pgl.id) as gp_7d,
       AVG(pgl.mp) as avg_7d
FROM players p
JOIN player_game_logs pgl ON pgl.player_id = p.id
JOIN games g ON g.game_id = pgl.game_id
WHERE g.game_date >= current_date - 7
  AND pgl.mp > 0
GROUP BY p.id, p.name, p.team, p.photo, p.mpg
```

Returns `{ increased: TrendRow[], decreased: TrendRow[], updatedAt: string }`.

### Files Summary

| File | Change |
|------|--------|
| `src/components/RosterCourtView.tsx` | FC top / BC bottom; bench below court as horizontal row |
| `src/components/PlayerCard.tsx` | Rounded edges (`rounded-lg`); unify compact/bench sizing |
| `src/components/ScheduleList.tsx` | Fix header/data scrollbar alignment |
| `src/hooks/usePlayingTimeTrends.ts` | New — fetch playing time trend data |
| `src/pages/AdvancedPage.tsx` | Rewrite — Playing Time Trends with two side-by-side tables |

