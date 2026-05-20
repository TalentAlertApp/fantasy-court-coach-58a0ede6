ALTER TABLE public.roster ADD COLUMN IF NOT EXISTS acquired_salary numeric(6,2);

UPDATE public.roster r
SET acquired_salary = COALESCE(p.salary, 0)
FROM public.players p
WHERE r.player_id = p.id AND r.acquired_salary IS NULL;

UPDATE public.roster SET acquired_salary = 0 WHERE acquired_salary IS NULL;

ALTER TABLE public.roster ALTER COLUMN acquired_salary SET NOT NULL;
ALTER TABLE public.roster ALTER COLUMN acquired_salary SET DEFAULT 0;