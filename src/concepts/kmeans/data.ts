import generated from './data/kmeans.json';

export type Pt = readonly [number, number];
export interface Turn {
  readonly labels: readonly number[];
  /** Centres after the move. */
  readonly centers: readonly Pt[];
  /** Points that changed cluster in this assignment; null on turn 1. */
  readonly changed: number | null;
  readonly inertia: number;
}
export interface Run {
  readonly id: string;
  readonly init: 'k-means++' | 'random';
  readonly seed: number;
  readonly start: readonly Pt[];
  readonly turns: readonly Turn[];
  readonly inertia: number;
}
export interface NInitRun {
  readonly seed: number;
  readonly labels: readonly number[];
  readonly centers: readonly Pt[];
  readonly inertia: number;
  readonly iterations: number;
}
export interface KResult {
  readonly k: number;
  readonly labels: readonly number[];
  readonly centers: readonly Pt[];
  readonly inertia: number;
  readonly sizes: readonly number[];
  readonly silhouette: number | null;
  readonly s: readonly number[] | null;
  readonly a: readonly number[] | null;
  readonly b: readonly number[] | null;
}
export interface KmeansData {
  readonly meta: {
    readonly sklearn: string;
    readonly features: readonly [string, string];
    readonly n: number;
    readonly turnRange: readonly [number, number];
  };
  readonly points: readonly Pt[];
  readonly runs: readonly Run[];
  readonly nInit: readonly NInitRun[];
  readonly nInitBest: number;
  readonly ks: readonly KResult[];
  readonly distancePoints: readonly number[];
  readonly silhouettePoint: number;
}

export const kmeansData = generated as unknown as KmeansData;

export function kResult(k: number): KResult {
  if (!Number.isInteger(k) || k < 1 || k > kmeansData.ks.length) throw new Error(`k out of range: ${k}`);
  return kmeansData.ks[k - 1];
}
