import raw from './data/normal_data.json';

export type Seri = 'sinav' | 'cagri';

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

export const SERIES = raw.series as Record<Seri, Series>;
export const NORM = raw.norm as {
  bands: [number, number][];
  points: { x: number; mu: number; sigma: number; pdf: number; cdf: number }[];
};
export const SINAV_FIXED = raw.sinavFixed;
