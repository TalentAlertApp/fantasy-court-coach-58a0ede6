/**
 * Deadline helpers shared by edge functions.
 *
 * Resolves the league's deadline_rule_set_id and reports whether the lineup
 * is locked / transfers are allowed for a given team. Returns plain values
 * (no exceptions) so call sites can short-circuit cleanly.
 */

export type DeadlineCheck = { locked: boolean; reason: string | null; nextDeadline: string | null };
export type TransferCheck = { allowed: boolean; reason: string | null; nextDeadline: string | null };

type DeadlineRuleSet = {
  deadline_type: string;
  timezone: string;
  fixed_time: string | null;
  fixed_weekday: number | null;
  minutes_before_game: number;
};

type LeagueRow = {
  id: string;
  status: string;
  deadline_rule_set_id: string | null;
};

type TeamRow = {
  league_id: string | null;
  sport_league_id: string | null;
};

async function loadContext(sb: any, teamId: string): Promise<{
  team: TeamRow | null;
  league: LeagueRow | null;
  ruleSet: DeadlineRuleSet | null;
}> {
  const { data: team } = await sb
    .from("teams")
    .select("league_id, sport_league_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team?.league_id) return { team: team ?? null, league: null, ruleSet: null };

  const { data: league } = await sb
    .from("leagues")
    .select("id, status, deadline_rule_set_id")
    .eq("id", team.league_id)
    .maybeSingle();
  if (!league) return { team, league: null, ruleSet: null };

  let ruleSet: DeadlineRuleSet | null = null;
  if (league.deadline_rule_set_id) {
    const { data } = await sb
      .from("deadline_rule_sets")
      .select("deadline_type, timezone, fixed_time, fixed_weekday, minutes_before_game")
      .eq("id", league.deadline_rule_set_id)
      .maybeSingle();
    ruleSet = data ?? null;
  }
  return { team, league, ruleSet };
}

async function earliestTipoffToday(
  sb: any,
  sportLeagueId: string,
  now: Date,
): Promise<Date | null> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data } = await sb
    .from("schedule_games")
    .select("tipoff_utc, status")
    .eq("league_id", sportLeagueId)
    .gte("tipoff_utc", dayStart.toISOString())
    .lt("tipoff_utc", dayEnd.toISOString())
    .not("status", "in", "(FINAL,PPD)")
    .order("tipoff_utc", { ascending: true })
    .limit(1);

  const row = (data ?? [])[0];
  if (!row?.tipoff_utc) return null;
  return new Date(row.tipoff_utc);
}

function fmtTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export async function isLineupLocked(
  sb: any,
  teamId: string,
  now: Date = new Date(),
): Promise<DeadlineCheck> {
  const { team, league, ruleSet } = await loadContext(sb, teamId);
  if (!team || !league) return { locked: false, reason: null, nextDeadline: null };

  const type = ruleSet?.deadline_type ?? "first_game_of_day";

  if (type === "manual") {
    const locked = league.status === "archived";
    return { locked, reason: locked ? "League archived." : null, nextDeadline: null };
  }

  if (type === "per_player_game_lock") {
    return { locked: false, reason: null, nextDeadline: null };
  }

  // first_game_of_day (default)
  if (!team.sport_league_id) return { locked: false, reason: null, nextDeadline: null };
  const tipoff = await earliestTipoffToday(sb, team.sport_league_id, now);
  if (!tipoff) return { locked: false, reason: null, nextDeadline: null };

  const offsetMs = (ruleSet?.minutes_before_game ?? 0) * 60_000;
  const deadline = new Date(tipoff.getTime() - offsetMs);
  const locked = deadline.getTime() <= now.getTime();
  return {
    locked,
    reason: locked ? `Lineup locked — first game started at ${fmtTime(tipoff)}.` : null,
    nextDeadline: deadline.toISOString(),
  };
}

export async function canTransfer(
  sb: any,
  teamId: string,
  now: Date = new Date(),
): Promise<TransferCheck> {
  const { team, league, ruleSet } = await loadContext(sb, teamId);
  if (!team || !league) return { allowed: true, reason: null, nextDeadline: null };

  const type = ruleSet?.deadline_type ?? "first_game_of_day";

  if (type === "manual") {
    const allowed = league.status !== "archived";
    return { allowed, reason: allowed ? null : "League archived — transfers closed.", nextDeadline: null };
  }

  if (type === "per_player_game_lock") {
    // Per-player locking is enforced separately at the row level by the caller.
    return { allowed: true, reason: null, nextDeadline: null };
  }

  if (!team.sport_league_id) return { allowed: true, reason: null, nextDeadline: null };
  const tipoff = await earliestTipoffToday(sb, team.sport_league_id, now);
  if (!tipoff) return { allowed: true, reason: null, nextDeadline: null };

  const offsetMs = (ruleSet?.minutes_before_game ?? 0) * 60_000;
  const deadline = new Date(tipoff.getTime() - offsetMs);
  const allowed = deadline.getTime() > now.getTime();
  return {
    allowed,
    reason: allowed ? null : `Transfers locked — first game started at ${fmtTime(tipoff)}.`,
    nextDeadline: deadline.toISOString(),
  };
}