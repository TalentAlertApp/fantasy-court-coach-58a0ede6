/** Shared helpers for rendering dynamic salary deltas. */
export function salaryDeltaColor(delta: number | undefined | null): string {
  if (!delta) return "";
  if (delta > 0) return "text-emerald-500";
  if (delta < 0) return "text-destructive";
  return "";
}

export function formatSalaryDelta(delta: number | undefined | null): string {
  if (!delta) return "no change";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}$${Math.abs(delta).toFixed(1)}M`;
}

export function salaryDeltaTooltip(d1: number | null | undefined, d7: number | null | undefined): string {
  const last = d1 ? formatSalaryDelta(d1) : "no recent change";
  const week = d7 ? formatSalaryDelta(d7) : "—";
  return `Last gameday: ${last} · Δ7d: ${week}`;
}