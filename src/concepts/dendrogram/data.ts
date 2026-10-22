import generated from './data/dendrogram.json';

export type Pt = readonly [number, number];
export type Linkage = 'ward' | 'complete' | 'average' | 'single';
/** A scipy linkage row; ids >= n are earlier merges (id n + i is merge i). */
export interface Merge {
  readonly a: number;
  readonly b: number;
  readonly height: number;
  readonly size: number;
}
export interface Cut {
  readonly k: number;
  /** k clusters exist for low <= t < high (merges with height <= t are applied). */
  readonly low: number;
  readonly high: number;
  /** Per point, renumbered left to right by leaf order. */
  readonly labels: readonly number[];
}
export interface LinkageData {
  /** n-1 rows. */
  readonly merges: readonly Merge[];
  /** scipy dendrogram leaf order. */
  readonly leaves: readonly number[];
  /** k = 1..6. */
  readonly cuts: readonly Cut[];
}
export interface DendrogramData {
  readonly meta: {
    readonly scipy: string;
    readonly sklearn: string;
    readonly groups: Readonly<Record<'A' | 'B' | 'C' | 'zincir', readonly number[]>>;
    readonly nudge: { readonly seed: number | null; readonly steps: number; readonly maxShift: number };
  };
  /** 17 points, 2 decimals. */
  readonly points: readonly Pt[];
  readonly linkages: Readonly<Record<Linkage, LinkageData>>;
  /** Step 4: sum-of-squares increase of one Ward merge (merge index, 0-based). */
  readonly wardExample: { readonly merge: number; readonly increase: number };
  readonly naturalK: number;
}

export const dendrogramData = generated as unknown as DendrogramData;
