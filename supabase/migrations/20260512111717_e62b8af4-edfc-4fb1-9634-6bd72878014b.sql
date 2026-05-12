ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_injury_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_injury_check
  CHECK (injury IS NULL OR injury IN ('OUT', 'Q', 'DTD', 'GTD', 'PROB'));