## Root cause for issues 2–5 (one bug)

`syncPlayers` in `supabase/functions/euroleague-sheet-sync/index.ts` still uses the NBA/WNBA column layout (A URL, B ID, C PHOTO, D NAME, E TEAM, F FC_BC, G $, H #, **I COLLEGE, J WEIGHT, K HEIGHT, L AGE, M DOB, N EXP, O POS, P NAT**).

The EuroLeague `DB_Players` sheet does NOT have COLLEGE / WEIGHT / EXP columns. Its real layout (confirmed against current DB rows) is:
`A URL, B ID, C PHOTO, D NAME, E TEAM, F FC_BC, G $, H #, I HEIGHT, J AGE, K DOB, L POS, M NAT`.

Consequence today:
- `college` ← actually HEIGHT ("1.96")
- `height` ← actually DOB ("07/02/1989")
- `dob` ← actually POS (unparseable → null)
- `nationality` ← read from `r[15]` (empty → null)

That single mismatch explains: list-view DOB empty, HT showing the DOB string, "College" showing the height number, NATION empty, and NAT flag missing in both PlayerModal header and TeamModal Roster tab.

## Issue 1 — Venue images for EA7, PBB, PAO, EFS

Their `venue_image_url` in `sport_teams` is a Wikipedia article URL (`…/wiki/X#/media/File:Y.jpg`), not a real image, so `<img>` fails. Fix in `euroleague-sheet-sync` (Teams sync): when a URL matches `…wikipedia.org/wiki/<page>#/media/File:<filename>`, rewrite it to `https://commons.wikimedia.org/wiki/Special:FilePath/<filename>` (which resolves to the actual JPG). Apply the same transform when reading existing rows so re-running Teams sync repairs the four broken records.

## Issue 6 — Game modal says "Watch Recap on NBA.com" for EuroLeague

`GameDetailModal.tsx` line 77 hardcodes:
```ts
const recapHost = league === "wnba" ? "WNBA.com" : "NBA.com";
```
Add the EuroLeague case → `"EuroLeagueBasketball.net"`. Same applies to the `ExternalLink` label `leagueName` (line 206) — extend so EuroLeague reads "EuroLeague".

## Issue 5 — Video Recaps plan

Current state in the DB (verified): EuroLeague `schedule_games` have `game_recap_url` pointing to `euroleaguebasketball.net/euroleague/videos/...` and `youtube_recap_id` is NULL for every row. `GameDetailModal.toYouTubeEmbed()` therefore cannot embed and falls back to the outbound link (which is what triggers issue 6).

Plan:
1. Keep the existing `euroleaguebasketball.net` URL as the outbound fallback (label fixed by issue 6).
2. Backfill `youtube_recap_id` using the already-extended `youtube-recap-lookup` edge function. The Commissioner panel already has a **"Find YouTube Recaps"** button — document it and confirm it batches over `schedule_games` where `youtube_recap_id IS NULL AND status ILIKE 'FINAL%'`.
3. Once IDs are filled, the existing embed code in `GameDetailModal` will render the YouTube iframe inline exactly like NBA/WNBA — no further UI changes needed.

## Files to change

- `supabase/functions/euroleague-sheet-sync/index.ts`
  - `syncPlayers`: remap columns to `I HEIGHT, J AGE, K DOB, L POS, M NAT`. Detect layout from the header row (presence of "HEIGHT" at index 8 vs "COLLEGE") to stay forward-compatible.
  - `syncTeams` (or wherever `venue_image_url` is written): add `normaliseWikiImageUrl()` helper and apply to incoming + existing rows for this league only.
- `src/components/GameDetailModal.tsx`
  - Add `euroleague` branch to `recapHost` and `leagueName`.
- `src/components/PlayerModal.tsx` line 486, `src/components/TeamModal.tsx` line 322
  - Already handle `league === "wnba"`; add `euroleague === "Watch Recap on YouTube"` (already done previously, just verifying the path is reached when `youtube_recap_id` is null — adjust so EuroLeague always says "Watch Recap on EuroLeagueBasketball.net" when embed is unavailable, "on YouTube" when it is).

## Post-deploy actions (one-click in Commissioner)

1. Run **Sync → Teams** → repairs the 4 broken venue images.
2. Run **Sync → Players** → fills nationality, fixes DOB/Height/Age/Position for all ~250 EuroLeague players. Existing salaries are preserved (G column already ignored).
3. Run **Find YouTube Recaps** → fills `youtube_recap_id` so game modals embed instead of linking out.

No database migrations needed (all columns already exist).
