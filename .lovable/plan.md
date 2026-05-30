## 1) Pick-Team cards: premium league-colored borders

**File:** `src/pages/TeamPickerPage.tsx`

Each existing team card currently uses a neutral `border-foreground/10`. Add a per-league accent border color while leaving the hover state (`hover:border-accent/70` + glow) untouched.

- Add a small helper mapping `league_code` → a Tailwind border color class (resting state only):
  - NBA → blue (`border-[#1d428a]/45`)
  - WNBA → orange (`border-[#f57b20]/50`)
  - EuroLeague → red/orange (`border-[#e2231a]/45`)
  - fallback → current `border-foreground/10`
- Apply that class on each owned-team card in place of the static `border-foreground/10`. Because Tailwind emits `hover:` variants after base utilities, the existing `hover:border-accent/70` keeps overriding on hover, so the current hover color/effect is preserved exactly.
- The "New Team" card keeps its dashed neutral style (unchanged).

## 2) Game Recaps: LAST-game logos that do nothing

**File:** `src/components/schedule/GameRecapsModal.tsx`

**Root cause:** the LAST/NEXT rail (`GameTeamsFormRail`) lists each team's last played games across the **whole season**, but `handleSelectPlayed` only resolves a clicked game against the **currently loaded gameweek** (`playedGames` for the current day and `weekGames` for the current GW). When a LAST game belongs to a different gameweek, it is found in neither list, so `selectedGameId`/`selectedGame` never updates and the click appears dead.

**Fix:** make `handleSelectPlayed` resolve any played game, switching the modal to that game's gameweek/day so it loads and plays.
- Keep the current fast paths (game in current day → select; game elsewhere in current GW → switch day + select).
- Add a fallback: query `schedule_games` by `game_id` (scoped to the active `league_id`) to fetch its `gw`, `day`, and `status`. If it is a FINAL game, call `setGw`, `setDay`, and `setSelectedGameId`; the `useScheduleWeekGames(gw)` query then loads that week and `selectedGame` resolves, starting the recap video.
- Add the `useLeagueId` hook (and `supabase` client import) to the modal to scope the lookup.

This wires every LAST logo to its corresponding recap regardless of which gameweek it came from.

## 3) Manual draft: center the court watermark

**File:** `src/components/PlayerPickerDialog.tsx`

The league-logo watermark on the manual-draft court preview is pinned to the top-right corner (`absolute top-4 right-4`). Move it to the exact center of the court image, keeping its size, opacity, drop-shadow, and hover effect:
- Replace the positioning utilities with center positioning (`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`), leaving `h-24 w-24 md:h-28 md:w-28`, `opacity-[0.22]`, the hover `scale`/`opacity` transition, and `drop-shadow` intact.

## Technical notes
- No backend/schema changes; the only new data access is a single read-only lookup of an existing `schedule_games` row by `game_id`.
- All color values use the team brand colors already used elsewhere; borders use Tailwind arbitrary-color classes so the existing hover/accent behavior is unaffected.