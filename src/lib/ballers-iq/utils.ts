/** Numeric & helper utilities for Ballers.IQ v2 (pure, no deps). */

export const safeNum = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const clamp01 = (v: number) => clamp(v, 0, 1);

export const scale100 = (v: number) => Math.round(clamp(v, 0, 100));

export const tricodeEq = (a?: string | null, b?: string | null) =>
  !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();

/** Weighted sum of numeric components; weights need not sum to 1. */
export const weightedSum = (
  parts: { value: number; weight: number }[]
): number => {
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  return parts.reduce((s, p) => s + p.value * p.weight, 0) / total;
};

/** De-dupe + join data basis tags. */
export const mergeBasis = (...arrs: string[][]): string[] =>
  Array.from(new Set(arrs.flat().filter(Boolean)));

/** Map a 0..100 score to a label using monotonically-decreasing thresholds. */
export function labelByThreshold<T extends string>(
  score: number,
  thresholds: { min: number; label: T }[],
  fallback: T
): T {
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);
  for (const t of sorted) if (score >= t.min) return t.label;
  return fallback;
}

/** Linear normalisation of a value between min and max into a 0..100 score. */
export const normalizeTo100 = (v: number, min: number, max: number): number => {
  if (max === min) return 50;
  return clamp(((v - min) / (max - min)) * 100, 0, 100);
};
