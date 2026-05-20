/** Shared 1-decimal money rounding so server + client agree. */
export const round1 = (n: number): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 10) / 10;
};

export const sum1 = (xs: Array<number | null | undefined>): number =>
  round1(xs.reduce<number>((s, v) => s + (Number(v) || 0), 0));

/** Format a salary-like number as "$12.5M" using 1-decimal rounding. */
export const formatBank = (n: number): string => `$${round1(n).toFixed(1)}M`;