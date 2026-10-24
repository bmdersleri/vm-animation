import { curvePoints, type CurvePoint, type ScoredSample } from '../degerlendirme/curves';
import { CUSTOMERS, LEAK, type LeakRun } from '../dengesiz/data';

/** The SMOTE seed the Ders pages use. */
export const DEFAULT_SEED = 42;

/** The leakage run of a seed (the first run when the seed is unknown). */
export function leakFor(seed: number): LeakRun {
  return LEAK.bySeed.find((r) => r.seed === seed) ?? LEAK.bySeed[0];
}

/** Class counts of the whole data (before any split). */
export const ALL_COUNTS = {
  neg: CUSTOMERS.filter((c) => c.churn === 0).length,
  pos: CUSTOMERS.filter((c) => c.churn === 1).length,
};

/** Class counts of the stratified training part. */
export const TRAIN_COUNTS = {
  neg: CUSTOMERS.filter((c) => c.split === 'train' && c.churn === 0).length,
  pos: CUSTOMERS.filter((c) => c.split === 'train' && c.churn === 1).length,
};

const cache = new WeakMap<readonly ScoredSample[], CurvePoint[]>();

/** `curvePoints` of a score list, computed once per list. */
export function curveOf(samples: readonly ScoredSample[]): CurvePoint[] {
  let pts = cache.get(samples);
  if (!pts) {
    pts = curvePoints(samples);
    cache.set(samples, pts);
  }
  return pts;
}

/** Share of positives among the samples: the PR-AUC of a random ranking, the curve's floor. */
export function positiveRate(samples: readonly ScoredSample[]): number {
  return samples.filter((s) => s.actual === 1).length / samples.length;
}

/**
 * The PR curve as a staircase of (recall, precision): at every threshold the precision holds from the
 * previous recall to the new one (the shape average precision sums). Starts at recall 0, ends at recall 1.
 */
export function staircase(samples: readonly ScoredSample[]): [number, number][] {
  const pts = curveOf(samples).filter((p) => p.precision !== null && p.recall !== null);
  const out: [number, number][] = [];
  const push = (x: number, y: number): void => {
    const last = out[out.length - 1];
    if (!last || last[0] !== x || last[1] !== y) {
      out.push([x, y]);
    }
  };
  push(0, pts[0].precision!);
  let prev = 0;
  for (const p of pts) {
    push(prev, p.precision!);
    push(p.recall!, p.precision!);
    prev = p.recall!;
  }
  return out;
}

/** Precision of a staircase at recall `x` (the first step that reaches it). */
export function precisionAt(stairs: readonly [number, number][], x: number): number {
  const hit = stairs.find((p) => p[0] >= x);
  return hit ? hit[1] : stairs[stairs.length - 1][1];
}

/** The highest threshold at which the samples catch at least `tp` positives, with its precision. */
export function matchCaught(samples: readonly ScoredSample[], tp: number): { threshold: number; precision: number } {
  const hit = curveOf(samples).find((p) => p.threshold !== 'none' && p.confusion.tp >= tp);
  if (!hit || hit.threshold === 'none' || hit.precision === null) {
    throw new RangeError('no threshold catches that many positives');
  }
  return { threshold: hit.threshold, precision: hit.precision };
}
