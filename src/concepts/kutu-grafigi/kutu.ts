import { quantileStep, variance, type QuantileStep } from '../../core/stats';

export interface BoxStats {
  q1: QuantileStep;
  median: QuantileStep;
  q3: QuantileStep;
  iqr: number;
  /** Lower fence: q1 − k·iqr. */
  lo: number;
  /** Upper fence: q3 + k·iqr. */
  hi: number;
  /** Smallest observation inside the fences (matplotlib: the whisker ends on an observation, not on the fence). */
  wLo: number;
  /** Largest observation inside the fences. */
  wHi: number;
  /** Every observation strictly outside the fences; a value exactly on a fence is not an outlier. */
  outliers: number[];
}

/** Five-number summary of one group at IQR coefficient `k`; the input array is never mutated. */
export function boxStats(values: readonly number[], k: number): BoxStats {
  if (values.length === 0) throw new Error('boxStats: empty series');
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileStep(sorted, 0.25);
  const median = quantileStep(sorted, 0.5);
  const q3 = quantileStep(sorted, 0.75);
  const iqr = q3.value - q1.value;
  const lo = q1.value - k * iqr;
  const hi = q3.value + k * iqr;
  const inside = sorted.filter((x) => x >= lo && x <= hi);
  return {
    q1,
    median,
    q3,
    iqr,
    lo,
    hi,
    // q1 and q3 always sit inside their own fences (iqr ≥ 0), so `inside` is never empty.
    wLo: inside[0],
    wHi: inside[inside.length - 1],
    outliers: sorted.filter((x) => x < lo || x > hi),
  };
}

export interface KdePoint {
  x: number;
  y: number;
}

/**
 * Gaussian kernel density estimate over [lo, hi] with Silverman's band
 * h = 1.06·s·n^(−1/5), s the sample standard deviation. n < 2 or a constant
 * series has no band: the result is a flat line. Pure, no DOM.
 */
export function kde(values: readonly number[], lo: number, hi: number, steps = 40): KdePoint[] {
  const n = values.length;
  const s = n >= 2 ? Math.sqrt(variance(values, 1)) : 0;
  const h = 1.06 * s * Math.pow(n, -0.2);
  const xs = steps < 2
    ? [lo]
    : Array.from({ length: steps }, (_, i) => lo + ((hi - lo) * i) / (steps - 1));
  if (n < 2 || s === 0 || h === 0) return xs.map((x) => ({ x, y: 1 / Math.max(n, 1) }));
  const norm = n * h * Math.sqrt(2 * Math.PI);
  return xs.map((x) => ({
    x,
    y: values.reduce((sum, v) => sum + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) / norm,
  }));
}
