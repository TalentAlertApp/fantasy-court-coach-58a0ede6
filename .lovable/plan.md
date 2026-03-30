

## Create PROJECT_CONTEXT.md

### What
Create a single comprehensive reference file at `PROJECT_CONTEXT.md` (project root) documenting the full state of the project: architecture, tech stack, all features, database schema, edge functions, secrets, data pipeline, decisions, and known issues.

### Content Outline

1. **Project Overview** — Private single-user NBA Fantasy Manager for 2025-26 season
2. **Tech Stack** — React 18 + Vite 5 + Tailwind v3 + TypeScript 5 + Supabase (external project `jtewuekavaujgnynmpaq`)
3. **Architecture** — Google Apps Script → Google Sheet → Edge Function (sync-sheet) → Supabase → React Frontend; dual-source (Sheet sync + CSV import)
4. **Scoring Rule** — FP = PTS + REB + 2×AST + 3×STL + 3×BLK
5. **Positions** — FC (Front Court) / BC (Back Court) only
6. **Database Schema** — All 8 tables (players, games, player_game_logs, player_last_game, roster, schedule_games, teams, team_settings, transactions, sync_runs) with column summaries and RLS (all public, no auth)
7. **Edge Functions** (17 deployed) — health, players-list, player-detail, last-game, roster-current, roster-save, roster-auto-pick, transactions-simulate, transactions-commit, schedule, schedule-impact, sync-sheet, sync-status, salary-update, import-players, import-game-data, game-boxscore, ai-coach, teams
8. **Secrets** — OPENAI_API_KEY_NBA (AI Coach), GSHEET_ID/GSHEET_GID/GOOGLE_SERVICE_ACCOUNT_JSON (Sheet sync), plus standard Supabase keys
9. **Frontend Pages** — Home/Roster (/), Players/Waiver Wire (/players), Transactions (/transactions), Schedule (/schedule), Stats (/stats), AI Hub (/ai), Commissioner (/commissioner)
10. **Key Features Built** — Roster management with drag-and-drop, captain selection, auto-pick; Schedule with week/day navigation, deadline display, boxscore expansion, NBA.com links; AI Coach (5 actions via OpenAI gpt-4.1-mini); Google Sheet sync (FULL/SALARY/GAMES/SCHEDULE modes); CSV import for player bio data and game data; Team management (multi-team support)
11. **Deadlines System** — Static lookup in `src/lib/deadlines.ts`, 25 gameweeks, Lisbon timezone, DST-aware UTC conversion
12. **Data Import Pipeline** — Commissioner page CSV uploads (Database.csv for player bios, game data CSVs for historical/incremental logs, Game URLs CSV); import-game-data edge function with normalization
13. **Immutable Docs** — `docs/API_CONTRACTS.md` and `docs/AI_SYSTEM_PROMPT.md` are source of truth
14. **Known Limitations** — No authentication (all RLS policies are public); build errors from TS strictness in edge functions (SupabaseClient type mismatches); no real-time/websocket updates; single-user only

### File Changed
| File | Action |
|------|--------|
| `PROJECT_CONTEXT.md` | **Create** — comprehensive project reference |

