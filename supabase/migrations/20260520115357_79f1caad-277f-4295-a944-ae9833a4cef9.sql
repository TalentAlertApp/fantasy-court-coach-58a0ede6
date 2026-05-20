
-- Salary history & dynamic salaries
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS last_salary_delta numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_salary_change_at timestamptz;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS dynamic_salaries boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.player_salary_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id int NOT NULL,
  league_id uuid NOT NULL,
  change_date date NOT NULL,
  old_salary numeric NOT NULL,
  new_salary numeric NOT NULL,
  delta numeric GENERATED ALWAYS AS (new_salary - old_salary) STORED,
  reason text NOT NULL DEFAULT 'GAMEDAY_AUTO',
  fp_window numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, change_date, reason)
);

CREATE INDEX IF NOT EXISTS idx_psc_player_date ON public.player_salary_changes(player_id, change_date DESC);
CREATE INDEX IF NOT EXISTS idx_psc_date ON public.player_salary_changes(change_date DESC);
CREATE INDEX IF NOT EXISTS idx_psc_league_date ON public.player_salary_changes(league_id, change_date DESC);

ALTER TABLE public.player_salary_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psc: public read" ON public.player_salary_changes;
CREATE POLICY "psc: public read" ON public.player_salary_changes FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.get_salary_movers(_days int DEFAULT 7, _league_id uuid DEFAULT NULL)
RETURNS TABLE (
  player_id int,
  total_delta numeric,
  changes_count int,
  last_change_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    player_id,
    SUM(delta)::numeric as total_delta,
    COUNT(*)::int as changes_count,
    MAX(created_at) as last_change_at
  FROM public.player_salary_changes
  WHERE change_date >= (CURRENT_DATE - _days)
    AND (_league_id IS NULL OR league_id = _league_id)
  GROUP BY player_id
  HAVING SUM(delta) <> 0
  ORDER BY ABS(SUM(delta)) DESC
$$;
