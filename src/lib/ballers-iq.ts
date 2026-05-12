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
import { gateBallersIQ as _gateBallersIQ } from "./ballers-iq/quality";
import { normalizePlayerHealth, isHealthUnavailable, isHealthRisky, getHealthLabel } from "@/lib/health";
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

  // Lineup Pulse — context-sensitive snapshot card placed next to Captain Edge
  if (rosterPlayers.length) {
    const totalSalary = rosterPlayers.reduce((s, x) => s + num(x.p.salary), 0);
    const avgFp5 = rosterPlayers.reduce((s, x) => s + num(x.p.fp_pg5), 0) / rosterPlayers.length;
    const totalStocks5 = rosterPlayers.reduce((s, x) => s + num(x.p.stl5) + num(x.p.blk5), 0);
    const fcCount = rosterPlayers.filter((x) => (x.p.fc_bc ?? "").toUpperCase() === "FC").length;
    const bcCount = rosterPlayers.length - fcCount;
    const startersFp5 = starters.reduce((s, x) => s + num(x.p.fp_pg5), 0);
    const benchFp5 = bench.reduce((s, x) => s + num(x.p.fp_pg5), 0);
    const benchPressure = bench.length
      ? benchFp5 / bench.length - startersFp5 / Math.max(1, starters.length)
      : 0;
    const headline =
      benchPressure > 2
        ? "Bench is outscoring your starters."
        : avgFp5 >= 22
          ? "Roster running hot — keep it locked."
          : avgFp5 >= 16
            ? "Solid baseline — small tweaks possible."
            : "Roster baseline is light — look for upgrades.";
    insights.push({
      type: "LINEUP",
      title: "Lineup Pulse",
      headline,
      bullets: [
        `Avg FP5 ${avgFp5.toFixed(1)} across ${rosterPlayers.length} players.`,
        `Cap used $${totalSalary.toFixed(1)}M · ${fcCount} FC / ${bcCount} BC.`,
        `Stocks5 total ${totalStocks5.toFixed(1)} — ${totalStocks5 >= 12 ? "high defensive ceiling" : "defensive output is modest"}.`,
      ],
      playerIds: [],
      confidence: 0.6,
      action: benchPressure > 2 ? "START" : "HOLD",
      riskLevel: avgFp5 < 14 ? "MEDIUM" : "LOW",
    });
  }

  // Risk Radar — starters with injury, no game tonight, or sliding minutes
  const risky = starters.filter((x) => {
    const _h = normalizePlayerHealth(x.p);
    const hasInjury = isHealthUnavailable(_h) || isHealthRisky(_h);
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
        const _h = normalizePlayerHealth(x.p);
        if (isHealthUnavailable(_h) || isHealthRisky(_h))
          return `${x.p.name}: ${getHealthLabel(_h)}.`;
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
  const _ph = normalizePlayerHealth(p);
  const hasInjury = isHealthUnavailable(_ph) || isHealthRisky(_ph);

  let action: BallersIQAction = "HOLD";
  let risk: BallersIQRisk = "LOW";
  let headline = "";
  let confidence = 0.6;

  if (hasInjury) {
    action = "BENCH";
    risk = "HIGH";
    headline = `${getHealthLabel(_ph)} — manage exposure.`;
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
  const captain = captainId ? players.find((p) => p.id === captainId) : null;

  // Optional rich day-level data: { player_id, fp, mp, salary, is_starter, is_captain, captain_bonus, result_wl, opp }
  const dayPlayers: any[] = Array.isArray(recap?.dayPlayers) ? recap.dayPlayers : [];
  const byId = new Map<number, any>(dayPlayers.map((d) => [d.player_id, d]));

  // Build merged view: prefer day-level FP/MP; fall back to fp_pg5 if absent.
  type Merged = BIQPlayer & {
    dayFp: number; dayMp: number; daySal: number;
    starter: boolean; captainHere: boolean; captainBonus: number;
    result?: string | null;
  };
  const merged: Merged[] = rosterPlayers.map((p) => {
    const d = byId.get(p.id) ?? {};
    const slot = roster.find((r) => r.player_id === p.id)?.slot ?? "";
    return {
      ...p,
      dayFp: num(d.fp, num(p.fp_pg5)),
      dayMp: num(d.mp, num(p.mpg5)),
      daySal: num(d.salary, num(p.salary)),
      starter: typeof d.is_starter === "boolean" ? d.is_starter : isStarter(slot),
      captainHere: !!d.is_captain || captainId === p.id,
      captainBonus: num(d.captain_bonus),
      result: d.result_wl ?? null,
    };
  });

  const startersM = merged.filter((m) => m.starter);
  const benchM = merged.filter((m) => !m.starter);

  const top = [...merged].sort((a, b) => b.dayFp - a.dayFp)[0];
  const weak = [...startersM].filter((m) => m.dayFp >= 0).sort((a, b) => a.dayFp - b.dayFp)[0];

  const totalScore = num(recap?.total_fp);
  const wins = merged.filter((m) => m.result === "W").length;
  const losses = merged.filter((m) => m.result === "L").length;
  const recordSegment = wins + losses ? ` · roster went ${wins}-${losses}.` : ".";
  const summary = totalScore
    ? `Day total ${totalScore.toFixed(1)} FP${top ? ` — ${top.name} led with ${top.dayFp.toFixed(1)}` : ""}${recordSegment}`
    : top
      ? `${top.name} led the roster on FP5.`
      : "Recap unavailable.";

  const insights: BallersIQInsight[] = [];

  // Best Call
  if (top) {
    const valTxt = top.daySal > 0 ? ` · $${top.daySal.toFixed(1)}M` : "";
    const mpTxt = top.dayMp > 0 ? ` in ${top.dayMp.toFixed(0)}'` : "";
    insights.push({
      type: "RECAP",
      title: "Best Call",
      headline: `${top.name} delivered ${top.dayFp.toFixed(1)} FP${mpTxt}.`,
      bullets: [
        `Top of the roster${valTxt}${top.captainHere ? " · wore the armband" : ""}.`,
      ],
      playerIds: [top.id],
      confidence: 0.75,
      action: null,
      riskLevel: "LOW",
    });
  }

  // Weak Spot — starter who underperformed expectation
  if (weak && top && weak.id !== top.id && weak.dayFp < num(weak.fp_pg5) - 3) {
    const expected = num(weak.fp_pg5);
    insights.push({
      type: "RECAP",
      title: "Weak Spot",
      headline: `${weak.name} fell short — ${weak.dayFp.toFixed(1)} FP vs ${expected.toFixed(1)} expected.`,
      bullets: [
        weak.dayMp > 0 ? `Played ${weak.dayMp.toFixed(0)}' but couldn't convert.` : `Limited minutes weighed on the line.`,
      ],
      playerIds: [weak.id],
      confidence: 0.6,
      action: "WATCH",
      riskLevel: "MEDIUM",
    });
  }

  // Difficulty-Adjusted MVP — best FP/$ on the day
  const valued = merged.filter((m) => m.dayFp > 0 && m.daySal > 0);
  if (valued.length) {
    const mvp = [...valued].sort((a, b) => b.dayFp / b.daySal - a.dayFp / a.daySal)[0];
    if (mvp && (!top || mvp.id !== top.id)) {
      const ratio = mvp.dayFp / mvp.daySal;
      insights.push({
        type: "RECAP",
        title: "Adj. MVP",
        headline: `${mvp.name} returned ${ratio.toFixed(1)} FP per $M.`,
        bullets: [`${mvp.dayFp.toFixed(1)} FP at $${mvp.daySal.toFixed(1)}M — best efficiency on the slate.`],
        playerIds: [mvp.id],
        confidence: 0.55,
        action: "HOLD",
        riskLevel: "LOW",
      });
    }
  }

  // Captain edge missed
  if (captain && top && captain.id !== top.id) {
    const capDayFp = byId.get(captain.id)?.fp;
    const headline = capDayFp != null
      ? `Captain bonus on ${top.name} would have added ~${(top.dayFp - num(capDayFp)).toFixed(1)} FP.`
      : `Captain bonus would have been bigger on ${top.name}.`;
    insights.push({
      type: "RECAP",
      title: "Missed Edge",
      headline,
      bullets: [
        `Armband on ${captain.name}${capDayFp != null ? ` (${num(capDayFp).toFixed(1)} FP today)` : ""}.`,
        `${top.name} delivered ${top.dayFp.toFixed(1)} FP.`,
      ],
      playerIds: [captain.id, top.id],
      confidence: 0.6,
      action: "CAPTAIN",
      riskLevel: "MEDIUM",
    });
  }

  // Bench Opportunity Cost — biggest day-FP swap missed
  if (startersM.length && benchM.length) {
    const worstStarter = [...startersM].sort((a, b) => a.dayFp - b.dayFp)[0];
    const bestBench = [...benchM].sort((a, b) => b.dayFp - a.dayFp)[0];
    const delta = bestBench.dayFp - worstStarter.dayFp;
    if (delta >= 5) {
      insights.push({
        type: "RECAP",
        title: "Bench Cost",
        headline: `Starting ${bestBench.name} over ${worstStarter.name} would have added ${delta.toFixed(1)} FP.`,
        bullets: [
          `${bestBench.name} (bench) ${bestBench.dayFp.toFixed(1)} FP vs ${worstStarter.name} ${worstStarter.dayFp.toFixed(1)} FP.`,
        ],
        playerIds: [bestBench.id, worstStarter.id],
        confidence: 0.6,
        action: "START",
        riskLevel: "MEDIUM",
      });
    }
  }

  // Next Move — promote a hot bench piece for next slate
  const benchHot = [...benchM].sort((a, b) => num(b.fp_pg5) - num(a.fp_pg5))[0];
  if (benchHot && num(benchHot.fp_pg5) >= num(top?.fp_pg5 ?? 0) * 0.7) {
    insights.push({
      type: "RECAP",
      title: "Next Move",
      headline: `Promote ${benchHot.name} for the next slate.`,
      bullets: [
        `Bench FP5 ${num(benchHot.fp_pg5).toFixed(1)} — close to your top starter's form.`,
      ],
      playerIds: [benchHot.id],
      confidence: 0.55,
      action: "START",
      riskLevel: "LOW",
    });
  }

  // Always produce a context card if room remains.
  if (insights.length < 3 && rosterPlayers.length) {
    const stocksKing = [...rosterPlayers].sort(
      (a, b) => (num(b.stl5) + num(b.blk5)) - (num(a.stl5) + num(a.blk5))
    )[0];
    const stocks = num(stocksKing?.stl5) + num(stocksKing?.blk5);
    if (stocksKing && stocks >= 1) {
      insights.push({
        type: "RECAP",
        title: "Defensive MVP",
        headline: `${stocksKing.name} carried the defense.`,
        bullets: [
          `Stocks5 ${stocks.toFixed(1)} (STL ${num(stocksKing.stl5).toFixed(1)} · BLK ${num(stocksKing.blk5).toFixed(1)}).`,
          `FP5 ${num(stocksKing.fp_pg5).toFixed(1)} — defensive upside priced in.`,
        ],
        playerIds: [stocksKing.id],
        confidence: 0.55,
        action: "HOLD",
        riskLevel: "LOW",
      });
    } else {
      // Fallback: form mover
      const mover = [...rosterPlayers].sort((a, b) => num(b.delta_fp) - num(a.delta_fp))[0];
      if (mover) {
        insights.push({
          type: "RECAP",
          title: "Trend Watch",
          headline: `${mover.name} is trending ${num(mover.delta_fp) >= 0 ? "up" : "down"}.`,
          bullets: [`Δ FP ${num(mover.delta_fp) >= 0 ? "+" : ""}${num(mover.delta_fp).toFixed(1)} vs season.`],
          playerIds: [mover.id],
          confidence: 0.5,
          action: "WATCH",
          riskLevel: "LOW",
        });
      }
    }
  }

  return { summary, insights };
}

// ---------- entry ----------

export function getBallersIQInsights(
  context: BallersIQContext,
  payload: BIQPayload
): BallersIQResponse {
  let raw: BallersIQResponse;
  switch (context) {
    case "lineup":
      raw = buildLineupInsights(payload); break;
    case "player":
      raw = buildPlayerInsights(payload); break;
    case "game_night":
      raw = buildGameNightInsights(payload); break;
    case "recap":
      raw = buildRecapInsights(payload); break;
    default:
      raw = { summary: "", insights: [] };
  }
  return _gateBallersIQ(raw);
}