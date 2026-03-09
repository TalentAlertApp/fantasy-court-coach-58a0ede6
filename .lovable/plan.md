
## Plan: Google Apps Script → Google Sheet → Supabase (Sheet-Driven Pipeline)

### Architecture

```
Google Apps Script (manual) → Google Sheet (3 tabs) → Edge Function (sync-sheet) → Supabase → Frontend
```

### Data Sources

- **Salary tab** (gid=1509599415): ID, Player, Team, Salary
- **FP tab** (gid=1967183508): Game logs (rows 1-2000) + Schedule (rows 2001+)
  - Columns: Week, Day, Date, Day Name, Time, Home Team, Away Team, Home Score, Away Score, Status, Game ID, ID, Player, PTS(=FP), MP, PS(=pts scored), R(=reb), A(=ast), B(=blk), S(=stl)
- **Database.csv**: Player bio data (uploaded via Commissioner page)

### FP Formula (CONSISTENT EVERYWHERE)

```
FP = PS + R + 2*A + 3*S + 3*B
```
Where: PS=points scored, R=rebounds, A=assists, S=steals, B=blocks

### Sync Modes

| Mode | What it does |
|------|-------------|
| SALARY | Read Salary tab → update players.salary → recalc value_t/value5 |
| GAMES | Read FP tab finished rows → upsert games + player_game_logs → recompute season/last5 aggregates |
| SCHEDULE | Read FP tab rows 2001+ → upsert schedule_games |
| FULL | Run all three sequentially |

### Edge Functions

1. **sync-sheet** — Main sync (SALARY/GAMES/SCHEDULE/FULL modes)
2. **import-players** — CSV-driven bio data import (Commissioner page)
3. **salary-update** — Manual salary edits with auto-recalc

### Pages

- Commissioner page (`/commissioner`) — CSV upload/download for player database
