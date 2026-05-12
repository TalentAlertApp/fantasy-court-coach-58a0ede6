/**
 * Normalized player health model — single source of truth.
 *
 * This module centralizes the messy reality of upstream injury data
 * (NBA / WNBA injury reports, player.flags.injury, player.injury,
 * legacy strings) into a single PlayerHealth shape and a small set
 * of decision helpers (captain blocking, optimizer penalties,
 * sort rank, tone, labels, tooltips).
 *
 * Pure module: no React, no I/O, no side-effects.
 */

export type HealthStatus = "OUT" | "Q" | "DTD" | "GTD" | "PROB" | null;

export interface PlayerHealth {
  status: HealthStatus;
  injury_type: string | null;
  estimated_return: string | null;
  notes: string | null;
  updated_at: string | null;
  source: string | null;
  /** Original upstream string before bucketing. Useful for debugging / fallback display. */
  raw_status: string | null;
  /** Free-form reason: injury, illness, rest, suspension, personal, G-League, conditioning, etc. */
  reason: string | null;
}

const EMPTY_HEALTH: PlayerHealth = {
  status: null,
  injury_type: null,
  estimated_return: null,
  notes: null,
  updated_at: null,
  source: null,
  raw_status: null,
  reason: null,
};

/** Normalize ANY raw upstream status string into our HealthStatus bucket. */
export function normalizeHealthStatus(input: unknown): HealthStatus {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const k = s.toLowerCase();

  if (k === "active" || k === "available" || k === "healthy" || k === "ok") return null;

  if (k === "questionable" || k === "q") return "Q";
  if (k === "day-to-day" || k === "day to day" || k === "dtd") return "DTD";
  if (k === "game-time decision" || k === "game time decision" || k === "gtd") return "GTD";
  if (k === "probable" || k === "available probable" || k === "prob") return "PROB";

  // Strong "OUT" signals (player unavailable for any reason).
  const outNeedles = [
    "out", "inactive", "suspended", "not with team", "g league", "g-league",
    "personal", "rest", "load management", "load manag",
  ];
  if (outNeedles.some((n) => k.includes(n))) return "OUT";

  // Unknown non-empty → conservative warning.
  return "Q";
}

/** Map a HealthStatus to the inferred reason bucket (best effort). */
function inferReason(rawStatus: string | null, injuryType: string | null): string | null {
  const blob = `${rawStatus ?? ""} ${injuryType ?? ""}`.toLowerCase();
  if (!blob.trim()) return null;
  if (blob.includes("suspend")) return "suspension";
  if (blob.includes("personal")) return "personal";
  if (blob.includes("g league") || blob.includes("g-league")) return "g-league";
  if (blob.includes("rest") || blob.includes("load manag")) return "rest";
  if (blob.includes("ill") || blob.includes("flu") || blob.includes("virus")) return "illness";
  if (blob.includes("condition")) return "conditioning";
  return "injury";
}

/**
 * Build a normalized PlayerHealth from any upstream player record + an
 * optional injury report record (from nba-injury-report / wnba-injury-report).
 *
 * Read priority:
 *   1. injuryRecord (most authoritative, has dates, types, notes, source)
 *   2. player.flags.injury (legacy raw string passed via API)
 *   3. player.injury (top-level legacy field on `players` table)
 *   4. player.core.injury (older mapping path, fallback only)
 *   5. player.note (last resort free text — only if it suggests unavailability)
 */
export function normalizePlayerHealth(player: any, injuryRecord?: any): PlayerHealth {
  if (injuryRecord && (injuryRecord.status || injuryRecord.injury_type)) {
    const raw = injuryRecord.status ?? null;
    const injuryType = injuryRecord.injury_type ?? null;
    return {
      status: normalizeHealthStatus(raw),
      injury_type: injuryType,
      estimated_return: injuryRecord.estimated_return ?? null,
      notes: injuryRecord.notes ?? null,
      updated_at: injuryRecord.last_updated ?? injuryRecord.updated_at ?? null,
      source: injuryRecord.source ?? null,
      raw_status: raw,
      reason: inferReason(raw, injuryType),
    };
  }

  // Drill through legacy fields in priority order.
  const flagsInjury = player?.flags?.injury;
  const topInjury = player?.injury;
  const coreInjury = player?.core?.injury;
  const note = player?.note ?? player?.flags?.note ?? null;

  const raw =
    (flagsInjury && String(flagsInjury)) ||
    (topInjury && String(topInjury)) ||
    (coreInjury && String(coreInjury)) ||
    null;

  const status = normalizeHealthStatus(raw);
  if (status === null && !raw) return { ...EMPTY_HEALTH, notes: note ?? null };

  return {
    status,
    injury_type: null,
    estimated_return: null,
    notes: note ?? null,
    updated_at: null,
    source: null,
    raw_status: raw,
    reason: inferReason(raw, null),
  };
}

/* ── Predicates ───────────────────────────────────────────────── */

export function isHealthUnavailable(h: PlayerHealth | null | undefined): boolean {
  return !!h && h.status === "OUT";
}

export function isHealthRisky(h: PlayerHealth | null | undefined): boolean {
  if (!h || !h.status) return false;
  return h.status === "Q" || h.status === "DTD" || h.status === "GTD";
}

export function shouldBlockCaptain(h: PlayerHealth | null | undefined): boolean {
  return isHealthUnavailable(h);
}

export function shouldWarnCaptain(h: PlayerHealth | null | undefined): boolean {
  return isHealthRisky(h);
}

export function getCaptainHealthWarning(
  h: PlayerHealth | null | undefined,
  playerName: string
): string | null {
  if (!h || !h.status) return null;
  if (h.status === "OUT") return `${playerName} is OUT — cannot be Captain.`;
  if (h.status === "Q") return `${playerName} is Questionable — Captain at your own risk.`;
  if (h.status === "GTD") return `${playerName} is a Game-Time Decision — Captain at your own risk.`;
  if (h.status === "DTD") return `${playerName} is Day-To-Day — monitor before locking Captain.`;
  return null;
}

/* ── Display helpers ──────────────────────────────────────────── */

export type HealthTone = "danger" | "warning" | "muted" | "clear";

export function getHealthTone(status: HealthStatus): HealthTone {
  if (status === "OUT") return "danger";
  if (status === "Q" || status === "GTD") return "warning";
  if (status === "DTD" || status === "PROB") return "muted";
  return "clear";
}

export function getHealthLabel(h: PlayerHealth | null | undefined): string {
  if (!h || !h.status) return "Active";
  switch (h.status) {
    case "OUT": return "Out";
    case "Q": return "Questionable";
    case "DTD": return "Day-to-Day";
    case "GTD": return "Game-Time Decision";
    case "PROB": return "Probable";
  }
}

export function getHealthTooltipText(h: PlayerHealth | null | undefined): string {
  if (!h || !h.status) return "No reported issue";
  const parts: string[] = [getHealthLabel(h)];
  if (h.injury_type) parts.push(h.injury_type);
  if (h.estimated_return) parts.push(`Est. return: ${h.estimated_return}`);
  if (h.notes) parts.push(h.notes);
  if (h.source) parts.push(`(${h.source})`);
  return parts.join(" · ");
}

/** Higher = worse. Use for sorting "most concerning first". */
export function getHealthSortRank(h: PlayerHealth | null | undefined): number {
  if (!h || !h.status) return 0;
  switch (h.status) {
    case "PROB": return 1;
    case "DTD": return 2;
    case "GTD": return 3;
    case "Q": return 4;
    case "OUT": return 5;
  }
}

/**
 * Optimizer penalty applied to a player's projected FP when deciding
 * starter vs bench. OUT effectively benches the player (-999). Risky
 * statuses get a small negative tilt so equal-projection toss-ups go
 * to the healthier player.
 */
export function getOptimizerHealthPenalty(h: PlayerHealth | null | undefined): number {
  if (!h || !h.status) return 0;
  switch (h.status) {
    case "OUT": return -999;
    case "Q": return -3;
    case "GTD": return -3;
    case "DTD": return -1;
    case "PROB": return 0;
  }
}