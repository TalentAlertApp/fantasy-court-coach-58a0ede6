import type { z } from "zod";
import type { PlayerListItemSchema } from "@/lib/contracts";

export type DraftPlayer = z.infer<typeof PlayerListItemSchema>;

export type SalaryArchetype = "stars_scrubs" | "balanced" | "studs_only";

export interface DraftPreferences {
  archetype: SalaryArchetype;
  /** -1 → rookies, 0 → neutral, +1 → vets */
  experienceTilt: number;
  /** -1 → guards, 0 → neutral, +1 → bigs */
  sizeTilt: number;
  favouriteTeams: string[];
  /** -1 → safe (low variance), 0 → neutral, +1 → boom-or-bust */
  riskTilt: number;
}

export interface DraftResult {
  starters: DraftPlayer[];
  bench: DraftPlayer[];
  captain: DraftPlayer | null;
  totalSalary: number;
  legal: boolean;
  warnings: string[];
}

const SALARY_CAP = 100;
const MAX_PER_TEAM = 2;

/** "6'7\"" → 79 inches; null fallback. */
export function heightToInches(h: string | null): number {
  if (!h) return 78;
  const m = h.match(/(\d+)'\s*(\d+)?/);
  if (!m) return 78;
  return parseInt(m[1]) * 12 + (m[2] ? parseInt(m[2]) : 0);
}

function archetypeBonus(salary: number, a: SalaryArchetype): number {
  switch (a) {
    case "studs_only":
      // Reward expensive players linearly.
      return salary * 0.4;
    case "balanced":
      // Penalise extremes — favor the $7M-$13M sweet spot.
      return -Math.abs(salary - 10) * 0.5;
    case "stars_scrubs":
      // U-shape: love > $16M and < $5M, penalise mid-tier.
      if (salary >= 16) return 4;
      if (salary <= 5) return 2;
      return -2;
  }
}

/** Score a single player given the user's preferences. Higher = more desirable. */
export function scorePlayer(p: DraftPlayer, prefs: DraftPreferences): number {
  const fp5 = p.last5?.fp5 ?? 0;
  const fpSeason = p.season?.fp ?? 0;
  const baseFp = fp5 > 0 ? fp5 : fpSeason;

  const salary = p.core.salary ?? 0;
  const exp = p.core.exp ?? 0;
  const heightIn = heightToInches(p.core.height);

  // Variance proxy: gap between recent form and season average → higher gap = riskier.
  const variance = Math.abs(fp5 - fpSeason);

  let score = baseFp;
  score += archetypeBonus(salary, prefs.archetype);
  score += prefs.experienceTilt * (exp - 5) * 0.4;          // midpoint 5 yrs
  score += prefs.sizeTilt * (heightIn - 78) * 0.3;          // midpoint 6'6"
  if (prefs.favouriteTeams.includes(p.core.team)) score += 4;
  score += prefs.riskTilt * variance * 0.5;

  return score;
}

/** Greedy fill respecting cap, 5 FC + 5 BC, max 2 per team. */
export function buildPersonalisedRoster(
  players: DraftPlayer[],
  prefs: DraftPreferences,
): DraftResult {
  const ranked = players
    .map((p) => ({ p, s: scorePlayer(p, prefs) }))
    .sort((a, b) => b.s - a.s);

  const picks: DraftPlayer[] = [];
  const teamCount = new Map<string, number>();
  let salary = 0;
  let fc = 0, bc = 0;

  for (const { p } of ranked) {
    if (picks.length >= 10) break;
    const isFC = p.core.fc_bc === "FC";
    if (isFC && fc >= 5) continue;
    if (!isFC && bc >= 5) continue;
    if ((teamCount.get(p.core.team) ?? 0) >= MAX_PER_TEAM) continue;
    if (salary + (p.core.salary ?? 0) > SALARY_CAP) continue;
    picks.push(p);
    salary += p.core.salary ?? 0;
    teamCount.set(p.core.team, (teamCount.get(p.core.team) ?? 0) + 1);
    if (isFC) fc++; else bc++;
  }

  const warnings: string[] = [];
  if (picks.length < 10) warnings.push("Could not fill 10 slots within the cap — relax constraints.");
  if (fc !== 5 || bc !== 5) warnings.push("Final roster is not 5 FC + 5 BC.");

  // Split starters/bench: top 5 by score, respecting min 2 FC + 2 BC starting.
  const sortedByScore = [...picks].sort(
    (a, b) => scorePlayer(b, prefs) - scorePlayer(a, prefs),
  );
  const starters: DraftPlayer[] = [];
  const bench: DraftPlayer[] = [];
  let sFC = 0, sBC = 0;
  for (const p of sortedByScore) {
    if (starters.length >= 5) { bench.push(p); continue; }
    const isFC = p.core.fc_bc === "FC";
    const slotsLeft = 5 - starters.length;
    const needFC = Math.max(0, 2 - sFC);
    const needBC = Math.max(0, 2 - sBC);
    const reservedForOther = isFC ? needBC : needFC;
    if (slotsLeft - reservedForOther > 0) {
      starters.push(p);
      if (isFC) sFC++; else sBC++;
    } else {
      bench.push(p);
    }
  }
  while (starters.length < 5 && bench.length) starters.push(bench.shift()!);

  const captain = starters
    .slice()
    .sort((a, b) => scorePlayer(b, prefs) - scorePlayer(a, prefs))[0] ?? null;

  return {
    starters,
    bench,
    captain,
    totalSalary: salary,
    legal: picks.length === 10 && fc === 5 && bc === 5 && salary <= SALARY_CAP,
    warnings,
  };
}