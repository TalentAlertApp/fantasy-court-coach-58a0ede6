
-- Add EuroLeague as an additive third competition.
-- All rows are inserted with stable UUIDs and ON CONFLICT DO NOTHING, so re-running is safe
-- and NBA/WNBA rows are untouched.

-- 1. Scoring system for EuroLeague (mirrors nba_classic rules — same FP formula)
INSERT INTO public.scoring_systems (id, code, name, sport, is_template, is_active)
VALUES ('00000000-0000-0000-0000-000000000003', 'euroleague_classic', 'EuroLeague Classic', 'euroleague', true, true)
ON CONFLICT (id) DO NOTHING;

-- Copy NBA Classic rules into the new EuroLeague Classic system
INSERT INTO public.scoring_rules (scoring_system_id, stat_key, rule_type, weight, applies_to, is_active, sort_order, metadata)
SELECT '00000000-0000-0000-0000-000000000003', stat_key, rule_type, weight, applies_to, is_active, sort_order, metadata
FROM public.scoring_rules
WHERE scoring_system_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.scoring_rules
    WHERE scoring_system_id = '00000000-0000-0000-0000-000000000003'
  );

-- 2. Sport league row (kind='sport') — the basketball competition itself
INSERT INTO public.leagues (id, code, name, kind, sport, scoring_system_id, visibility, status, owner_id)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'euroleague',
  'EuroLeague',
  'sport',
  'euroleague',
  '00000000-0000-0000-0000-000000000003',
  'public',
  'active',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- 3. Main fantasy league for EuroLeague
INSERT INTO public.leagues (id, code, name, kind, sport, scoring_system_id, visibility, status, owner_id, sport_league_id)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'main_euroleague',
  'Main League',
  'fantasy',
  'euroleague',
  '00000000-0000-0000-0000-000000000003',
  'public',
  'active',
  NULL,
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Extend the existing RLS policy that exposes the main fantasy rows so 'main_euroleague'
-- is publicly readable just like 'main' and 'main_wnba'. The policy is dropped+recreated;
-- this changes only the list of allowed main league codes, not the policy semantics.
DROP POLICY IF EXISTS "leagues: read sport and main system rows" ON public.leagues;
CREATE POLICY "leagues: read sport and main system rows"
ON public.leagues
FOR SELECT
TO public
USING (
  (kind = 'sport')
  OR (
    kind = 'fantasy'
    AND owner_id IS NULL
    AND code = ANY (ARRAY['main','main_wnba','main_euroleague'])
  )
);
