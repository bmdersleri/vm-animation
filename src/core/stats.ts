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

/** Variance; ddof 0 is the population variance (VarianceThreshold), ddof 1 the sample variance. */
export function variance(xs: readonly number[], ddof = 0): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (xs.length - ddof);
}

export interface Cov2 {
  xx: number;
  xy: number;
  yy: number;
}

/** Covariance matrix entries of two equally long series (numpy.cov: ddof 1). */
export function covariance2(xs: readonly number[], ys: readonly number[], ddof = 1): Cov2 {
  const mx = mean(xs);
  const my = mean(ys);
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const d = xs.length - ddof;
  return { xx: xx / d, xy: xy / d, yy: yy / d };
}

/** Pearson correlation coefficient. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const c = covariance2(xs, ys, 0);
  return c.xy / Math.sqrt(c.xx * c.yy);
}

export function zscores(xs: readonly number[]): number[] {
  const m = mean(xs);
  const sd = std0(xs);
  return xs.map((x) => (x - m) / sd);
}

export function clip(xs: readonly number[], lo: number, hi: number): number[] {
  return xs.map((x) => Math.min(hi, Math.max(lo, x)));
}
