
## Plan: Wire Players Data to CSV Import & Add Player Click on Schedule

### Issues Identified

1. **Schedule page**: Box score player rows are not clickable - no way to open PlayerModal
2. **Player detail endpoint** (`player-detail`): Still reads from Google Sheets instead of Supabase database
3. **Players data**: `player_last_game` table isn't populated from CSV import, so "Last Game FP Breakdown" shows zeros
4. **Player history**: PlayerModal "History" tab returns empty because `player-detail` doesn't query `player_game_logs`

### Solution

#### 1. Update `ScheduleList.tsx` - Make player rows clickable
- Add state for `selectedPlayerId`
- Wrap player row content in a clickable div that calls `setSelectedPlayerId(p.player_id)`
- Import and render `PlayerModal` component

#### 2. Rewrite `player-detail` edge function to use Supabase
- Remove all Google Sheets code
- Query `players` table for core player data
- Query `player_game_logs` for history (most recent games)
- Query `schedule_games` for upcoming games
- Return `player`, `history[]`, and `upcoming[]`

#### 3. Update `import-game-data` to also populate `player_last_game`
- After inserting `player_game_logs`, for each player find their most recent game log
- Upsert into `player_last_game` table with latest stats
- This fixes the "Last Game FP Breakdown" in PlayerModal

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ScheduleList.tsx` | Add player click → open modal |
| `supabase/functions/player-detail/index.ts` | Rewrite to read from Supabase DB |
| `supabase/functions/import-game-data/index.ts` | Add logic to update `player_last_game` |
