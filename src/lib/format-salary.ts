/** Render a player salary as "$12.5M" or "TBD" when 0 (used for WNBA pre-launch). */
export function formatSalary(salary: number | null | undefined): string {
  if (salary == null || !Number.isFinite(Number(salary)) || Number(salary) <= 0) return "TBD";
  return `$${Number(salary)}M`;
}

/**
 * Render a stat number, but if the value is missing / 0 / non-finite, render
 * an em-dash. Useful for pre-season WNBA where 0.0 would imply real performance.
 * Pass `forceDash` (e.g. when in pre-season WNBA mode) to render "—" even when
 * `value` is exactly 0 from upstream defaults.
 */
export function formatStat(
  value: number | null | undefined,
  digits = 1,
  forceDash = false,
): string {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "—";
  if (forceDash && n <= 0) return "—";
  if (!forceDash && n === 0) return n.toFixed(digits);
  return n.toFixed(digits);
}
