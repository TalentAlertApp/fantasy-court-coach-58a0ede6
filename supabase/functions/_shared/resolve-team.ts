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
      .single();
    if (error || !data) throw new Error(`Team not found: ${teamId}`);
    return { team_id: (data as any).id, team_name: (data as any).name };
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
