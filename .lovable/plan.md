# Add Nationality to NBA Players

## Current State (WNBA)

WNBA already shows nationality everywhere. The data flows through `players.nationality` (already populated for 258/258 WNBA players via `wnba-sheet-sync`), and the UI is league-agnostic — it just renders whatever the API returns.

**Where the flag/label appears today** (will automatically light up for NBA once the column is populated):

| Surface | File | Treatment |
|---|---|---|
| Players table row | `src/components/PlayerRow.tsx` (col after team) | Round flag (xs, ~14px) + country label, truncated to 128px |
| Player modal header | `src/components/PlayerModal.tsx` | Tiny round flag (xs, forced 12px) next to bio line |
| Team modal roster rows | `src/components/TeamModal.tsx` | Round flag (xs) next to player name |

API:
- `supabase/functions/players-list/index.ts` — already returns `nationality`
- `supabase/functions/player-detail/index.ts` — already returns `nationality`

Country → ISO mapping lives in `src/lib/nationality.ts`, rendered via `flagcdn.com` in `src/components/NationalityFlag.tsx`.

NBA today: 592 players, 0 with nationality. Uploaded CSV `NBA_ID_Nation.csv` maps NBA player ID → country (593 rows). Spot-checked IDs (203999 Jokić, 1641705 Wembanyama) match `players.id` directly.

## Plan

### 1. Extend country → ISO map (`src/lib/nationality.ts`)

The CSV introduces ~25 countries not yet in the map. Add the missing ones so flags render:

Austria (AT), Croatia (HR), Democratic Republic of Congo / DRC (CD), Dominican Republic (DO), Georgia (GE), Guinea (GN), Haiti (HT), Israel (IL), Jamaica (JM), Japan (JP), Latvia (LV), Montenegro (ME), Nicaragua (NI), Nigeria (NG), Poland (PL), Portugal (PT), Puerto Rico (PR), Saint Lucia (LC), Senegal (SN), South Sudan (SS), Sweden (SE), Switzerland (CH), Turkey (TR), Ukraine (UA).

(Existing entries — USA, France, Canada, Serbia, Slovenia, Germany, Spain, Italy, etc. — already cover the rest. Also remove the misleading "WNBA-only" comment at the top of the file.)

### 2. One-shot NBA nationality import (Supabase migration)

Create a new timestamped migration under `supabase/migrations/` that:

- Resolves `league_id` for `code='nba'`.
- Runs a single `UPDATE public.players SET nationality = v.nat FROM (VALUES (203999,'Serbia'), (1641705,'France'), …all 593 rows…) AS v(id, nat) WHERE players.id = v.id AND players.league_id = <nba_league_id>;`
- Leaves WNBA rows untouched.

No schema change — the `nationality` column already exists and is used by WNBA.

### 3. No UI changes required

Because `PlayerRow`, `PlayerModal`, and `TeamModal` already read `core.nationality` / `player.nationality` from the existing API responses, NBA will get the exact same flag + label treatment as WNBA the moment the column is populated. Size, position, truncation, and styling are unchanged.

## Verification

- After migration: `SELECT COUNT(*) FILTER (WHERE nationality IS NOT NULL) FROM players JOIN leagues …` returns ~593 for NBA.
- Players page (NBA league): nationality column shows flag + country.
- Open a player modal (NBA): tiny flag next to bio.
- Open a team modal (NBA): flag next to roster names.
