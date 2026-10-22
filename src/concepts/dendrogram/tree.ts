import type { LinkageData } from './data';

export interface Branch {
  /** n + merge index. */
  readonly id: number;
  /** Children ids, ordered so that `left` is drawn left of `right`. */
  readonly left: number;
  readonly right: number;
  /** x slot of the branch (midpoint of the children's x). */
  readonly x: number;
  readonly xl: number;
  readonly xr: number;
  /** Heights of the children (0 for a leaf). */
  readonly yl: number;
  readonly yr: number;
  readonly height: number;
  /** Point indices below the branch, ascending. */
  readonly members: readonly number[];
}

/** x slot (0..n-1) of each point, by scipy leaf order. */
export function leafX(ld: LinkageData): readonly number[] {
  const x = new Array<number>(ld.leaves.length).fill(0);
  ld.leaves.forEach((p, slot) => {
    x[p] = slot;
  });
  return x;
}

/** One branch per merge, in merge order. */
export function branches(ld: LinkageData, n: number): readonly Branch[] {
  const lx = leafX(ld);
  const out: Branch[] = [];
  const x = (id: number): number => (id < n ? lx[id] : out[id - n].x);
  const h = (id: number): number => (id < n ? 0 : out[id - n].height);
  const mem = (id: number): readonly number[] => (id < n ? [id] : out[id - n].members);
  ld.merges.forEach((m, i) => {
    const [left, right] = x(m.a) <= x(m.b) ? [m.a, m.b] : [m.b, m.a];
    const xl = x(left);
    const xr = x(right);
    out.push({
      id: n + i,
      left,
      right,
      x: (xl + xr) / 2,
      xl,
      xr,
      yl: h(left),
      yr: h(right),
      height: m.height,
      members: [...mem(left), ...mem(right)].sort((p, q) => p - q),
    });
  });
  return out;
}

function root(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

/** Union-find over the merges selected by `use`; merge i creates id n + i. Returns each point's root. */
function apply(ld: LinkageData, n: number, use: (i: number, height: number) => boolean): number[] {
  const parent = Array.from({ length: 2 * n - 1 }, (_, i) => i);
  ld.merges.forEach((m, i) => {
    if (!use(i, m.height)) return;
    parent[root(parent, m.a)] = n + i;
    parent[root(parent, m.b)] = n + i;
  });
  return Array.from({ length: n }, (_, p) => root(parent, p));
}

function renumber(ld: LinkageData, roots: readonly number[]): number[] {
  const map = new Map<number, number>();
  const labels = new Array<number>(roots.length).fill(0);
  for (const p of ld.leaves) {
    if (!map.has(roots[p])) map.set(roots[p], map.size);
    labels[p] = map.get(roots[p])!;
  }
  return labels;
}

/** Cluster labels with every merge of height <= t applied (scipy fcluster "distance"); numbered left to right. */
export function labelsAtHeight(ld: LinkageData, n: number, t: number): readonly number[] {
  return renumber(ld, apply(ld, n, (_, h) => h <= t));
}

export function kAtHeight(ld: LinkageData, t: number): number {
  return ld.merges.length + 1 - ld.merges.filter((m) => m.height <= t).length;
}

/** Midpoint of the k range. */
export function cutForK(ld: LinkageData, k: number): number {
  const c = ld.cuts.find((cut) => cut.k === k);
  if (!c) throw new RangeError(`no cut stored for k=${k}`);
  return (c.low + c.high) / 2;
}

/** The widest gap between consecutive merge heights among the stored k >= 2 ranges (k = 1 has no upper merge). */
export function largestGap(ld: LinkageData): { readonly k: number; readonly low: number; readonly high: number } {
  let best = ld.cuts.find((c) => c.k === 2)!;
  for (const c of ld.cuts) if (c.k >= 2 && c.high - c.low > best.high - best.low) best = c;
  return { k: best.k, low: best.low, high: best.high };
}

/** Clusters after the first `merges` merges, each ascending, ordered by leftmost leaf slot. */
export function clustersAfter(ld: LinkageData, n: number, merges: number): readonly (readonly number[])[] {
  const labels = renumber(ld, apply(ld, n, (i) => i < merges));
  const out: number[][] = [];
  labels.forEach((l, p) => (out[l] ??= []).push(p));
  return out;
}
