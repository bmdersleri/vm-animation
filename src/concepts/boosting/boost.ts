import type { Pts } from './data';
import { fitRegTree, predictReg } from './regtree';
import type { RegTree } from './regtree';

/** A boosting run; index k of the error arrays = after k + 1 trees. */
export type BoostRun = { f0: number; trees: RegTree[]; trainMse: number[]; valMse: number[] };

function meanSquare(y: readonly number[], f: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    s += (y[i] - f[i]) ** 2;
  }
  return s / y.length;
}

/**
 * The book's hand loop: F0 = training mean; every tree is fitted (depth `depth`) to the
 * current training residual and added with the learning rate `nu`.
 */
export function boost(train: Pts, val: Pts, nu: number, depth: number, m: number): BoostRun {
  const f0 = train.y.reduce((s, v) => s + v, 0) / train.y.length;
  const f = train.y.map(() => f0);
  const fv = val.y.map(() => f0);
  const run: BoostRun = { f0, trees: [], trainMse: [], valMse: [] };
  for (let k = 0; k < m; k++) {
    const residual = train.y.map((v, i) => v - f[i]);
    const tree = fitRegTree(train.x, residual, { maxDepth: depth });
    for (let i = 0; i < f.length; i++) {
      f[i] += nu * predictReg(tree, train.x[i]);
    }
    for (let i = 0; i < fv.length; i++) {
      fv[i] += nu * predictReg(tree, val.x[i]);
    }
    run.trees.push(tree);
    run.trainMse.push(meanSquare(train.y, f));
    run.valMse.push(meanSquare(val.y, fv));
  }
  return run;
}

/** F after the first `m` trees at x. */
export function predictBoost(run: BoostRun, nu: number, x: number, m: number): number {
  let f = run.f0;
  for (let k = 0; k < m; k++) {
    f += nu * predictReg(run.trees[k], x);
  }
  return f;
}

/** F after the first `m` trees as a piecewise constant function on [x0, x1]. */
export function boostSegments(
  run: BoostRun,
  nu: number,
  m: number,
  x0: number,
  x1: number,
): { x0: number; x1: number; y: number }[] {
  const cuts = new Set<number>();
  for (let k = 0; k < m; k++) {
    for (const n of run.trees[k].nodes) {
      if (n.l !== -1 && n.t > x0 && n.t < x1) {
        cuts.add(n.t);
      }
    }
  }
  const edges = [x0, ...[...cuts].sort((a, b) => a - b), x1];
  const out: { x0: number; x1: number; y: number }[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const mid = (edges[i] + edges[i + 1]) / 2;
    out.push({ x0: edges[i], x1: edges[i + 1], y: predictBoost(run, nu, mid, m) });
  }
  return out;
}

/** Tree count (1-based) of the first smallest value of the curve. */
export function bestIndex(curve: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i] < curve[best]) {
      best = i;
    }
  }
  return best + 1;
}

/**
 * Early stopping on a curve where lower is better: `best` = tree count of the minimum,
 * `stop` = best + patience, or null when the curve is not that long.
 */
export function earlyStop(
  curve: readonly number[],
  patience: number,
): { best: number; stop: number | null } {
  const best = bestIndex(curve);
  const stop = best + patience;
  return { best, stop: stop <= curve.length ? stop : null };
}
