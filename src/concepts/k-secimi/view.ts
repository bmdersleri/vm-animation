import { kmeansData, kResult, type KResult } from '../kmeans/data';
import { formatNumber } from '../../core/plot/format';

export const UNDEFINED = '— (tanımsız)';

export interface KView {
  k: number;
  result: KResult;
  inertia: number;
  /** Raw inertia(k-1) - inertia(k); null for k=1. */
  dropFromPrev: number | null;
  silhouette: number | null;
  /** Indices with a negative silhouette (empty for k=1). */
  negatives: number[];
  /** Cluster sizes in cluster-number order. */
  sizes: readonly number[];
}

export const clampK = (k: number): number => Math.max(1, Math.min(kmeansData.ks.length, Math.trunc(k)));

export const inertiaText = (v: number): string => formatNumber(v, 1);
export const dropText = (v: number): string => formatNumber(v, 1);
export const silhouetteText = (v: number | null): string => (v === null ? UNDEFINED : formatNumber(v, 3));
export const pointText = (v: number): string => formatNumber(v, 3);

export function deriveKView(kIn: number): KView {
  const k = clampK(kIn);
  const result = kResult(k);
  const negatives: number[] = [];
  result.s?.forEach((v, i) => { if (v < 0) negatives.push(i); });
  return {
    k,
    result,
    inertia: result.inertia,
    dropFromPrev: k > 1 ? kResult(k - 1).inertia - result.inertia : null,
    silhouette: result.silhouette,
    negatives,
    sizes: result.sizes,
  };
}

/** Points whose cluster number differs from the previous k (labels are relabelled stably). */
export function changedBetween(kIn: number): number[] {
  const k = clampK(kIn);
  if (k <= 1) return [];
  const a = kResult(k - 1).labels;
  const b = kResult(k).labels;
  const out: number[] = [];
  b.forEach((l, i) => { if (l !== a[i]) out.push(i); });
  return out;
}

export function pointStats(kIn: number, i: number): { a: number; b: number; s: number } | null {
  const r = kResult(clampK(kIn));
  if (!r.a || !r.b || !r.s || i < 0 || i >= r.a.length) return null;
  return { a: r.a[i], b: r.b[i], s: r.s[i] };
}

/** The k (>= 2) with the best mean silhouette. */
export function peakK(): number {
  let best = 2;
  for (const r of kmeansData.ks) if (r.silhouette !== null && r.silhouette > kResult(best).silhouette!) best = r.k;
  return best;
}
