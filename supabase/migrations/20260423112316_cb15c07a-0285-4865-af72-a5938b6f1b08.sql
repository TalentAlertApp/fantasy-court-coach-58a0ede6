-- Seed the Captain bonus rule (2x multiplier) into the active scoring system.
-- The shared scoring helper already honors applies_to='captain' multipliers.
INSERT INTO public.scoring_rules
  (scoring_system_id, stat_key, rule_type, weight, applies_to, sort_order, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'captain_multiplier', 'multiplier', 2, 'captain', 100, true)
ON CONFLICT (scoring_system_id, stat_key, applies_to) DO UPDATE
  SET weight = EXCLUDED.weight,
      rule_type = EXCLUDED.rule_type,
      is_active = EXCLUDED.is_active,
      updated_at = now();