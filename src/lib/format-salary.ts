/** Render a player salary as "$12.5M" or "TBD" when 0 (used for WNBA pre-launch). */
export function formatSalary(salary: number | null | undefined): string {
  if (salary == null || !Number.isFinite(Number(salary)) || Number(salary) <= 0) return "TBD";
  return `$${Number(salary)}M`;
}
