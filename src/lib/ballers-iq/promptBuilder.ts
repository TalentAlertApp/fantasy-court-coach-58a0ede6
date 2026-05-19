/**
 * Ballers.IQ — compact index packs designed to be injected into the
 * AI Coach developer message. Each builder is pure and returns a small
 * JSON-friendly object capped to keep the prompt tight.
 */
import type { BIQPlayer, BIQGame, BIQTeamDifficulty } from "./types";
import { buildPlayerIndexPack } from "./indexes";
import { calculateRosterIntelligence } from "./rosterIntelligence";
import { calculateMarketReport } from "./marketIntelligence";
import { buildTeamDifficultyMap } from "./teamDifficulty";

const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

export interface BIQPromptContext {
  starters: BIQPlayer[];
  bench: BIQPlayer[];
  pool?: BIQPlayer[];
  schedule?: BIQGame[];
  upcomingGames?: BIQGame[];
  captainId?: number | null;
}

function compactPlayerPack(p: BIQPlayer, upcoming: BIQGame[], diff: Record<string, BIQTeamDifficulty>) {
  const pack = buildPlayerIndexPack(p, { upcomingGames: upcoming, teamDifficultyMap: diff });
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    fc_bc: p.fc_bc,
    salary: p.salary,
    bio: p.nationality ? { nationality: p.nationality } : undefined,
    biq_rating: pack.biqRating.score,
    biq_label: pack.biqRating.label,
    captain_edge: pack.captainEdge.score,
    captain_label: pack.captainEdge.label,
    schedule: { score: pack.scheduleEdge.score, label: pack.scheduleEdge.label, games: pack.scheduleEdge.gamesCount },
    salary_eff: { score: pack.salaryEfficiency.score, label: pack.salaryEfficiency.label, ratio: round(pack.salaryEfficiency.ratio, 2) },
    form: pack.formSignal.label,
    risk: { level: pack.riskRadar.level, score: pack.riskRadar.score, flags: pack.riskRadar.flags },
    adj_fp: pack.difficultyAdjustedFP,
  };
}

/** Compact roster pack used by analyze-roster, pick-captain, suggest-transfers. */
export function buildRosterIndexPrompt(ctx: BIQPromptContext) {
  const sched = ctx.schedule ?? [];
  const upcoming = ctx.upcomingGames ?? sched;
  const diff = buildTeamDifficultyMap(sched);
  const starters = ctx.starters.map((p) => compactPlayerPack(p, upcoming, diff));
  const bench = ctx.bench.map((p) => compactPlayerPack(p, upcoming, diff));
  const roster = calculateRosterIntelligence(ctx.starters, ctx.bench, {
    upcomingGames: upcoming, teamDifficultyMap: diff, captainId: ctx.captainId ?? null,
  });
  return {
    starters,
    bench,
    roster_summary: {
      projected_fp: roster.projectedFP,
      captain_candidates: roster.captainCandidates,
      risk_players: roster.riskPlayers,
      value_players: roster.valuePlayers,
      schedule_boost_players: roster.scheduleBoostPlayers,
      construction_notes: roster.rosterConstructionNotes,
    },
    data_basis: roster.dataBasis,
  };
}

/** Compact pack for explain-player. */
export function buildPlayerExplainPrompt(p: BIQPlayer, ctx: BIQPromptContext) {
  const sched = ctx.schedule ?? [];
  const upcoming = ctx.upcomingGames ?? sched;
  const diff = buildTeamDifficultyMap(sched);
  return { player: compactPlayerPack(p, upcoming, diff) };
}

/** Compact pack for explain-trade — pre-computes deltas server can validate. */
export function buildTradeExplainPrompt(
  outs: BIQPlayer[],
  ins: BIQPlayer[],
  ctx: BIQPromptContext,
) {
  const sched = ctx.schedule ?? [];
  const upcoming = ctx.upcomingGames ?? sched;
  const diff = buildTeamDifficultyMap(sched);
  const oPacks = outs.map((p) => compactPlayerPack(p, upcoming, diff));
  const iPacks = ins.map((p) => compactPlayerPack(p, upcoming, diff));
  const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + Number(x[k] ?? 0), 0);
  return {
    outs: oPacks,
    ins: iPacks,
    deltas: {
      fp_delta: round(sum(iPacks, "adj_fp") - sum(oPacks, "adj_fp")),
      biq_delta: round(sum(iPacks, "biq_rating") - sum(oPacks, "biq_rating")),
      salary_delta: round(sum(iPacks.map((p) => ({ salary: p.salary })), "salary") - sum(oPacks.map((p) => ({ salary: p.salary })), "salary")),
    },
  };
}

/** Compact pack for suggest-transfers — adds market scan. */
export function buildTransfersPrompt(ctx: BIQPromptContext, ownedIds: Set<number>, maxSalary?: number) {
  const sched = ctx.schedule ?? [];
  const upcoming = ctx.upcomingGames ?? sched;
  const diff = buildTeamDifficultyMap(sched);
  const market = calculateMarketReport(ctx.pool ?? [], ownedIds, upcoming, diff, { maxSalary, topN: 6 });
  return {
    roster: buildRosterIndexPrompt(ctx),
    market,
  };
}
