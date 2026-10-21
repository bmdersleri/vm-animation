/** Pure pandas-equivalent statistics. Inputs are never mutated; callers guarantee n ≥ 1. */

export function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export interface QuantileStep {
  q: number;
  n: number;
  pos: number;
  lo: number;
  frac: number;
  a: number;
  b: number;
  value: number;
}

/** pandas 'linear': pos = q·(n−1); value = a + frac·(b − a). */
export function quantileStep(xs: readonly number[], q: number): QuantileStep {
  const sorted = [...xs].sort((x, y) => x - y);
  const n = sorted.length;
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const frac = pos - lo;
  const a = sorted[lo];
  const b = sorted[Math.min(lo + 1, n - 1)];
  return { q, n, pos, lo, frac, a, b, value: a + frac * (b - a) };
}

export function quantile(xs: readonly number[], q: number): number {
  return quantileStep(xs, q).value;
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

/** Population standard deviation (ddof = 0). */
export function std0(xs: readonly number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / xs.length);
}

export function zscores(xs: readonly number[]): number[] {
  const m = mean(xs);
  const sd = std0(xs);
  return xs.map((x) => (x - m) / sd);
}

export function clip(xs: readonly number[], lo: number, hi: number): number[] {
  return xs.map((x) => Math.min(hi, Math.max(lo, x)));
}
