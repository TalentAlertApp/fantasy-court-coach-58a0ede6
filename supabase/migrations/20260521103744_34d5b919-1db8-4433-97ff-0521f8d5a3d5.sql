
CREATE OR REPLACE FUNCTION public.get_league_teams(_league_id uuid)
 RETURNS TABLE(id uuid, name text, league_id uuid, created_at timestamp with time zone, owner_id uuid, owner_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.league_id, t.created_at, t.owner_id,
         split_part(coalesce(u.email, 'user'), '@', 1) as owner_label
  from public.team_leagues tl
  join public.teams t on t.id = tl.team_id
  left join auth.users u on u.id = t.owner_id
  where tl.league_id = _league_id
$function$;
