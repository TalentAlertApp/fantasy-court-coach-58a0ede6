/** Shared 1-decimal money rounding mirror of src/lib/money.ts. */
export function round1(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 10) / 10;
}

export function sum1(xs: Array<number | null | undefined>): number {
  return round1(xs.reduce<number>((s, v) => s + (Number(v) || 0), 0));
}