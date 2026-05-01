/**
 * Ballers.IQ — deterministic AI insight layer (v1, mockable).
 *
 * Pure functions over already-loaded app data (players, roster, schedule, recap).
 * No fabricated injuries / news. If a signal is missing we just say less.
 *
 * A future v2 can swap `getBallersIQInsights` to call the existing `ai-coach`
 * edge function and reshape the JSON to match this same schema — the UI layer
 * doesn't need to change.
 */

export type BallersIQContext = "lineup" | "player" | "game_night" | "recap";
export type BallersIQAction =
  | "START" | "BENCH" | "CAPTAIN" | "ADD" | "DROP" | "WATCH" | "HOLD" | null;
export type BallersIQRisk = "LOW" | "MEDIUM" | "HIGH" | null;
export type BallersIQInsightType =
  | "CAPTAIN" | "LINEUP" | "PLAYER" | "GAME"
  | "RECAP" | "RISK" | "VALUE" | "FORM" | "MARKET";

export interface BallersIQInsight {
  type: BallersIQInsightType;
  title: string;
  headline: string;
  bullets: string[];
  playerIds: number[];
  confidence: number; // 0..1
  action: BallersIQAction;
  riskLevel: BallersIQRisk;
}

export interface BallersIQResponse {
  summary: string;
  insights: BallersIQInsight[];
}

// ---------- light-weight types (we only read these fields) ----------

export interface BIQPlayer {
  id: number;
  name: string;
  team?: string | null;
  fc_bc?: string | null;
  salary?: number | null;
  fp_pg5?: number | null;
  fp_pg_t?: number | null;
  value5?: number | null;
  mpg?: number | null;
  mpg5?: number | null;
  stl5?: number | null;
  blk5?: number | null;
  ast5?: number | null;
  delta_fp?: number | null;
  delta_mpg?: number | null;
  injury?: string | null;
}

export interface BIQRosterSlot {
  player_id: number;
  slot: string; // "S1".."S5" or "B1".."B5"
  is_captain?: boolean;
}

export interface BIQScheduleGame {
  game_id: string;
  gw: number;
  day: number;
  away_team: string;
  home_team: string;
  status?: string;
  tipoff_utc?: string | null;
}

export interface BIQPayload {
  players?: BIQPlayer[];
  roster?: BIQRosterSlot[];
  schedule?: BIQScheduleGame[];
  player?: BIQPlayer | null;
  recap?: any;
  todayTeams?: string[]; // tricodes playing tonight
}

// ---------- helpers ----------

const num = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

const isStarter = (slot: string) => /^S/i.test(slot);

function joinPlayers(p: Pick<BIQPlayer, "name">[]): string {
  if (!p.length) return "";
  if (p.length === 1) return p[0].name;
  if (p.length === 2) return `${p[0].name} & ${p[1].name}`;
  return `${p[0].name}, ${p[1].name} +${p.length - 2}`;
}

// ---------- LINEUP ----------

function buildLineupInsights(payload: BIQPayload): BallersIQResponse {
  const players = payload.players ?? [];
  const roster = payload.roster ?? [];
  const todayTeams = new Set((payload.todayTeams ?? []).map((t) => t.toUpperCase()));

  const byId = new Map<number, BIQPlayer>(players.map((p) => [p.id, p]));
  const rosterPlayers = roster
    .map((r) => ({ slot: r.slot, is_captain: !!r.is_captain, p: byId.get(r.player_id) }))
    .filter((x): x is { slot: string; is_captain: boolean; p: BIQPlayer } => !!x.p);

  const starters = rosterPlayers.filter((x) => isStarter(x.slot));
  const bench = rosterPlayers.filter((x) => !isStarter(x.slot));

  const insights: BallersIQInsight[] = [];

  // Captain Edge — highest fp_pg5 starter
  if (starters.length) {
    const ranked = [...starters].sort(
      (a, b) => num(b.p.fp_pg5) - num(a.p.fp_pg5)
    );
    const top = ranked[0];
    const second = ranked[1];
    const gap = top && second ? num(top.p.fp_pg5) - num(second.p.fp_pg5) : 0;
    const confidence = Math.max(0.55, Math.min(0.95, 0.6 + gap / 30));
    insights.push({
      type: "CAPTAIN",
      title: "Captain Edge",
      headline: `${top.p.name} is your safest captain.`,
      bullets: [
        `Best FP5 on the roster (${num(top.p.fp_pg5).toFixed(1)}).`,
        second
          ? `Edge of ${gap.toFixed(1)} over ${second.p.name}.`
          : "Clear top fantasy option this week.",
        top.is_captain ? "Already armbanded — hold." : "Switch the armband to lock the bonus.",
      ],
      playerIds: [top.p.id],
      confidence,
      action: "CAPTAIN",
      riskLevel: "LOW",
    });
  }

  // Risk Radar — starters with injury, no game tonight, or sliding minutes
  const risky = starters.filter((x) => {
    const hasInjury = !!x.p.injury && x.p.injury.toUpperCase() !== "ACTIVE";
    const noGame = todayTeams.size > 0 && x.p.team
      ? !todayTeams.has(String(x.p.team).toUpperCase())
      : false;
    const minutesSlip = num(x.p.delta_mpg) <= -3;
    return hasInjury || noGame || minutesSlip;
  });
  if (risky.length) {
    insights.push({
      type: "RISK",
      title: "Risk Radar",
      headline:
        risky.length === 1
          ? `${risky[0].p.name} is a lineup risk tonight.`
          : `${risky.length} starters carry risk tonight.`,
      bullets: risky.slice(0, 3).map((x) => {
        if (x.p.injury && x.p.injury.toUpperCase() !== "ACTIVE")
          return `${x.p.name}: ${x.p.injury}.`;
        if (todayTeams.size && x.p.team && !todayTeams.has(String(x.p.team).toUpperCase()))
          return `${x.p.name}: no game tonight.`;
        return `${x.p.name}: minutes sliding (${num(x.p.delta_mpg).toFixed(1)} MPG).`;
      }),
      playerIds: risky.map((x) => x.p.id),
      confidence: 0.7,
      action: "BENCH",
      riskLevel: risky.length >= 2 ? "HIGH" : "MEDIUM",
    });
  }

  // Value Pick — best value5 on the bench
  if (bench.length) {
    const valuePick = [...bench]
      .filter((x) => num(x.p.value5) > 0)
      .sort((a, b) => num(b.p.value5) - num(a.p.value5))[0];
    if (valuePick) {
      insights.push({
        type: "VALUE",
        title: "Value Pick",
        headline: `${valuePick.p.name} is your best bench value.`,
        bullets: [
          `Value5 ${num(valuePick.p.value5).toFixed(2)} per $M.`,
          `${num(valuePick.p.fp_pg5).toFixed(1)} FP5 at $${num(valuePick.p.salary).toFixed(1)}M.`,
          "Consider promoting if a starter is risky.",
        ],
        playerIds: [valuePick.p.id],
        confidence: 0.65,
        action: "START",
        riskLevel: "LOW",
      });
    }
  }

  // Form Spike — biggest delta_fp on roster
  const trending = [...rosterPlayers]
    .filter((x) => num(x.p.delta_fp) >= 4)
    .sort((a, b) => num(b.p.delta_fp) - num(a.p.delta_fp))[0];
  if (trending) {
    insights.push({
      type: "FORM",
      title: "Form Spike",
      headline: `${trending.p.name} is heating up.`,
      bullets: [
        `Δ FP +${num(trending.p.delta_fp).toFixed(1)} over baseline.`,
        `FP5 now ${num(trending.p.fp_pg5).toFixed(1)}.`,
      ],
      playerIds: [trending.p.id],
      confidence: 0.6,
      action: isStarter(rosterPlayers.find((x) => x.p.id === trending.p.id)!.slot)
        ? "HOLD"
        : "START",
      riskLevel: "LOW",
    });
  }

  const summary = starters.length
    ? `${starters.length} starters set. ${insights.length} signals worth noting.`
    : "No roster loaded yet.";

  return { summary, insights };
}

// ---------- PLAYER ----------

function buildPlayerInsights(payload: BIQPayload): BallersIQResponse {
  const p = payload.player;
  if (!p) return { summary: "", insights: [] };

  const dFp = num(p.delta_fp);
  const dMpg = num(p.delta_mpg);
  const fp5 = num(p.fp_pg5);
  const value5 = num(p.value5);
  const hasInjury = !!p.injury && p.injury.toUpperCase() !== "ACTIVE";

  let action: BallersIQAction = "HOLD";
  let risk: BallersIQRisk = "LOW";
  let headline = "";
  let confidence = 0.6;

  if (hasInjury) {
    action = "BENCH";
    risk = "HIGH";
    headline = `${p.injury} — manage exposure.`;
    confidence = 0.8;
  } else if (dFp >= 4 && dMpg >= 0) {
    action = "START";
    risk = "LOW";
    headline = `Form is up; minutes stable.`;
    confidence = 0.75;
  } else if (dFp <= -4 || dMpg <= -4) {
    action = "BENCH";
    risk = "MEDIUM";
    headline = `Cooling off — bench until role stabilises.`;
    confidence = 0.65;
  } else if (value5 >= 1.2) {
    action = "WATCH";
    risk = "LOW";
    headline = `Strong value at $${num(p.salary).toFixed(1)}M.`;
    confidence = 0.6;
  } else {
    action = "HOLD";
    risk = "LOW";
    headline = "Steady role — no change recommended.";
    confidence = 0.55;
  }

  const bullets: string[] = [];
  bullets.push(`FP5 ${fp5.toFixed(1)} · MPG5 ${num(p.mpg5).toFixed(1)}.`);
  if (Math.abs(dFp) >= 1)
    bullets.push(`Δ FP ${dFp >= 0 ? "+" : ""}${dFp.toFixed(1)} vs season.`);
  if (Math.abs(dMpg) >= 1)
    bullets.push(`Δ MPG ${dMpg >= 0 ? "+" : ""}${dMpg.toFixed(1)}.`);
  const stocks = num(p.stl5) + num(p.blk5);
  if (stocks >= 2) bullets.push(`Stocks ${stocks.toFixed(1)} per game (high impact).`);
  if (value5 > 0) bullets.push(`Value5 ${value5.toFixed(2)} per $M.`);

  return {
    summary: headline,
    insights: [
      {
        type: "PLAYER",
        title: "Player Verdict",
        headline,
        bullets: bullets.slice(0, 4),
        playerIds: [p.id],
        confidence,
        action,
        riskLevel: risk,
      },
    ],
  };
}

// ---------- GAME NIGHT ----------

function buildGameNightInsights(payload: BIQPayload): BallersIQResponse {
  const games = payload.schedule ?? [];
  const players = payload.players ?? [];
  const roster = payload.roster ?? [];

  const rosterIds = new Set(roster.map((r) => r.player_id));
  const rosterPlayers = players.filter((p) => rosterIds.has(p.id));
  const playingTeams = new Set<string>();
  games.forEach((g) => {
    playingTeams.add(g.away_team.toUpperCase());
    playingTeams.add(g.home_team.toUpperCase());
  });

  const active = rosterPlayers.filter((p) =>
    p.team ? playingTeams.has(String(p.team).toUpperCase()) : false
  );
  const idle = rosterPlayers.filter(
    (p) => p.team && !playingTeams.has(String(p.team).toUpperCase())
  );

  const insights: BallersIQInsight[] = [];

  if (rosterPlayers.length) {
    insights.push({
      type: "GAME",
      title: "Tonight's Edge",
      headline:
        active.length >= rosterPlayers.length / 2
          ? `High-ceiling night: ${active.length} of your players in action.`
          : `Light night: only ${active.length} of your players in action.`,
      bullets: [
        `${games.length} games on the slate.`,
        active.length
          ? `Active: ${joinPlayers(active.slice(0, 4))}.`
          : "No roster players in action tonight.",
      ],
      playerIds: active.map((p) => p.id),
      confidence: 0.6,
      action: null,
      riskLevel: active.length === 0 ? "MEDIUM" : "LOW",
    });
  }

  if (idle.length) {
    const starters = idle.filter((p) => {
      const slot = roster.find((r) => r.player_id === p.id)?.slot ?? "";
      return isStarter(slot);
    });
    if (starters.length) {
      insights.push({
        type: "RISK",
        title: "Bench Risk",
        headline: `${starters.length} starter${starters.length > 1 ? "s" : ""} have no game tonight.`,
        bullets: starters.slice(0, 3).map((p) => `${p.name} (${p.team}) — idle.`),
        playerIds: starters.map((p) => p.id),
        confidence: 0.85,
        action: "BENCH",
        riskLevel: "MEDIUM",
      });
    }
  }

  return {
    summary: `${games.length} games · ${active.length}/${rosterPlayers.length} of your roster active.`,
    insights,
  };
}

// ---------- RECAP ----------

function buildRecapInsights(payload: BIQPayload): BallersIQResponse {
  const players = payload.players ?? [];
  const roster = payload.roster ?? [];
  const recap = payload.recap ?? null;

  const rosterIds = new Set(roster.map((r) => r.player_id));
  const captainId = roster.find((r) => r.is_captain)?.player_id;

  const rosterPlayers = players.filter((p) => rosterIds.has(p.id));
  const top = [...rosterPlayers].sort((a, b) => num(b.fp_pg5) - num(a.fp_pg5))[0];
  const captain = captainId ? players.find((p) => p.id === captainId) : null;
  const benchMissed = rosterPlayers
    .filter((p) => {
      const slot = roster.find((r) => r.player_id === p.id)?.slot ?? "";
      return !isStarter(slot);
    })
    .sort((a, b) => num(b.fp_pg5) - num(a.fp_pg5))[0];

  const totalScore = num(recap?.total_fp);
  const summary = totalScore
    ? `Gameweek total: ${totalScore.toFixed(1)} FP. Captain bonus + stocks carried the load.`
    : top
      ? `${top.name} led the roster on FP5.`
      : "Recap unavailable.";

  const insights: BallersIQInsight[] = [];

  if (top) {
    insights.push({
      type: "RECAP",
      title: "Best Call",
      headline: `${top.name} delivered.`,
      bullets: [`FP5 ${num(top.fp_pg5).toFixed(1)} — top of the roster.`],
      playerIds: [top.id],
      confidence: 0.7,
      action: null,
      riskLevel: "LOW",
    });
  }
  if (captain && top && captain.id !== top.id) {
    insights.push({
      type: "RECAP",
      title: "Missed Edge",
      headline: `Captain bonus would have been bigger on ${top.name}.`,
      bullets: [
        `Armband on ${captain.name} (${num(captain.fp_pg5).toFixed(1)} FP5).`,
        `${top.name} sits at ${num(top.fp_pg5).toFixed(1)} FP5.`,
      ],
      playerIds: [captain.id, top.id],
      confidence: 0.6,
      action: "CAPTAIN",
      riskLevel: "MEDIUM",
    });
  }
  if (benchMissed && num(benchMissed.fp_pg5) >= num(top?.fp_pg5 ?? 0) * 0.7) {
    insights.push({
      type: "RECAP",
      title: "Next Move",
      headline: `Promote ${benchMissed.name} from the bench.`,
      bullets: [
        `Bench FP5 ${num(benchMissed.fp_pg5).toFixed(1)} — close to your top starter.`,
      ],
      playerIds: [benchMissed.id],
      confidence: 0.55,
      action: "START",
      riskLevel: "LOW",
    });
  }

  return { summary, insights };
}

// ---------- entry ----------

export function getBallersIQInsights(
  context: BallersIQContext,
  payload: BIQPayload
): BallersIQResponse {
  switch (context) {
    case "lineup":
      return buildLineupInsights(payload);
    case "player":
      return buildPlayerInsights(payload);
    case "game_night":
      return buildGameNightInsights(payload);
    case "recap":
      return buildRecapInsights(payload);
    default:
      return { summary: "", insights: [] };
  }
}