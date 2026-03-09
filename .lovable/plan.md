

## Plan: CSV Import for Game Data (Weeks 1-20)

### Overview
Add a second CSV import section to the Commissioner page to bulk-import historical game and player performance data. This will become the single source of truth for schedule and box scores.

### Data Flow
```text
CSV (Week, Day, Game metadata, Player stats per game)
  ↓
Edge Function: import-game-data
  ↓
Upsert to: schedule_games (1 row per game) + player_game_logs (1 row per player-game)
  ↓
Schedule page reads from these tables (already implemented)
```

### CSV → Database Mapping

**Schedule (`schedule_games` table)**:
- Week → `gw`
- Day → `day`
- Date → `tipoff_utc`
- Home Team → `home_team`
- Away Team → `away_team`
- Home Score → `home_pts`
- Away Score → `away_pts`
- Status → `status` (map "Final" → "FINAL")
- Game ID → `game_id`

**Player Stats (`player_game_logs` table)**:
- ID → `player_id`
- Game ID → `game_id`
- Date → `game_date`
- PTS (Fantasy Points from CSV) → `fp`
- MP → `mp`
- PS (Points Scored) → `pts`
- R → `reb`
- A → `ast`
- B → `blk`
- S → `stl`
- `home_away`: Determine by matching player's team against Home Team/Away Team

### Implementation

#### 1. New Edge Function: `supabase/functions/import-game-data/index.ts`
- Parse CSV rows (skip header)
- Extract unique games → batch upsert to `schedule_games`
- Create player_game_logs entries → batch upsert
- Calculate `home_away` field: if player's team matches game's home_team → "H", else "A"
- Calculate `opp` field: opposite team's tricode
- Return summary: games imported, player logs imported, errors

#### 2. Update `src/pages/CommissionerPage.tsx`
- Add third card: "Import Game Data"
- CSV format description: Week, Day, Date, Time, Home/Away Teams, Scores, Status, Game ID, Player ID, Player, PTS, MP, PS, R, A, B, S
- File upload handler similar to player import
- Display results: X games, Y player logs imported

#### 3. Add Contracts (`src/lib/contracts.ts`)
```typescript
ImportGameDataResponseSchema = EnvelopeSchema(z.object({
  games_imported: z.number(),
  player_logs_imported: z.number(),
  errors: z.array(z.string()).optional()
}))
```

#### 4. Add API Function (`src/lib/api.ts`)
```typescript
export async function importGameData(rows: Array<{...}>) {
  return unwrap(await apiFetch("import-game-data", ImportGameDataResponseSchema, {
    method: "POST",
    body: JSON.stringify({ rows })
  }));
}
```

#### 5. Update `supabase/config.toml`
```toml
[functions.import-game-data]
verify_jwt = false
```

### Edge Cases
- **Duplicate games**: Use upsert with `game_id` as conflict key
- **Duplicate player logs**: Use upsert with composite key `(player_id, game_id)`
- **Missing player in players table**: Skip that player log, add to errors array
- **Invalid team tricode**: Log warning, use raw value
- **Date parsing**: Handle "2025-10-21" format, convert to timestamp for `tipoff_utc`

### Files to Create/Modify
| File | Action |
|------|--------|
| `supabase/functions/import-game-data/index.ts` | Create — bulk import processor |
| `src/pages/CommissionerPage.tsx` | Add game data import section |
| `src/lib/contracts.ts` | Add ImportGameDataResponseSchema |
| `src/lib/api.ts` | Add importGameData function |
| `supabase/config.toml` | Add function config |

### Post-Import
- Schedule page will automatically show historical games (Weeks 1-20)
- Box scores will expand to show player stats
- No changes needed to ScheduleList.tsx or game-boxscore function (already implemented)

