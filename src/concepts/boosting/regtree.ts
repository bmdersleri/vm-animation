/**
 * One node of a one-feature regression tree. A leaf has `l = r = -1` (and `t = 0`);
 * `x <= t` goes left. `v` = mean of the targets at the node, `n` = sample count.
 */
export type RegNode = { t: number; l: number; r: number; v: number; depth: number; n: number };

/**
 * `nodes[0]` is the root. `splits` lists the splits in the order they were made;
 * `gain` is scikit-learn's weighted impurity decrease
 * `(n_t / N) * (imp_t - n_l / n_t * imp_l - n_r / n_t * imp_r)`.
 */
export type RegTree = {
  nodes: RegNode[];
  splits: { node: number; t: number; gain: number }[];
};

type Limit = { maxDepth: number } | { maxLeaves: number };

type Split = { pos: number; t: number };

/** A node that is not a leaf yet and could still be split (best-first growth). */
type Open = { node: number; split: Split; gain: number };

/** scikit-learn: a node whose squared error is at most this is a leaf. */
const EPSILON = Number.EPSILON;

/** scikit-learn skips candidate thresholds between values closer than this. */
const FEATURE_THRESHOLD = 1e-7;

/**
 * Fits a regression tree on one feature the way scikit-learn's DecisionTreeRegressor
 * does. X is cast to float32 first (scikit-learn does the same), the threshold is the
 * midpoint of two consecutive distinct values, and the best split maximises
 * `sumL^2 / nL + sumR^2 / nR` (first one wins on a tie). `maxDepth` grows depth-first;
 * `maxLeaves` grows best-first, always opening the leaf with the largest gain.
 */
export function fitRegTree(
  xs: readonly number[],
  rs: readonly number[],
  limit: { maxDepth: number } | { maxLeaves: number },
): RegTree {
  const total = xs.length;
  const order = xs.map((_, i) => i).sort((a, b) => Math.fround(xs[a]) - Math.fround(xs[b]) || a - b);
  const x = order.map((i) => Math.fround(xs[i]));
  const r = order.map((i) => rs[i]);
  const nodes: RegNode[] = [];
  const splits: RegTree['splits'] = [];
  const ranges: [number, number][] = [];

  /** Sum and squared sum of the targets in [lo, hi). */
  const sums = (lo: number, hi: number): { s: number; q: number } => {
    let s = 0;
    let q = 0;
    for (let i = lo; i < hi; i++) {
      s += r[i];
      q += r[i] * r[i];
    }
    return { s, q };
  };

  /** Squared error of the node: mean of squares minus squared mean. */
  const impurity = (lo: number, hi: number): number => {
    const { s, q } = sums(lo, hi);
    const n = hi - lo;
    const mean = s / n;
    return q / n - mean * mean;
  };

  const addNode = (lo: number, hi: number, depth: number): number => {
    const { s } = sums(lo, hi);
    nodes.push({ t: 0, l: -1, r: -1, v: s / (hi - lo), depth, n: hi - lo });
    ranges.push([lo, hi]);
    return nodes.length - 1;
  };

  /** Best split of [lo, hi), or null when the node is a leaf by itself. */
  const findSplit = (lo: number, hi: number): Split | null => {
    if (hi - lo < 2 || impurity(lo, hi) <= EPSILON) {
      return null;
    }
    const total_ = sums(lo, hi).s;
    let best: Split | null = null;
    let bestProxy = -Infinity;
    let left = 0;
    for (let p = lo + 1; p < hi; p++) {
      left += r[p - 1];
      if (x[p] <= x[p - 1] + FEATURE_THRESHOLD) {
        continue;
      }
      const right = total_ - left;
      const proxy = (left * left) / (p - lo) + (right * right) / (hi - p);
      if (proxy > bestProxy) {
        bestProxy = proxy;
        let t = x[p - 1] / 2 + x[p] / 2;
        if (t === x[p] || !Number.isFinite(t)) {
          t = x[p - 1];
        }
        best = { pos: p, t };
      }
    }
    return best;
  };

  const gainOf = (lo: number, hi: number, split: Split): number => {
    const nt = hi - lo;
    const nl = split.pos - lo;
    const nr = hi - split.pos;
    const decrease =
      impurity(lo, hi) - (nl / nt) * impurity(lo, split.pos) - (nr / nt) * impurity(split.pos, hi);
    return (nt / total) * decrease;
  };

  /** Turns a leaf into a split node and returns its two new children. */
  const apply = (node: number, split: Split, gain: number): [number, number] => {
    const [lo, hi] = ranges[node];
    const depth = nodes[node].depth + 1;
    nodes[node].t = split.t;
    nodes[node].l = addNode(lo, split.pos, depth);
    nodes[node].r = addNode(split.pos, hi, depth);
    splits.push({ node, t: split.t, gain });
    return [nodes[node].l, nodes[node].r];
  };

  const root = addNode(0, total, 0);

  if ('maxDepth' in limit) {
    const grow = (node: number): void => {
      const [lo, hi] = ranges[node];
      if (nodes[node].depth >= limit.maxDepth) {
        return;
      }
      const split = findSplit(lo, hi);
      if (split === null) {
        return;
      }
      const [l, rr] = apply(node, split, gainOf(lo, hi, split));
      grow(l);
      grow(rr);
    };
    grow(root);
    return { nodes, splits };
  }

  const open: Open[] = [];
  const consider = (node: number): void => {
    const [lo, hi] = ranges[node];
    const split = findSplit(lo, hi);
    if (split !== null) {
      open.push({ node, split, gain: gainOf(lo, hi, split) });
    }
  };
  consider(root);
  let leaves = 1;
  while (leaves < limit.maxLeaves && open.length > 0) {
    let pick = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].gain > open[pick].gain) {
        pick = i;
      }
    }
    const [chosen] = open.splice(pick, 1);
    const [l, rr] = apply(chosen.node, chosen.split, chosen.gain);
    leaves += 1;
    consider(l);
    consider(rr);
  }
  return { nodes, splits };
}

/** Prediction of the tree at x (x is cast to float32 like scikit-learn does). */
export function predictReg(tree: RegTree, x: number): number {
  const xf = Math.fround(x);
  let node = tree.nodes[0];
  while (node.l !== -1) {
    node = xf <= node.t ? tree.nodes[node.l] : tree.nodes[node.r];
  }
  return node.v;
}

/** Number of leaves. */
export function leafCount(tree: RegTree): number {
  return tree.nodes.filter((n) => n.l === -1).length;
}

/** Depth of the deepest leaf (a single leaf has depth 0). */
export function treeDepth(tree: RegTree): number {
  return tree.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
}
