DROP POLICY IF EXISTS "scoring_systems: public read" ON public.scoring_systems;
CREATE POLICY "scoring_systems: read templates or own"
ON public.scoring_systems FOR SELECT
USING (is_template = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "scoring_rules: public read" ON public.scoring_rules;
CREATE POLICY "scoring_rules: read templates or own systems"
ON public.scoring_rules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.scoring_systems s
    WHERE s.id = scoring_rules.scoring_system_id
      AND (s.is_template = true OR s.owner_id = auth.uid())
  )
);