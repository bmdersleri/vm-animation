import generated from './data/dbscan.json';

export type Pt = readonly [number, number];
export interface KDist {
  readonly minSamples: number;
  readonly sorted: readonly number[];
  /** Knee of this curve (a distance), from the generator's Kneedle formula. */
  readonly knee: number;
}
export interface DbscanData {
  readonly meta: {
    readonly sklearn: string;
    readonly moons: { readonly n: number; readonly noise: number; readonly seed: number };
    readonly outliers: { readonly n: number; readonly seed: number };
    readonly eps: number;
    readonly minSamples: number;
  };
  /** 6-decimal, scaled; moons first, outliers last. */
  readonly points: readonly Pt[];
  /** KMeans(2, n_init=10, random_state=42). */
  readonly kmeansLabels: readonly number[];
  readonly examples: { readonly core: number; readonly border: number; readonly noise: number };
  /** minSamples 2..15. */
  readonly kdist: readonly KDist[];
  /** Knee of the minSamples=5 curve (a distance). */
  readonly knee: number;
  /** Step 9 stops. */
  readonly epsSweep: readonly [number, number, number];
}

export const dbscanData = generated as unknown as DbscanData;
