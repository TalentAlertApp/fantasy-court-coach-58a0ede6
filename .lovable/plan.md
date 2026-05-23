## Plan

### 1. EuroLeague player photo alignment (remaining surfaces)

Add `object-top` to the photo `<img>` tags that were missed in the prior pass so EuroLeague full-body shots show the face:

- `src/pages/ScoringPage.tsx`
  - Line 945: STARTING 5 strip avatar (`w-10 h-10 rounded-full object-cover`)
  - Line 1006: YOUR TEAM table row avatar (`w-9 h-9 rounded-full object-cover`)
  - Line 1235: TX PULSE row avatar (`w-9 h-9 rounded-full object-cover`)
- `src/components/court-show/CourtShowSlide.tsx`
  - Line 109: Outstanding Performances / Best Value Plays podium photo (`isFirst ? h-32/h-40 : h-20/h-24`)
  - Line 598: Played Games Recap small player row photo (`h-5 w-5`)
  - Line 1079 + 1156: top/secondary performer avatars in recap-style blocks (`h-9 w-9`)

Apply universally (not gated by league) — `object-top` is safe for NBA/WNBA head-shots too.

### 2. Remove duplicate Sergio Llull

There are two rows in `players`:
- `700966295` — keep (matches the sheet, has live stats)
- `700982991` — delete (stale duplicate, same EuroLeague profile URL)

Migration steps:
- Re-point any FK references from `700982991` → `700966295` in dependent tables (rosters, player_game_logs, transactions, wishlist, captains, etc. — discover via `information_schema` lookups before deleting).
- `DELETE FROM players WHERE id = 700982991`.

### 3. Daily Court Show — Ballers.IQ slide watermark

`src/components/court-show/CourtShowSlide.tsx` line 1206: `biqWatermark` currently points to `/brand/ballers-iq-league-watermark.png` (NBA-flavoured asset). Replace the BIQ watermark image with the active league logo (`getLeagueLogo(leagueCode)`) keeping the existing position / opacity / blur classes so the visual treatment is identical to the recap/outstanding slide watermark.

### 4. Name Your Franchise — "ONGOING" badge + EuroLeague logo polish

In `src/components/LeaguePickerCards.tsx`:

- **ONGOING badge** (the `STATUS_BADGE.wnba` block, currently `absolute top-2 right-2`):
  - Reposition to `top-3 left-1/2 -translate-x-1/2` so it centers across the card width.
  - Upgrade styling: thinner pill, subtle glass background, red dot + red text in light theme (use `text-red-600 dark:text-destructive-foreground`, `border-red-500/70`, `bg-white/85 dark:bg-background/70`), tighter tracking, drop shadow for premium feel. Keep ping animation.
- **EuroLeague logo size / vertical centering**:
  - The card uses `BOX_SCALE.euroleague = 1` and `TRANSFORM_SCALE.euroleague = 1.45`. Bump transform scale to ~`1.7` and add a small negative `translateY` (e.g. `translateY(-6px)`) so the rendered glyph grows and shifts up to sit visually centered above the "EUROLEAGUE" label without disturbing the layout box (name stays aligned with NBA/WNBA).

### Technical notes

- No edge function changes.
- Single migration for step 2; needs FK discovery before delete.
- All other edits are presentation-only TSX changes.

### Files to touch

- `src/pages/ScoringPage.tsx`
- `src/components/court-show/CourtShowSlide.tsx`
- `src/components/LeaguePickerCards.tsx`
- One new migration under `supabase/migrations/`
