-- 1. Set NBA Main League sport
UPDATE public.leagues SET sport='nba' WHERE id='00000000-0000-0000-0000-000000000010' AND sport IS NULL;

-- 2. Create WNBA scoring system mirroring NBA Classic
INSERT INTO public.scoring_systems (id, code, name, sport, is_active, is_template)
VALUES ('00000000-0000-0000-0000-000000000002', 'wnba_classic', 'WNBA Classic', 'wnba', true, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Mirror scoring rules for WNBA system
INSERT INTO public.scoring_rules (scoring_system_id, stat_key, rule_type, weight, applies_to, sort_order, is_active)
SELECT '00000000-0000-0000-0000-000000000002', stat_key, rule_type, weight, applies_to, sort_order, is_active
FROM public.scoring_rules
WHERE scoring_system_id='00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.scoring_rules r2
    WHERE r2.scoring_system_id='00000000-0000-0000-0000-000000000002'
  );

-- 4. Insert WNBA Main League
INSERT INTO public.leagues (
  id, code, name, kind, sport, status, visibility, owner_id,
  scoring_system_id, roster_rule_set_id, deadline_rule_set_id, chip_rule_set_id,
  transfer_cap, max_teams, is_active
) VALUES (
  '00000000-0000-0000-0000-000000000020', 'main_wnba', 'Main League', 'fantasy', 'wnba', 'active', 'private', NULL,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0003-000000000001',
  2, 20, true
) ON CONFLICT (id) DO NOTHING;