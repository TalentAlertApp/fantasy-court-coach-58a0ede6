
-- Remove the orphan empty clone
DELETE FROM public.team_leagues WHERE team_id = '97ba00c6-f367-4320-8c0d-271dd4def734';
DELETE FROM public.roster        WHERE team_id = '97ba00c6-f367-4320-8c0d-271dd4def734';
DELETE FROM public.team_chips    WHERE team_id = '97ba00c6-f367-4320-8c0d-271dd4def734';
DELETE FROM public.team_settings WHERE team_id = '97ba00c6-f367-4320-8c0d-271dd4def734';
DELETE FROM public.transactions  WHERE team_id = '97ba00c6-f367-4320-8c0d-271dd4def734';
DELETE FROM public.teams         WHERE id = '97ba00c6-f367-4320-8c0d-271dd4def734';

-- Attach the real (rostered) team to the custom league
INSERT INTO public.team_leagues (team_id, league_id)
VALUES ('cf98e5c4-5723-41cd-bc02-0c8038488a2f', '052e9270-a60b-48c0-96c6-c2ae4820830a')
ON CONFLICT DO NOTHING;
