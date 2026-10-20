import { impurity, weighted, type Counts, type Criterion } from './impurity';
import type { Row } from './data';

export interface Sample {
  /** x[0] = contract months, x[1] = complaints. */
  x: [number, number];
  y: 0 | 1;
}
export interface SweepPoint {
  threshold: number;
  impurity: number;
}
export interface Split {
  feature: 0 | 1;
  threshold: number;
  impurity: number;
  left: Counts;
  right: Counts;
}
type Range = readonly [number, number];
export interface TreeNode {
  counts: Counts;
  split: Split | null;
  left: TreeNode | null;
  right: TreeNode | null;
  depth: number;
  /** Region of the data space this node covers. */
  box: { x: [number, number]; y: [number, number] };
}

/** Samples from display rows (the `jy` jitter is display-only and dropped). */
export function toSamples(rows: Row[]): Sample[] {
  return rows.map((r) => ({ x: [r.t, r.c], y: r.y }));
}

/** Midpoints of consecutive sorted unique values. */
export function thresholds(values: number[]): number[] {
  const u = [...new Set(values)].sort((a, b) => a - b);
  return u.slice(1).map((v, i) => (u[i] + v) / 2);
}

function countClasses(s: Sample[]): Counts {
  let n1 = 0;
  for (const p of s) n1 += p.y;
  return [s.length - n1, n1];
}

function childCounts(s: Sample[], feature: 0 | 1, threshold: number): [Counts, Counts] {
  const l: [number, number] = [0, 0];
  const r: [number, number] = [0, 0];
  for (const p of s) (p.x[feature] <= threshold ? l : r)[p.y]++;
  return [l, r];
}

/** Weighted child impurity at every midpoint threshold of one feature. */
export function sweep(s: Sample[], feature: 0 | 1, k: Criterion): SweepPoint[] {
  return thresholds(s.map((p) => p.x[feature])).map((threshold) => {
    const [l, r] = childCounts(s, feature, threshold);
    return { threshold, impurity: weighted([l, r], k) };
  });
}

/** Best split: features in order, thresholds ascending, only a strictly better (1e-12) one wins. */
export function bestSplit(s: Sample[], k: Criterion): Split | null {
  let best: Split | null = null;
  for (const feature of [0, 1] as const) {
    for (const threshold of thresholds(s.map((p) => p.x[feature]))) {
      const [left, right] = childCounts(s, feature, threshold);
      const imp = weighted([left, right], k);
      if (best === null || imp < best.impurity - 1e-12) {
        best = { feature, threshold, impurity: imp, left, right };
      }
    }
  }
  return best;
}

/** A split at a user-chosen threshold (Lab drag); a side may be empty. */
export function forcedSplit(s: Sample[], feature: 0 | 1, threshold: number, k: Criterion): Split {
  const [left, right] = childCounts(s, feature, threshold);
  return { feature, threshold, impurity: weighted([left, right], k), left, right };
}

export function buildTree(
  s: Sample[],
  maxDepth: number,
  k: Criterion,
  domain: { readonly x: Range; readonly y: Range },
): TreeNode {
  const grow = (rows: Sample[], depth: number, box: TreeNode['box']): TreeNode => {
    const counts = countClasses(rows);
    const leaf: TreeNode = { counts, split: null, left: null, right: null, depth, box };
    if (depth >= maxDepth || impurity(counts, k) === 0) return leaf;
    const split = bestSplit(rows, k);
    if (!split) return leaf;
    const f = split.feature;
    const axis = f === 0 ? 'x' : 'y';
    const lbox = { x: [...box.x] as [number, number], y: [...box.y] as [number, number] };
    const rbox = { x: [...box.x] as [number, number], y: [...box.y] as [number, number] };
    lbox[axis][1] = split.threshold;
    rbox[axis][0] = split.threshold;
    return {
      counts,
      split,
      left: grow(rows.filter((p) => p.x[f] <= split.threshold), depth + 1, lbox),
      right: grow(rows.filter((p) => p.x[f] > split.threshold), depth + 1, rbox),
      depth,
      box,
    };
  };
  return grow(s, 0, {
    x: [domain.x[0], domain.x[1]],
    y: [domain.y[0], domain.y[1]],
  });
}

/** Majority class of the leaf reached; ties go to class 0. */
export function predict(t: TreeNode, x: [number, number]): 0 | 1 {
  let n = t;
  while (n.split && n.left && n.right) {
    n = x[n.split.feature] <= n.split.threshold ? n.left : n.right;
  }
  return n.counts[1] > n.counts[0] ? 1 : 0;
}

export function accuracy(t: TreeNode, s: Sample[]): number {
  if (s.length === 0) return 0;
  return s.filter((p) => predict(t, p.x) === p.y).length / s.length;
}

/** Number of internal nodes with depth <= `depth` (drives the growth animation). */
export function countTo(t: TreeNode, depth: number): number {
  if (!t.split || t.depth > depth) return 0;
  return 1 + (t.left ? countTo(t.left, depth) : 0) + (t.right ? countTo(t.right, depth) : 0);
}
