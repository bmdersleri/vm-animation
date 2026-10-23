import raw from './data/normal_data.json';

/** Generated series ids (exam scores, call durations). */
export type Seri = 'sinav' | 'cagri';

/** One generated series with its values and summary statistics. */
export interface Series {
  id: Seri;
  label: string;
  unit: string;
  values: number[];
  domain: [number, number];
  binWidth: number;
  edges: number[];
  counts: number[];
  mean: number;
  std: number;
  median: number;
  skew: number;
  band: { k: number; lo: number; hi: number; count: number }[];
  scaled: { mean: number; std0: number; skew: number };
  seed: number;
}

/** All generated series, keyed by id. */
export const SERIES = raw.series as Record<Seri, Series>;

/** Standard-normal reference values generated alongside the series. */
export const NORM = raw.norm as {
  bands: [number, number][];
  points: { x: number; mu: number; sigma: number; pdf: number; cdf: number }[];
};

/** Fixed exam-score sample used by the demonstration steps. */
export const SINAV_FIXED = raw.sinavFixed;
