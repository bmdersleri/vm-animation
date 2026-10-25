import { CUSTOMERS, FEATURES, type FeatureIndex } from '../xai/data';
import { popcount } from '../xai/shapley';

/** Order in which the coalition nodes fill in step 3: layer by layer (empty set, singles, pairs, all). */
export const FILL_ORDER: readonly number[] = Array.from({ length: 1 << FEATURES.length }, (_, m) => m).sort(
  (a, b) => popcount(a) - popcount(b) || a - b,
);

/** Pearson correlation of two equally long series. */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Correlation between the tenure value and the tenure SHAP value over the test customers (step 9). */
export function tenureCorrelation(): number {
  return pearson(
    CUSTOMERS.map((c) => c.values[0]),
    CUSTOMERS.map((c) => c.shap[0]),
  );
}

/**
 * Rank of each customer's value of `feature` among the test customers, scaled to 0 (lowest) .. 1 (highest);
 * equal values are ordered by data row, so the extremes are exactly 0 and 1.
 */
export function valueRanks(feature: FeatureIndex): Map<number, number> {
  const sorted = [...CUSTOMERS].sort((a, b) => a.values[feature] - b.values[feature] || a.row - b.row);
  return new Map(sorted.map((c, i) => [c.row, sorted.length > 1 ? i / (sorted.length - 1) : 0]));
}

/** Weight as a vulgar fraction when it is one over a small integer ("⅓", "⅙"), otherwise "1/n". */
export function fraction(w: number): string {
  const n = Math.round(1 / w);
  const glyph: Record<number, string> = { 2: '½', 3: '⅓', 4: '¼', 6: '⅙' };
  return glyph[n] ?? `1/${n}`;
}

/** Plain number text for a charge: 2 decimals, decimal comma, no thousands dot ("2366,05" as the book prints it). */
export function plainCharge(text: string): string {
  return text.replace(/\./g, '');
}
