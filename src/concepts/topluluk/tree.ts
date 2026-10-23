import type { Tree } from './data';

/**
 * Class of the leaf a point falls in (`x[f] <= t` goes left, as in scikit-learn).
 * A leaf with equal counts answers 0 (Kaldı), like numpy's argmax.
 */
export function predictTree(tree: Tree, x: readonly [number, number]): 0 | 1 {
  let node = tree[0];
  while (node.f !== -1) {
    node = x[node.f] <= node.t ? tree[node.l] : tree[node.r];
  }
  return node.v[1] > node.v[0] ? 1 : 0;
}

/** The question at the root, or null when the tree is a single leaf. */
export function rootSplit(tree: Tree): { f: 0 | 1; t: number } | null {
  const root = tree[0];
  if (root.f === -1) {
    return null;
  }
  return { f: root.f, t: root.t };
}

/** Number of leaves. */
export function leafCount(tree: Tree): number {
  let n = 0;
  for (const node of tree) {
    if (node.f === -1) {
      n++;
    }
  }
  return n;
}
