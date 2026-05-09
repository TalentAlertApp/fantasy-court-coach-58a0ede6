CREATE TABLE IF NOT EXISTS public.court_show_intelligence (
  league_id uuid NOT NULL,
  gw integer NOT NULL,
  day integer NOT NULL,
  mode text NOT NULL,
  headline text,
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, gw, day)
);

ALTER TABLE public.court_show_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "court_show_intelligence: public read"
  ON public.court_show_intelligence
  FOR SELECT
  USING (true);