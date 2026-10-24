import { mulberry32 } from '../../core/random';
import { SCALE, type Customer } from './data';

/** A point in the (standardised) plane. */
export type Pt = { x: number; y: number };

/** A synthetic point with the minority indexes i, j it was built from and the weight lambda. */
export type Synthetic = Pt & { i: number; j: number; lambda: number };

/**
 * For every point the indexes of its k nearest other points (squared Euclidean distance,
 * ties: smaller index). k above n - 1 uses n - 1.
 */
export function neighbours(points: readonly Pt[], k: number): number[][] {
  const kk = Math.min(k, points.length - 1);
  return points.map((p, i) => {
    const d2 = points.map(q => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y));
    return points
      .map((_, j) => j)
      .filter(j => j !== i)
      .sort((a, b) => d2[a] - d2[b] || a - b)
      .slice(0, kk);
  });
}

/**
 * SMOTE: nNew points on the segments between a minority point and one of its k nearest
 * minority neighbours. For each new point, in order: i = floor(r() * n), j = a random
 * neighbour of i, lambda = r(). Python twin: scripts/make_dengesiz_data.py.
 */
export function smote(points: readonly Pt[], k: number, nNew: number, seed: number): Synthetic[] {
  if (nNew <= 0 || points.length < 2) {
    return [];
  }
  const nb = neighbours(points, k);
  const r = mulberry32(seed);
  const out: Synthetic[] = [];
  for (let t = 0; t < nNew; t++) {
    const i = Math.floor(r() * points.length);
    const j = nb[i][Math.floor(r() * nb[i].length)];
    const lambda = r();
    const a = points[i];
    const b = points[j];
    out.push({ x: a.x + lambda * (b.x - a.x), y: a.y + lambda * (b.y - a.y), i, j, lambda });
  }
  return out;
}

/** How many synthetic points bring the minority to ratio times the majority (never negative). */
export function syntheticCount(nMajority: number, nMinority: number, ratio: number): number {
  return Math.max(0, Math.round(ratio * nMajority) - nMinority);
}

/** Random oversampling: for each of n points the number of extra copies (i = floor(r() * n)). */
export function randomOversample(n: number, nNew: number, seed: number): number[] {
  const copies = new Array<number>(n).fill(0);
  const r = mulberry32(seed);
  for (let t = 0; t < nNew; t++) {
    copies[Math.floor(r() * n)]++;
  }
  return copies;
}

/** The standardised plane point of a customer (training mean and deviation). */
export function toScaled(c: Customer): Pt {
  return {
    x: (c.tenure - SCALE.mean[0]) / SCALE.std[0],
    y: (c.charge - SCALE.mean[1]) / SCALE.std[1],
  };
}

/** Back to original units: tenure in months and monthly charge. */
export function fromScaled(p: Pt): { tenure: number; charge: number } {
  return {
    tenure: p.x * SCALE.std[0] + SCALE.mean[0],
    charge: p.y * SCALE.std[1] + SCALE.mean[1],
  };
}
