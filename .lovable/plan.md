

## Plan: Foundation + Data Layer + Strict Contract Enforcement

This is the core backend build. No UI pages — only edge functions, database tables, shared helpers, and client-side fetcher wiring.

### Prerequisites: Missing Secrets

Three secrets must be added before Google Sheets integration works:
- **GSHEET_ID** — the spreadsheet ID (`1bJHQxxvnpWcWevGcdnPTX3lx2Jdm_8FxEBlcka6iSb4`)
- **GSHEET_GID** — the sheet tab GID (e.g. `0`)
- **GOOGLE_SERVICE_ACCOUNT_JSON** — full JSON key for the service account

I will prompt for these secrets before proceeding.

---

### 1. Database Tables (SQL Migration)

Create 5 tables matching the contract:

**`players`** — all core + season + last5 + computed fields. `id` is integer PK (NBA player ID). Includes `salary`, `fc_bc`, `gp`, `mpg`, `pts`, `reb`, `ast`, `stl`, `blk`, `fp_pg_t`, `value_t`, `mpg5`, `pts5`, `reb5`, `ast5`, `stl5`, `blk5`, `fp_pg5`, `value5`, `injury`, `note`, `updated_at`.

**`player_last_game`** — `player_id` FK to players, `game_date`, `opp`, `home_away`, `result`, `a_pts`, `h_pts`, `mp`, `pts`, `reb`, `ast`, `stl`, `blk`, `fp`, `nba_game_url`, `updated_at`.

**`roster`** — `id` uuid PK, `slot` text (STARTER/BENCH), `player_id` int FK, `is_captain` boolean, `gw` int, `day` int, `created_at`, `updated_at`.

**`transactions`** — `id` uuid PK, `created_at`, `type` text, `player_in_id`, `player_out_id`, `cost_points` numeric, `notes` text nullable.

**`schedule_games`** — `game_id` text PK, `gw`, `day`, `tipoff_utc`, `away_team`, `home_team`, `away_pts`, `home_pts`, `status` text, `nba_game_url` text nullable.

No RLS policies needed — this is a single-user private app.

---

### 2. Shared Edge Function Helpers

**`supabase/functions/_shared/cors.ts`** — CORS headers constant + OPTIONS handler helper.

**`supabase/functions/_shared/envelope.ts`** — `okResponse(data)` and `errorResponse(code, message, details?)` helper functions that wrap payloads in the envelope format and return `Response` objects.

**`supabase/functions/_shared/sheets.ts`** — Google Sheets fetch helper:
- Reads `GOOGLE_SERVICE_ACCOUNT_JSON` secret
- Creates a JWT for Google Sheets API access (service account auth)
- Fetches sheet data via `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}`
- Parses European-format decimals (`"22,0"` → `22.0`)
- Returns raw row arrays

**`supabase/functions/_shared/normalize.ts`** — Functions to transform raw sheet rows into contract-shaped objects (`PlayerListItem`, `PlayerLastGame`). Handles:
- European decimal parsing (`"22,0"` → `22.0`)
- `"None"` → `null` for college
- Date format normalization (D/M/YYYY → YYYY-MM-DD)
- OPP field: `@` prefix → `home_away: "A"`, no prefix → `"H"`
- Computes `stocks` (stl+blk), `stocks5`, `delta_mpg`, `delta_fp` from raw fields
- Computes `value` = fp/salary, `value5` = fp5/salary

---

### 3. Edge Functions (one per API route)

All edge functions follow the same pattern: CORS → fetch data → normalize → Zod validate → envelope response.

**`supabase/functions/health/index.ts`** — Already exists. No changes needed.

**`supabase/functions/players/index.ts`** — `GET /players`
- Reads `DATA_SOURCE_MODE` (defaults to `"sheet"`)
- If `"sheet"`: calls `_shared/sheets.ts` to fetch all rows, normalizes via `_shared/normalize.ts`
- If `"supabase"`: queries `players` + `player_last_game` tables
- Supports query params: `sort`, `order`, `limit`, `offset`, `fc_bc`, `search`
- Returns `PlayersListResponseSchema`-validated envelope

**`supabase/functions/player-detail/index.ts`** — `GET /players/{id}`
- Parses player ID from query param (edge functions don't have path params)
- Returns player + empty `history[]` and `upcoming[]` arrays (populated later from sheet/DB)
- Validates against `PlayerDetailResponseSchema`

**`supabase/functions/last-game/index.ts`** — `GET /last-game`
- Bulk endpoint returning all players' last game data
- Validates against `LastGameBulkResponseSchema`

**`supabase/functions/roster-current/index.ts`** — `GET /roster/current`
- Reads from `roster` table
- Returns `RosterCurrentResponseSchema`-validated envelope
- Returns a default empty roster if none exists

**`supabase/functions/roster-save/index.ts`** — `POST /roster/save` (stub)
- Validates request body against `RosterSaveBodySchema`
- Returns placeholder valid envelope

**`supabase/functions/roster-auto-pick/index.ts`** — `POST /roster/auto-pick` (stub)
- Returns placeholder valid envelope

**`supabase/functions/transactions-simulate/index.ts`** — `POST /transactions/simulate` (stub)

**`supabase/functions/transactions-commit/index.ts`** — `POST /transactions/commit` (stub)

**`supabase/functions/schedule/index.ts`** — `GET /schedule`
- Reads from `schedule_games` table
- Returns `ScheduleResponseSchema`-validated envelope

**`supabase/functions/schedule-impact/index.ts`** — `GET /schedule/impact` (stub)

**`supabase/functions/sync-sheet/index.ts`** — `POST /sync-sheet`
- Fetches all data from Google Sheet
- Upserts into `players`, `player_last_game` tables
- Used to populate Supabase tables from sheet data

---

### 4. Config Updates

**`supabase/config.toml`** — Add all new edge functions with `verify_jwt = false` (single-user app, no auth).

---

### 5. Client-Side API Layer

**`src/lib/api.ts`** — Extend with new fetch functions:
- `fetchPlayers(params?)` → validates with `PlayersListResponseSchema`
- `fetchPlayerDetail(id)` → validates with `PlayerDetailResponseSchema`  
- `fetchLastGame()` → validates with `LastGameBulkResponseSchema`
- `fetchRosterCurrent()` → validates with `RosterCurrentResponseSchema`
- `fetchSchedule(params?)` → validates with `ScheduleResponseSchema`
- Stub functions for POST endpoints

All use the existing `apiFetch()` generic helper with Zod validation.

---

### 6. Google Sheets Column Mapping

From the CSV header analysis, the sheet columns map as follows (European decimal format throughout):

```text
Col  Header      → Contract Field
A    ID          → core.id
B    PHOTO       → core.photo
C    NAME        → core.name
D    TEAM        → core.team
E    FC_BC       → core.fc_bc
F    $           → core.salary
G    #           → core.jersey
H    COLLEGE     → core.college
I    WEIGHT      → core.weight
J    HEIGHT      → core.height
K    AGE         → core.age
L    DOB         → core.dob
M    EXP         → core.exp
N    POS         → core.pos
O    G           → season.gp
P    MPG         → season.mpg
Q    PPG         → season.pts
R    APG         → season.ast
S    RPG         → season.reb
T    BPG         → season.blk
U    SPG         → season.stl
V    FP_PG_T     → season.fp (read as-is)
W    $           → (duplicate salary, skip)
X    Value_T     → computed.value (read as-is)
Y    LAST_GAME   → (season last game date, skip)
Z    MPG5        → last5.mpg5
AA   PPG5        → last5.pts5
AB   APG5        → last5.ast5
AC   RPG5        → last5.reb5
AD   BPG5        → last5.blk5
AE   SPG5        → last5.stl5
AF   FP_PG5      → last5.fp5 (read as-is)
AG   $           → (duplicate salary, skip)
AH   Value5      → computed.value5 (read as-is)
AI   LAST_GAME   → lastGame.date
AJ   OPP         → lastGame.opp + home_away
AK   A_PTS       → lastGame.a_pts
AL   H_PTS       → lastGame.h_pts
AM   MIN         → lastGame.mp
AN   P           → lastGame.pts
AO   A           → lastGame.ast
AP   R           → lastGame.reb
AQ   B           → lastGame.blk
AR   S           → lastGame.stl
AS   LINK        → lastGame.nba_game_url
AT   FP_L        → lastGame.fp (read as-is)
AU   (timestamp) → health metadata
AV   Value_L     → computed for last game (skip)
```

---

### Implementation Order

1. Prompt for missing secrets (GSHEET_ID, GSHEET_GID, GOOGLE_SERVICE_ACCOUNT_JSON)
2. Create database tables via migration
3. Create `_shared/` helpers (cors, envelope, sheets, normalize)
4. Create all edge functions
5. Update `supabase/config.toml`
6. Extend `src/lib/api.ts` with all client fetchers
7. Deploy and test `/players` endpoint end-to-end

