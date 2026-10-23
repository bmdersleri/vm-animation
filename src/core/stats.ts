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

/** Sample standard deviation by default, as in pandas Series.std(). */
export function std(xs: readonly number[], ddof = 1): number {
  return Math.sqrt(variance(xs, ddof));
}

/** Normal probability density; callers supply sigma > 0. */
export function normPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Normal CDF via the convergent positive-term integral series (|z| <= 8).
 * Factoring out exp(-z²/2) avoids cancellation in the series terms.
 */
export function normCdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  if (Number.isNaN(z)) return NaN;
  if (z < -8) return 0;
  if (z > 8) return 1;
  if (z === 0) return 0.5;
  const a = Math.abs(z);
  let term = a;
  let sum = a;
  for (let denominator = 3; ; denominator += 2) {
    term *= a * a / denominator;
    const next = sum + term;
    if (next === sum) break;
    sum = next;
  }
  const area = sum * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return Math.max(0, Math.min(1, z < 0 ? 0.5 - area : 0.5 + area));
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

/** pandas Series.skew(): G1, bias-corrected; NaN for n < 3 or a constant series. */
export function skewness(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs);
  // pandas standardises with the sample standard deviation (ddof 1), not std0.
  const s = Math.sqrt(variance(xs, 1));
  if (s === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += ((x - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** numpy.histogram: `bins` equal-width edges over [min, max]; last bin closed on the right. */
export function histCounts(xs: readonly number[], bins: number): { edges: number[]; counts: number[] } {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const edges = Array.from({ length: bins + 1 }, (_, i) => lo + ((hi - lo) * i) / bins);
  const counts = new Array(bins).fill(0) as number[];
  for (const x of xs) {
    let k = Math.floor(((x - lo) / (hi - lo)) * bins);
    if (k >= bins) k = bins - 1;
    if (k < 0) k = 0;
    counts[k]++;
  }
  return { edges, counts };
}
