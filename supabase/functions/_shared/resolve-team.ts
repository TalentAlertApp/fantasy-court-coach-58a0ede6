/**
 * Resolve team_id from: query param > header > default (first team by created_at).
 * Returns { team_id, team_name } or throws.
 */
export async function resolveTeam(
  req: Request,
  sb: any
): Promise<{ team_id: string; team_name: string }> {
  const url = new URL(req.url);
  let teamId = url.searchParams.get("team_id") || req.headers.get("x-team-id");

  if (teamId) {
    const { data, error } = await sb
      .from("teams")
      .select("id, name")
      .eq("id", teamId)
      .maybeSingle();
    if (!error && data) {
      return { team_id: (data as any).id, team_name: (data as any).name };
    }
    // Stale team_id (e.g. team was deleted but localStorage still references it).
    // Fall through to default-team resolution rather than 500'ing the caller.
    console.warn(`[resolveTeam] team_id ${teamId} not found — falling back to default team`);
  }

  // Default: earliest created team
  const { data, error } = await sb
    .from("teams")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error("No teams exist");
  return { team_id: (data as any).id, team_name: (data as any).name };
}
