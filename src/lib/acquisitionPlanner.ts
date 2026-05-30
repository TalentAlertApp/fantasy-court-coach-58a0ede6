/**
 * Deterministic "Bring In" / Target acquisition planner (Phase 1).
 *
 * Given a target player, the current roster, the available pool and budget,
 * this pure module computes the legal route(s) to acquire the player while
 * respecting every roster constraint:
 *   - 10 players, $100M cap (tracked via bankRemaining)
 *   - max 2 players per NBA team
 *   - exactly 5 FC / 5 BC when the roster is full
 *   - per-gameweek transfer cap
 *
 * It NEVER commits anything — it only proposes routes that the user can stage
 * in the Trade Center.
 */

export type Position = "FC" | "BC";

export interface PlannerPlayer {
  id: number;
  name: string;
  team: string;
  fc_bc: Position;
  salary: number;
  photo?: string | null;
  /** Last-5 value metric (FP per $M) — used to rank drop/keep decisions. */
  value5?: number;
  /** Last-5 fantasy points — secondary ranking signal. */
  fp5?: number;
}

export interface PlannerContext {
  /** Current roster (0–10 players). */
  roster: PlannerPlayer[];
  /** Full available pool (non-roster) used to find package second-ins. */
  pool: PlannerPlayer[];
  /** Available bank in $M. */
  bankRemaining: number;
  /** Transfers already used this gameweek. */
  gwUsed: number;
  /** Transfer cap this gameweek. */
  gwCap: number;
}

export type RouteKind = "direct_add" | "swap_1" | "package_2" | "wait";

export interface AcquisitionRoute {
  kind: RouteKind;
  /** Players leaving the roster. */
  outs: PlannerPlayer[];
  /** Players joining the roster (always includes the target first). */
  ins: PlannerPlayer[];
  /** Bank after applying the route. */
  bankAfter: number;
  /** Number of transfers this route consumes. */
  transfers: number;
  feasible: boolean;
  title: string;
  detail: string;
}

export interface AcquisitionPlan {
  target: PlannerPlayer;
  /** Best feasible route, or null when none exists. */
  recommended: AcquisitionRoute | null;
  /** All candidate routes (feasible first). */
  routes: AcquisitionRoute[];
  /** True when the target is already on the roster. */
  alreadyOwned: boolean;
  /** Human-readable blockers when nothing legal/smart is possible. */
  blockers: string[];
}

const ROSTER_SIZE = 10;
const MAX_PER_TEAM = 2;
const FC_REQUIRED = 5;
const BC_REQUIRED = 5;
const EPS = 1e-6;

function opposite(pos: Position): Position {
  return pos === "FC" ? "BC" : "FC";
}

function rankWorst(a: PlannerPlayer, b: PlannerPlayer): number {
  // Lower value5 first, then lower fp5 — i.e. least valuable to drop.
  const va = a.value5 ?? 0;
  const vb = b.value5 ?? 0;
  if (va !== vb) return va - vb;
  return (a.fp5 ?? 0) - (b.fp5 ?? 0);
}

function rankBest(a: PlannerPlayer, b: PlannerPlayer): number {
  // Higher value5 first — best value to bring in.
  const va = a.value5 ?? 0;
  const vb = b.value5 ?? 0;
  if (va !== vb) return vb - va;
  return (b.fp5 ?? 0) - (a.fp5 ?? 0);
}

function teamCount(players: PlannerPlayer[], team: string, excludeIds: Set<number>): number {
  const t = (team ?? "").toUpperCase();
  return players.filter((p) => !excludeIds.has(p.id) && (p.team ?? "").toUpperCase() === t).length;
}

/** Compute a full acquisition plan for the target. */
export function planAcquisition(target: PlannerPlayer, ctx: PlannerContext): AcquisitionPlan {
  const { roster, pool, bankRemaining, gwUsed, gwCap } = ctx;
  const alreadyOwned = roster.some((p) => p.id === target.id);
  const routes: AcquisitionRoute[] = [];
  const blockers: string[] = [];

  if (alreadyOwned) {
    return { target, recommended: null, routes, alreadyOwned: true, blockers: ["Already on your roster."] };
  }

  const transfersLeft = Math.max(0, gwCap - gwUsed);
  const targetTri = (target.team ?? "").toUpperCase();

  // ---- 1. Direct add (roster not full) ----------------------------------
  if (roster.length < ROSTER_SIZE) {
    const sub: string[] = [];
    const tc = teamCount(roster, target.team, new Set());
    if (tc >= MAX_PER_TEAM) sub.push(`Already 2 from ${targetTri}`);
    const fc = roster.filter((p) => p.fc_bc === "FC").length;
    const bc = roster.filter((p) => p.fc_bc === "BC").length;
    if (target.fc_bc === "FC" && fc >= FC_REQUIRED) sub.push("FC slots full (5/5)");
    if (target.fc_bc === "BC" && bc >= BC_REQUIRED) sub.push("BC slots full (5/5)");
    const bankAfter = bankRemaining - target.salary;
    if (bankAfter < -EPS) sub.push(`Over budget by $${(target.salary - bankRemaining).toFixed(1)}M`);
    if (transfersLeft < 1) sub.push("Gameweek transfer cap reached");
    routes.push({
      kind: "direct_add",
      outs: [],
      ins: [target],
      bankAfter,
      transfers: 1,
      feasible: sub.length === 0,
      title: "Direct Add",
      detail: sub.length === 0
        ? `Open slot — add ${target.name} for $${target.salary}M.`
        : sub.join(" · "),
    });
    if (sub.length) blockers.push(...sub);
  }

  // ---- 2. 1-for-1 swaps (roster full) -----------------------------------
  if (roster.length >= ROSTER_SIZE) {
    const candidates = roster
      .filter((d) => d.fc_bc === target.fc_bc) // same position keeps 5/5 balance
      .map((d) => {
        const excl = new Set([d.id]);
        const tcAfter = teamCount(roster, target.team, excl) + 1;
        const bankAfter = bankRemaining + d.salary - target.salary;
        const reasons: string[] = [];
        if (tcAfter > MAX_PER_TEAM) reasons.push(`Max 2 from ${targetTri}`);
        if (bankAfter < -EPS) reasons.push(`Over budget by $${(target.salary - (bankRemaining + d.salary)).toFixed(1)}M`);
        if (transfersLeft < 1) reasons.push("Gameweek transfer cap reached");
        return { d, bankAfter, feasible: reasons.length === 0, reasons };
      });

    const feasible = candidates.filter((c) => c.feasible).sort((a, b) => rankWorst(a.d, b.d));
    for (const c of feasible.slice(0, 4)) {
      routes.push({
        kind: "swap_1",
        outs: [c.d],
        ins: [target],
        bankAfter: c.bankAfter,
        transfers: 1,
        feasible: true,
        title: "1-for-1 Swap",
        detail: `Release ${c.d.name} ($${c.d.salary}M) → bring in ${target.name} ($${target.salary}M).`,
      });
    }
    if (!feasible.length && candidates.length) {
      blockers.push(`No same-position (${target.fc_bc}) swap fits the cap/team rules.`);
    }
    if (!candidates.length) {
      blockers.push(`No ${target.fc_bc} on your roster to swap out (would break 5/5).`);
    }
  }

  // ---- 3. 2-for-2 package (only when no feasible direct/1-for-1) ---------
  const hasFeasible = routes.some((r) => r.feasible);
  if (!hasFeasible && roster.length >= ROSTER_SIZE && transfersLeft >= 2) {
    const pkg = buildPackage(target, ctx, targetTri);
    if (pkg) routes.push(pkg);
    else blockers.push("No legal 2-for-2 package found within budget and team limits.");
  } else if (!hasFeasible && roster.length >= ROSTER_SIZE && transfersLeft < 2) {
    blockers.push("A package needs 2 transfers, but the gameweek cap is reached.");
  }

  // ---- 4. Wait / Avoid ---------------------------------------------------
  const feasibleRoutes = routes.filter((r) => r.feasible);
  if (!feasibleRoutes.length) {
    routes.push({
      kind: "wait",
      outs: [],
      ins: [target],
      bankAfter: bankRemaining,
      transfers: 0,
      feasible: false,
      title: "Wait / Avoid",
      detail: blockers.length
        ? `No legal route right now: ${Array.from(new Set(blockers)).join("; ")}.`
        : "No legal route to acquire this player right now.",
    });
  }

  // Order: feasible routes first (direct → swap → package), then wait.
  const order: Record<RouteKind, number> = { direct_add: 0, swap_1: 1, package_2: 2, wait: 3 };
  routes.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return order[a.kind] - order[b.kind];
  });

  return {
    target,
    recommended: routes.find((r) => r.feasible) ?? null,
    routes,
    alreadyOwned: false,
    blockers: Array.from(new Set(blockers)),
  };
}

/**
 * Build a balance-preserving 2-for-2: drop one FC + one BC (the two least
 * valuable), bring in the target plus the best-value pool player of the
 * opposite position, respecting budget and per-team caps.
 */
function buildPackage(target: PlannerPlayer, ctx: PlannerContext, targetTri: string): AcquisitionRoute | null {
  const { roster, pool, bankRemaining } = ctx;
  const secondPos = opposite(target.fc_bc);

  const dropFcPool = roster.filter((p) => p.fc_bc === "FC").sort(rankWorst);
  const dropBcPool = roster.filter((p) => p.fc_bc === "BC").sort(rankWorst);
  if (!dropFcPool.length || !dropBcPool.length) return null;

  const rosterIds = new Set(roster.map((p) => p.id));
  const secondCandidates = pool
    .filter((p) => p.fc_bc === secondPos && !rosterIds.has(p.id) && p.id !== target.id)
    .sort(rankBest);

  // Try the cheapest pair of drops first to maximise affordability headroom.
  for (const dropFc of dropFcPool) {
    for (const dropBc of dropBcPool) {
      const excl = new Set([dropFc.id, dropBc.id]);
      const freedBank = bankRemaining + dropFc.salary + dropBc.salary;
      const afterTarget = freedBank - target.salary;
      if (afterTarget < -EPS) continue;
      // Target team cap after the two drops.
      if (teamCount(roster, target.team, excl) + 1 > MAX_PER_TEAM) continue;

      for (const second of secondCandidates) {
        const secondTri = (second.team ?? "").toUpperCase();
        const bankAfter = afterTarget - second.salary;
        if (bankAfter < -EPS) continue;
        // Second-in team cap: roster after drops + target (if same team) + this.
        const baseCount = teamCount(roster, second.team, excl);
        const plusTarget = targetTri === secondTri ? 1 : 0;
        if (baseCount + plusTarget + 1 > MAX_PER_TEAM) continue;

        return {
          kind: "package_2",
          outs: [dropFc, dropBc],
          ins: [target, second],
          bankAfter,
          transfers: 2,
          feasible: true,
          title: "2-for-2 Package",
          detail: `Release ${dropFc.name} + ${dropBc.name}; bring in ${target.name} + ${second.name} (keeps 5 FC / 5 BC).`,
        };
      }
    }
  }
  return null;
}

/** Encode a route into Trade Center staging query params. */
export function routeToStageParams(route: AcquisitionRoute): URLSearchParams {
  const params = new URLSearchParams();
  params.set("bringIn", "1");
  if (route.outs.length) params.set("outs", route.outs.map((p) => p.id).join(","));
  if (route.ins.length) params.set("ins", route.ins.map((p) => p.id).join(","));
  return params;
}