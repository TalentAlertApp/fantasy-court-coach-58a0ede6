
-- 1. Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);

-- 2. Create team_settings table
CREATE TABLE public.team_settings (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  salary_cap numeric,
  starter_fc_min integer,
  starter_bc_min integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to team_settings" ON public.team_settings FOR ALL USING (true) WITH CHECK (true);

-- 3. Insert default team
INSERT INTO public.teams (id, name, description) VALUES ('00000000-0000-0000-0000-000000000001', 'My Team', null);

-- 4. Add team_id to roster (nullable first)
ALTER TABLE public.roster ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
UPDATE public.roster SET team_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.roster ALTER COLUMN team_id SET NOT NULL;

-- 5. Add team_id to transactions (nullable first)
ALTER TABLE public.transactions ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
UPDATE public.transactions SET team_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.transactions ALTER COLUMN team_id SET NOT NULL;
