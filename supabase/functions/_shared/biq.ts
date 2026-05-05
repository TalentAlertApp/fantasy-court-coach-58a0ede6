// Edge-function-side Ballers.IQ index builder.
// Mirrors the client `src/lib/ballers-iq` core but uses only deno-safe primitives
// and the lightweight player rows from Supabase.

type PlayerRow = Record<string, any>;
type GameRow = Record<string, any>;

const num = (v: any, d = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const norm = (v: number, mn: number, mx: number) =>
  mx === mn ? 50 : clamp(((v - mn) / (mx - mn)) * 100, 0, 100);
const eqTri = (a: any, b: any) =>
  !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();

function ratingScore(p: PlayerRow): { score: number; label: string } {
  const fp5 = norm(num(p.fp_pg5), 0, 50);
  const fpT = norm(num(p.fp_pg_t), 0, 50);
  const v5 = norm(num(p.value5), 0, 2);
  const st = norm(num(p.stocks5), 0, 5);
  const mpg = num(p.mpg);
  const stab = mpg > 0 ? clamp(100 - (Math.abs(num(p.delta_mpg)) / mpg) * 200, 0, 100) : 50;
  const score = Math.round(clamp(fp5 * 0.30 + fpT * 0.20 + stab * 0.15 + v5 * 0.15 + st * 0.10 + 50 * 0.10, 0, 100));
  const label =
    score >= 85 ? "Elite" : score >= 70 ? "Strong" : score >= 55 ? "Playable" : score >= 40 ? "Watch" : "Risk";
  return { score, label };
}

function captainEdge(p: PlayerRow, hasGame: boolean): { score: number; label: string } {
  const fp5 = num(p.fp_pg5);
  const mpg5 = num(p.mpg5);
  const ceiling = Math.max(fp5, num(p.fp_pg_t)) + num(p.stocks5) * 2;
  let score = Math.round(
    norm(fp5, 0, 50) * 0.40 + norm(ceiling, 0, 60) * 0.25 + clamp(mpg5 * 3, 0, 100) * 0.15 + 50 * 0.20,
  );
  if (p.injury && String(p.injury).toUpperCase() !== "ACTIVE") score = Math.max(0, score - 35);
  if (!hasGame) score = Math.max(0, score - 50);
  const label = score >= 80 ? "Safe Captain" : score >= 65 ? "Upside Captain" : score >= 45 ? "Viable Captain" : "Avoid Captain";
  return { score, label };
}

function salaryEff(p: PlayerRow): { score: number; label: string; ratio: number } {
  const sal = num(p.salary), v5 = num(p.value5), fp5 = num(p.fp_pg5);
  if (sal <= 0) return { score: 50, label: "Fair Value", ratio: 1 };
  const ratio = v5 > 0 ? v5 : fp5 / sal;
  const score = Math.round(clamp(norm(ratio, 0.4, 1.6), 0, 100));
  const trap = ratio < 0.6 && sal >= 12;
  const label = trap ? "Salary Trap" : score >= 75 ? "Underpriced" : score >= 45 ? "Fair Value" : "Overpriced";
  return { score, label, ratio: Math.round(ratio * 100) / 100 };
}

function formSignal(p: PlayerRow): string {
  const dFp = num(p.delta_fp), dMpg = num(p.delta_mpg);
  const stocks5 = num(p.stocks5), stocks = num(p.stocks);
  if (dFp >= 5 && dMpg >= 2) return "Form Spike";
  if (dMpg >= 4 && dFp < 2) return "Minutes Without Production";
  if (dFp >= 4 && dMpg <= 0) return "Production Without Minutes";
  if (dMpg >= 4) return "Minutes Spike";
  if (stocks5 - stocks >= 1.5) return "Stocks Spike";
  if (dFp <= -5) return "Regression Risk";
  if (dMpg <= -4) return "Role Warning";
  return "Stable";
}

function riskRadar(p: PlayerRow, hasGame: boolean, salaryScore: number): { level: string; score: number; flags: string[] } {
  const flags: string[] = [];
  let s = 0;
  if (p.injury && String(p.injury).toUpperCase() !== "ACTIVE") { flags.push(String(p.injury)); s += 35; }
  if (num(p.delta_mpg) <= -3) { flags.push("minutes_down"); s += 15; }
  if (num(p.delta_fp) <= -4) { flags.push("fp_down"); s += 15; }
  if (!hasGame) { flags.push("no_game"); s += 25; }
  if (salaryScore < 35) { flags.push("salary_inefficient"); s += 8; }
  s = Math.min(100, s);
  const level = s >= 50 ? "HIGH" : s >= 25 ? "MEDIUM" : "LOW";
  return { level, score: s, flags };
}

function scheduleEdge(p: PlayerRow, upcoming: GameRow[]): { score: number; label: string; games: number } {
  const team = String(p.team ?? "").toUpperCase();
  const games = upcoming.filter((g) => eqTri(g.home_team, team) || eqTri(g.away_team, team));
  if (games.length === 0) return { score: -30, label: "No Game Risk", games: 0 };
  const score = clamp((games.length - 3) * 10, -50, 50);
  const label = score >= 15 ? "Schedule Boost" : score <= -15 ? "Schedule Drag" : "Neutral";
  return { score, label, games: games.length };
}

function nextGameLabel(p: PlayerRow, upcoming: GameRow[]): string | null {
  const team = String(p.team ?? "").toUpperCase();
  const g = upcoming.find((g) => eqTri(g.home_team, team) || eqTri(g.away_team, team));
  if (!g) return null;
  return eqTri(g.home_team, team) ? `vs ${String(g.away_team ?? "").toUpperCase()}` : `@ ${String(g.home_team ?? "").toUpperCase()}`;
}

function archetypeFor(p: PlayerRow, parts: { rating: { score: number }; sal: { label: string }; form: string; risk: { level: string } }): string {
  const fp5 = num(p.fp_pg5), mpg5 = num(p.mpg5 ?? p.mpg), stocks5 = num(p.stocks5), ast5 = num(p.ast5);
  const dMpg = num(p.delta_mpg);
  if (parts.sal.label === "Salary Trap") return "Trap Pick";
  if (parts.form === "Form Spike" || parts.form === "Minutes Spike") return "Form Climber";
  if (stocks5 >= 3) return "Stocks Hunter";
  if (parts.sal.label === "Underpriced" && parts.rating.score >= 55) return "Value Play";
  if (mpg5 >= 32 && Math.abs(dMpg) <= 2) return "Minutes Monster";
  if (fp5 >= 32 && ast5 >= 5) return "Usage Engine";
  if (mpg5 >= 28 && parts.risk.level === "LOW") return "Safe Floor";
  if (parts.rating.score >= 60 && parts.risk.level !== "LOW") return "Ceiling Swing";
  return "Safe Floor";
}

export interface BIQPlayerPack {
  id: number; name: string; team: string | null; fc_bc: string | null; salary: number;
  biq_rating: number; biq_label: string;
  captain_edge: number; captain_label: string;
  schedule: { score: number; label: string; games: number; next_game: string | null; warning: string | null };
  salary_eff: { score: number; label: string; ratio: number };
  form: string;
  risk: { level: string; score: number; flags: string[] };
  adj_fp: number;
  archetype: string;
}

export function buildPlayerPack(p: PlayerRow, upcoming: GameRow[]): BIQPlayerPack {
  const sched = scheduleEdge(p, upcoming);
  const sal = salaryEff(p);
  const cap = captainEdge(p, sched.games > 0);
  const rating = ratingScore(p);
  const risk = riskRadar(p, sched.games > 0, sal.score);
  const form = formSignal(p);
  const next = nextGameLabel(p, upcoming);
  const archetype = archetypeFor(p, { rating, sal, form, risk });
  return {
    id: Number(p.id), name: String(p.name ?? ""), team: p.team ?? null, fc_bc: p.fc_bc ?? null,
    salary: num(p.salary),
    biq_rating: rating.score, biq_label: rating.label,
    captain_edge: cap.score, captain_label: cap.label,
    schedule: { ...sched, next_game: next, warning: sched.games === 0 ? "No games scheduled this gameweek." : null },
    salary_eff: sal,
    form,
    risk,
    adj_fp: Math.round(num(p.fp_pg5) * 10) / 10,
    archetype,
  };
}

export function buildRosterPack(starters: PlayerRow[], bench: PlayerRow[], upcoming: GameRow[], captainId?: number | null) {
  const sPacks = starters.map((p) => buildPlayerPack(p, upcoming));
  const bPacks = bench.map((p) => buildPlayerPack(p, upcoming));
  const projected = sPacks.reduce((s, p) => s + p.adj_fp * (Number(p.id) === Number(captainId) ? 2 : 1), 0);
  const captain_candidates = [...sPacks].sort((a, b) => b.captain_edge - a.captain_edge)
    .slice(0, 5).map((p) => ({ playerId: p.id, score: p.captain_edge, label: p.captain_label }));
  const risk_players = [...sPacks, ...bPacks].filter((p) => p.risk.level !== "LOW")
    .map((p) => ({ playerId: p.id, level: p.risk.level, flags: p.risk.flags }));
  const value_players = [...sPacks, ...bPacks].filter((p) => p.salary_eff.label === "Underpriced")
    .sort((a, b) => b.salary_eff.score - a.salary_eff.score).slice(0, 5)
    .map((p) => ({ playerId: p.id, score: p.salary_eff.score, label: p.salary_eff.label }));
  const schedule_boost_players = sPacks.filter((p) => p.schedule.label === "Schedule Boost")
    .map((p) => ({ playerId: p.id, score: p.schedule.score, label: p.schedule.label }));
  return {
    starters: sPacks, bench: bPacks,
    roster_summary: {
      projected_fp: Math.round(projected * 10) / 10,
      captain_candidates, risk_players, value_players, schedule_boost_players,
      construction_notes: [],
    },
  };
}

export function buildMarketPack(pool: PlayerRow[], ownedIds: Set<number>, upcoming: GameRow[], topN = 6, maxSalary = Infinity) {
  const targets = pool.filter((p) => !ownedIds.has(Number(p.id)) && num(p.salary) <= maxSalary)
    .map((p) => buildPlayerPack(p, upcoming));
  return {
    underpriced: targets.filter((p) => p.salary_eff.label === "Underpriced" && p.biq_rating >= 55).sort((a, b) => b.biq_rating - a.biq_rating).slice(0, topN),
    formSpikes: targets.filter((p) => p.form === "Form Spike" || p.form === "Minutes Spike").sort((a, b) => b.biq_rating - a.biq_rating).slice(0, topN),
    scheduleBoosts: targets.filter((p) => p.schedule.label === "Schedule Boost").sort((a, b) => b.biq_rating - a.biq_rating).slice(0, topN),
    avoid: targets.filter((p) => p.salary_eff.label === "Salary Trap" || p.risk.level === "HIGH").slice(0, topN),
  };
}
