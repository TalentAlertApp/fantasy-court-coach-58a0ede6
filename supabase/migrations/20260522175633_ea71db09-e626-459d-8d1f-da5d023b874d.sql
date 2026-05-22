UPDATE public.leagues
SET
  roster_rule_set_id   = '00000000-0000-0000-0001-000000000001',
  deadline_rule_set_id = '00000000-0000-0000-0002-000000000001',
  chip_rule_set_id     = '00000000-0000-0000-0003-000000000001',
  visibility           = 'public',
  status               = 'active',
  is_active            = true
WHERE code = 'main_euroleague';