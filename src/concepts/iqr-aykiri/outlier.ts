import { mean, median, quantileStep, std0, type QuantileStep } from '../../core/stats';

export type Fill = 'yok' | 'ortalama' | 'medyan';
export type Action = 'yok' | 'sil' | 'kirp';

/** Copy of `values` with the entry at `index` replaced by `x`. */
export function withExtreme<T extends number | null>(values: readonly T[], index: number, x: number): T[] {
  const out = [...values];
  out[index] = x as T;
  return out;
}

/** SimpleImputer: gaps are filled with the mean / median of the non-null values; 'yok' leaves them. */
export function impute(
  values: readonly (number | null)[],
  fill: Fill,
): { values: (number | null)[]; fillValue: number | null } {
  if (fill === 'yok') return { values: [...values], fillValue: null };
  const present = values.filter((v): v is number => v !== null);
  const fillValue = fill === 'ortalama' ? mean(present) : median(present);
  return { values: values.map((v) => (v === null ? fillValue : v)), fillValue };
}

export interface Tukey {
  n: number;
  sorted: number[];
  q1: QuantileStep;
  q3: QuantileStep;
  iqr: number;
  k: number;
  lo: number;
  hi: number;
  /** Input indices outside [lo, hi]. */
  outliers: number[];
  /** Smallest and largest value inside [lo, hi]. */
  whiskers: [number, number];
}

export function tukey(values: readonly number[], k: number): Tukey {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileStep(values, 0.25);
  const q3 = quantileStep(values, 0.75);
  const iqr = q3.value - q1.value;
  const lo = q1.value - k * iqr;
  const hi = q3.value + k * iqr;
  const outliers: number[] = [];
  values.forEach((v, i) => {
    if (v < lo || v > hi) outliers.push(i);
  });
  const inside = sorted.filter((v) => v >= lo && v <= hi);
  const whiskers: [number, number] =
    inside.length > 0 ? [inside[0], inside[inside.length - 1]] : [sorted[0], sorted[sorted.length - 1]];
  return { n: values.length, sorted, q1, q3, iqr, k, lo, hi, outliers, whiskers };
}

export interface Intervened {
  values: (number | null)[];
  kept: number[];
  keptIndex: number[];
  /** Indices that were deleted or clipped. */
  changed: number[];
}

/** Fences come from the original values. 'sil' nulls the outliers; 'kirp' clips them to [lo, hi]. Single pass. */
export function intervene(values: readonly number[], k: number, action: Action): Intervened {
  const { lo, hi, outliers } = tukey(values, k);
  const out = new Set(outliers);
  const result: (number | null)[] = values.map((v, i) => {
    if (!out.has(i) || action === 'yok') return v;
    return action === 'sil' ? null : Math.min(hi, Math.max(lo, v));
  });
  const changed = action === 'yok' ? [] : outliers;
  const kept: number[] = [];
  const keptIndex: number[] = [];
  result.forEach((v, i) => {
    if (v !== null) {
      kept.push(v);
      keptIndex.push(i);
    }
  });
  return { values: result, kept, keptIndex, changed };
}

/** z = (x − mean) / std0 over `values`. */
export function zOf(values: readonly number[], x: number): number {
  return (x - mean(values)) / std0(values);
}
