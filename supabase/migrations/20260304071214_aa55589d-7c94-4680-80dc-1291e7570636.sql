
-- A) games table: add BallDontLie columns (additive only)
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS balldontlie_game_id INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS season INTEGER,
  ADD COLUMN IF NOT EXISTS date_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS home_team_abbr TEXT,
  ADD COLUMN IF NOT EXISTS away_team_abbr TEXT;

-- B) player_game_logs table: add BallDontLie game reference
ALTER TABLE public.player_game_logs
  ADD COLUMN IF NOT EXISTS balldontlie_game_id INTEGER;

-- C) players table: id is already INT PK matching NBA player IDs — no change needed.
-- Just confirm no balldontlie_player_id column is needed since players.id IS the player ID.

-- Add index on the new BDL game id columns for fast lookups
CREATE INDEX IF NOT EXISTS idx_games_bdl_game_id ON public.games (balldontlie_game_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_bdl_game_id ON public.player_game_logs (balldontlie_game_id);
