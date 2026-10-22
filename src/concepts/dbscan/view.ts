import type { Kind, DbscanResult } from './dbscan';
import { formatNumber } from '../../core/plot/format';

export const KIND_NAME: Record<Kind, string> = { core: 'çekirdek', border: 'sınır', noise: 'gürültü' };

export interface PointVerdict {
  index: number;
  /** Points inside the eps circle, the point itself included. */
  neighbours: number;
  minSamples: number;
  kind: Kind;
  /** For a border point: a core point inside its circle (lowest index in its own cluster); else null. */
  viaCore: number | null;
  text: string;
}

/** eps with a decimal comma and no trailing zeros: 0,3 / 0,15 / 1. */
export const epsText = (v: number): string => formatNumber(v, 2).replace(/,?0+$/, '');

/** Why point i is core, border or noise, from the live result (all numbers are read, none typed). */
export function verdictFor(r: DbscanResult, i: number, minSamples: number): PointVerdict {
  const n = r.neighbours[i].length;
  const kind = r.kind[i];
  let viaCore: number | null = null;
  if (kind === 'border') {
    viaCore = r.neighbours[i].find((j) => r.kind[j] === 'core' && r.label[j] === r.label[i]) ?? null;
  }
  const text = kind === 'core'
    ? `${n} ≥ ${minSamples} → çekirdek`
    : kind === 'border'
      ? `${n} < ${minSamples}, dairesinde çekirdek var (Nokta ${(viaCore ?? 0) + 1}) → sınır`
      : `${n} < ${minSamples} ve dairesinde çekirdek yok → gürültü`;
  return { index: i, neighbours: n, minSamples, kind, viaCore, text };
}

export function kindCounts(r: DbscanResult): Record<Kind, number> {
  const out: Record<Kind, number> = { core: 0, border: 0, noise: 0 };
  for (const k of r.kind) out[k] += 1;
  return out;
}

export function countsText(r: DbscanResult): string {
  const k = kindCounts(r);
  return `${r.clusters} küme · ${k.core} çekirdek · ${k.border} sınır · ${k.noise} gürültü`;
}

/** Cluster sizes in cluster-number order, counting only the first `reached` points of `order`. */
export function clusterSizes(r: DbscanResult, reached: number = r.order.length): number[] {
  const sizes = new Array<number>(r.clusters).fill(0);
  for (const i of r.order.slice(0, reached)) sizes[r.label[i]] += 1;
  return sizes;
}

/** How many points of an `order` of length n a spread in 0..1 has reached. */
export function reachedCount(n: number, spread: number): number {
  const s = Number.isFinite(spread) ? Math.max(0, Math.min(1, spread)) : 0;
  return Math.round(s * n);
}
