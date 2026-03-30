# PROJECT_CONTEXT.md — NBA Fantasy Manager

> Last updated: 2026-03-30

---

## 1. Project Overview

Private, single-user NBA Fantasy Manager web app for the **2025-26 NBA Regular Season**. Manages rosters, tracks player stats, simulates transactions, monitors schedules with Lisbon-timezone deadlines, and provides AI-powered coaching recommendations.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS v3, shadcn/ui components |
| State/Data | TanStack React Query v5 |
| Routing | React Router DOM v6 |
| Charts | Recharts |
| Backend | Supabase (external project `jtewuekavaujgnynmpaq`) |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI | OpenAI GPT-4.1-mini (via `ai-coach` edge function) |
| Data Sync | Google Sheets → Edge Function pipeline |

---

## 3. Architecture

```
Google Apps Script (manual trigger)
  → Google Sheet (Salary tab, FP tab, Schedule rows)
    → Edge Function: sync-sheet (SALARY / GAMES / SCHEDULE / FULL)
      → Supabase PostgreSQL
        → React Frontend (via TanStack Query → Edge Functions)

Commissioner CSV Uploads (Database.csv, Game Data, Game URLs)
  → Edge Functions: import-players, import-game-data
    → Supabase PostgreSQL
```

**Supabase is the sole runtime source of truth.** Data enters via two paths:
1. **Google Sheet sync** — salaries, game logs, schedule via `sync-sheet`
2. **CSV imports** — player bios (`import-players`), game data (`import-game-data`), game URLs (direct DB update)

---

## 4. Scoring Rule (Global Constant)

```
FP = PTS + REB + 2×AST + 3×STL + 3×BLK
```

- Assists are worth **2×**
- Steals and blocks ("stocks") are worth **3× each**
- This formula is used everywhere: edge functions, optimizer, AI coach, display

---

## 5. Positions

Only two positions exist in this league:
- **FC** (Front Court) — displayed with red badge
- **BC** (Back Court) — displayed with blue badge

No other positions (PG, SG, SF, PF, C) are used in the fantasy system.

---

## 6. Database Schema

All tables use **public RLS policies** (no authentication). Project ID: `jtewuekavaujgnynmpaq`.

### `players`
Core player registry. ~500+ NBA players.
| Key Columns | Description |
|-------------|-------------|
| `id` (PK, integer) | NBA.com player ID |
| `name`, `team`, `fc_bc` | Identity & position |
| `salary`, `value_t`, `value5` | Fantasy salary & value metrics |
| `fp_pg_t`, `fp_pg5` | Season & last-5 FP per game |
| `mpg`, `mpg5` | Minutes per game (season & last-5) |
| `pts`, `reb`, `ast`, `stl`, `blk` | Season per-game averages |
| `pts5`, `reb5`, `ast5`, `stl5`, `blk5` | Last-5 per-game averages |
| `stocks`, `stocks5` | STL+BLK combined |
| `delta_fp`, `delta_mpg` | Trend deltas (last5 vs season) |
| `gp` | Games played |
| `injury` | Injury status string or null |
| `photo` | NBA.com headshot URL |
| `jersey`, `age`, `dob`, `exp`, `college`, `height`, `weight`, `pos` | Bio data |

### `games`
One row per NBA game (1,230 in regular season).
| Key Columns | Description |
|-------------|-------------|
| `game_id` (PK) | NBA.com game ID (e.g., `"0022500931"`) |
| `home_team`, `away_team` | Full team names |
| `home_team_abbr`, `away_team_abbr` | 3-letter abbreviations |
| `home_pts`, `away_pts` | Final scores |
| `status` | `"FINAL"` or `"Scheduled"` |
| `game_date`, `date_utc` | Date strings |
| `nba_game_url` | Full NBA.com game page URL |
| `game_boxscore_url`, `game_charts_url`, `game_recap_url`, `game_playbyplay_url` | NBA.com sub-page URLs |

### `player_game_logs`
One row per player per game. Historical box scores.
| Key Columns | Description |
|-------------|-------------|
| `id` (PK, uuid) | Auto-generated |
| `player_id` → `players.id` | FK to player |
| `game_id` → `games.game_id` | FK to game |
| `mp`, `pts`, `reb`, `ast`, `blk`, `stl`, `fp` | Box score stats |
| `home_away` | `"home"` or `"away"` |
| `matchup`, `opp` | Opponent info |
| `game_date` | Date of game |
| `nba_game_url`, `game_boxscore_url`, etc. | URL references |

### `player_last_game`
Denormalized: one row per player with their most recent game stats. Used for quick display.
| Key Columns | Description |
|-------------|-------------|
| `player_id` (FK → players, one-to-one) | |
| Same stat columns as `player_game_logs` | |
| `h_pts`, `a_pts`, `result` | Game score context |

### `schedule_games`
Full season schedule (1,230 games). Used for schedule page display.
| Key Columns | Description |
|-------------|-------------|
| `game_id` (PK) | NBA.com game ID |
| `gw` | Gameweek number (1-25) |
| `day` | Day within gameweek (1-7) |
| `home_team`, `away_team` | 3-letter abbreviations |
| `home_pts`, `away_pts` | Scores (0 if not played) |
| `status` | `"FINAL"` or `"Scheduled"` |
| `tipoff_utc` | ISO 8601 UTC tipoff time |
| `nba_game_url` | Full NBA.com game page URL |
| `game_boxscore_url`, etc. | NBA.com sub-page URLs |

### `roster`
Player-to-team roster assignments per gameweek/day.
| Key Columns | Description |
|-------------|-------------|
| `id` (PK, uuid) | |
| `team_id` (FK → teams) | |
| `player_id` (FK → players) | |
| `slot` | `"starter"` or `"bench"` |
| `is_captain` | Boolean |
| `gw`, `day` | Gameweek & day context |

### `teams`
Fantasy teams (multi-team support).
| Key Columns | Description |
|-------------|-------------|
| `id` (PK, uuid) | |
| `name`, `description` | |

### `team_settings`
Per-team configuration.
| Key Columns | Description |
|-------------|-------------|
| `team_id` (FK → teams, one-to-one) | |
| `salary_cap` | Max salary |
| `starter_fc_min`, `starter_bc_min` | Minimum FC/BC starters |

### `transactions`
Completed transfer/waiver moves.
| Key Columns | Description |
|-------------|-------------|
| `team_id` (FK → teams) | |
| `player_in_id`, `player_out_id` | Swap targets |
| `type` | Transaction type |
| `cost_points` | Point cost |
| `notes` | |

### `sync_runs`
Audit log for data sync operations.
| Key Columns | Description |
|-------------|-------------|
| `type` | `"SALARY"`, `"GAMES"`, `"SCHEDULE"`, `"FULL"` |
| `status` | `"running"`, `"ok"`, `"error"` |
| `started_at`, `finished_at` | Timestamps |
| `details` | JSON payload with counts/errors |

---

## 7. Edge Functions

All deployed with `verify_jwt = false` (no auth).

| Function | Purpose |
|----------|---------|
| `health` | Health check endpoint |
| `players-list` | Paginated/filtered player list with sorting |
| `player-detail` | Single player full stats + game log |
| `last-game` | Player's most recent game stats |
| `roster-current` | Current roster for a team (resolves team via header/param/default) |
| `roster-save` | Save roster changes (starters/bench/captain) |
| `roster-auto-pick` | Auto-optimize roster based on FP5/value |
| `transactions-simulate` | Preview a transfer's impact before committing |
| `transactions-commit` | Execute a transfer (swap players) |
| `schedule` | Fetch schedule games with filters |
| `schedule-impact` | Analyze schedule density for teams |
| `sync-sheet` | Main Google Sheet sync (SALARY/GAMES/SCHEDULE/FULL modes) |
| `sync-status` | Latest sync run status |
| `salary-update` | Manual salary edit with value recalculation |
| `import-players` | CSV-driven player bio data import |
| `import-game-data` | Bulk game + player_game_logs import from CSV data |
| `game-boxscore` | Box score for a specific game_id |
| `ai-coach` | AI-powered coaching (5 actions: suggest-transfers, pick-captain, explain-player, analyze-roster, injury-monitor) |
| `teams` | CRUD for fantasy teams |

### Shared Modules (`supabase/functions/_shared/`)
- `cors.ts` — CORS headers & preflight handler
- `envelope.ts` — Standard `okResponse` / `errorResponse` wrappers
- `normalize.ts` — Team name/abbreviation normalization
- `sheets.ts` — Google Sheets API helper (service account auth)
- `resolve-team.ts` — Resolve team_id from query param / header / default

---

## 8. Secrets & Environment Variables

| Secret | Purpose | Where Used |
|--------|---------|------------|
| `SUPABASE_URL` | Supabase project URL | All edge functions (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for DB access | All edge functions (auto-set) |
| `SUPABASE_ANON_KEY` | Anon/publishable key | Frontend client |
| `OPENAI_API_KEY_NBA` | OpenAI API key for AI Coach | `ai-coach` edge function |
| `GSHEET_ID` | Google Sheet document ID | `sync-sheet` |
| `GSHEET_GID_SALARY` | Salary tab GID (1509599415) | `sync-sheet` |
| `GSHEET_GID_FP` | FP tab GID (1967183508) | `sync-sheet` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account credentials | `sync-sheet` (via `sheets.ts`) |

Frontend `.env`:
- `VITE_SUPABASE_PROJECT_ID` = `jtewuekavaujgnynmpaq`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = anon key
- `VITE_SUPABASE_URL` = `https://jtewuekavaujgnynmpaq.supabase.co`

---

## 9. Frontend Pages

| Route | Page | Key Features |
|-------|------|-------------|
| `/` | Home / Roster | Roster court view, drag-and-drop, captain selection, auto-pick, KPI tiles |
| `/players` | Players / Waiver Wire | Player table with filters, sorting, search; player modal with detail/game log |
| `/transactions` | Transactions | Transaction history, simulate & commit transfers |
| `/schedule` | Schedule | Week/day navigation, game cards with logos, tipoff times (Lisbon TZ), deadline display, expandable box scores, NBA.com links, game count badges |
| `/stats` | Stats | Charts and statistical analysis |
| `/ai` | AI Hub | AI Coach interface (5 actions) |
| `/commissioner` | Commissioner | CSV upload/download for player database, sync controls |

---

## 10. Key Features

### Roster Management
- 5 starters + 5 bench slots
- Minimum FC/BC starter requirements
- Captain selection (1 per lineup)
- Auto-pick optimizer (`src/lib/optimizer.ts`)
- Drag-and-drop between starter/bench

### Schedule System
- 25 gameweeks, up to 7 days each
- Week/day pill navigation with game count badges
- Games sorted by tipoff time (Lisbon timezone)
- Expandable box scores per game (max 10 players with scroll)
- NBA.com game page links
- Past weeks dimmed, today indicator

### Deadline System
- Static lookup table in `src/lib/deadlines.ts`
- All deadlines in Lisbon local time, DST-aware UTC conversion
- Portugal DST: UTC+1 from last Sunday of March to last Sunday of October
- Displayed inline on schedule page header

### AI Coach
- 5 actions: `suggest-transfers`, `pick-captain`, `explain-player`, `analyze-roster`, `injury-monitor`
- Uses OpenAI GPT-4.1-mini via Responses API
- JSON-only output with schema validation + 1 retry
- Context: top 100 players + roster + schedule

### Data Sync
- Google Sheet sync: FULL/SALARY/GAMES/SCHEDULE modes
- CSV imports via Commissioner page
- `import-game-data`: normalizes team names, computes FP, upserts games + logs, updates player aggregates & last_game

### Team Management
- Multi-team support with team switcher
- Team resolved via: query param → header → default (earliest created)

---

## 11. Deadlines System Detail

File: `src/lib/deadlines.ts`

- 25 gameweeks (GW1–GW25), each with 1-7 days
- Each entry: `{ gw, day, deadlineUtc: "ISO string" }`
- Lisbon local times converted to UTC accounting for DST
- DST period (UTC+1): ~last Sunday March to ~last Sunday October
- All other times: UTC+0 (WET)
- Helper: `formatDeadlineLisbon(isoString)` — formats back to Lisbon display time

---

## 12. Data Import Pipeline

### Player Bios (Database.csv)
Commissioner page → `import-players` edge function
- Fields: ID, Photo, Name, Team, FC_BC, Jersey, Salary, College, Weight, Height, Age, DOB, Exp, Pos

### Game Data (Weekly CSVs)
Commissioner page or direct API call → `import-game-data` edge function
- Parses CSV rows with: Week, Day, Game ID, Player ID, Player Name, Team, MP, PTS(=FP), PS, REB, AST, BLK, STL, Home/Away, Scores, Status
- Normalizes team abbreviations
- Computes FP from raw stats
- Upserts into `games` + `player_game_logs`
- Updates `player_last_game` for each player
- Recalculates season & last-5 aggregates on `players` table

### Game URLs (CSV)
Parsed client-side or via script → direct DB UPDATE
- Maps `game_id` → `nba_game_url` (full URL like `https://www.nba.com/game/hou-vs-was-0022500879`)
- Updated on both `schedule_games` and `games` tables

---

## 13. Immutable Reference Docs

- `docs/API_CONTRACTS.md` — Edge function request/response schemas
- `docs/AI_SYSTEM_PROMPT.md` — AI Coach system prompt & action schemas

These are the source of truth for API contracts and AI behavior.

---

## 14. Known Limitations & Issues

1. **No authentication** — All RLS policies are public. Single-user app by design.
2. **TypeScript strictness in edge functions** — `SupabaseClient` type mismatches require `any` casts when passing between modules (e.g., `resolveTeam`, `fetchContext`).
3. **No real-time updates** — No Supabase Realtime/WebSocket subscriptions. Data refreshes on navigation or manual sync.
4. **Single-user only** — No multi-user auth, no user-scoped data.
5. **Static deadlines** — Deadline schedule is hardcoded in `deadlines.ts`, not in database.
6. **Missing players** — Some NBA players (e.g., two-way/10-day contracts) may not be in the `players` table, causing their game logs to be skipped during import.
7. **Google Sheet dependency** — Salary and schedule sync requires active Google service account credentials and correct sheet GIDs.

---

## 15. NBA Team Abbreviations

Defined in `src/lib/nba-teams.ts`. Standard 3-letter NBA abbreviations (e.g., LAL, BOS, GSW, NYK). Used for logos, display, and data normalization.

---

## 16. File Structure Highlights

```
src/
├── components/          # UI components (roster, schedule, players, layout)
├── contexts/            # TeamContext (selected team state)
├── hooks/               # React Query hooks (usePlayersQuery, useRosterQuery, etc.)
├── lib/                 # Utilities (api.ts, contracts.ts, deadlines.ts, nba-teams.ts, optimizer.ts)
├── pages/               # Route pages
├── integrations/supabase/ # Supabase client & generated types

supabase/
├── functions/           # Edge functions (Deno)
│   ├── _shared/         # Shared modules (cors, envelope, normalize, sheets, resolve-team)
│   └── [function-name]/ # Individual function directories
├── config.toml          # Function configuration
└── migrations/          # Database migrations (read-only)

public/data/             # CSV data files for reference/import
docs/                    # API contracts & AI system prompt
```
