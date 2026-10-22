import type { Basket, Itemset } from './data';

/** Number of baskets containing every item of `set`. */
export function count(tx: readonly Basket[], set: Itemset): number {
  let n = 0;
  for (const b of tx) if (set.every((i) => b.includes(i))) n++;
  return n;
}

export function support(tx: readonly Basket[], set: Itemset): number {
  return tx.length === 0 ? 0 : count(tx, set) / tx.length;
}

/** count(X and Y) / count(X); null when X never occurs. */
export function confidence(tx: readonly Basket[], x: Itemset, y: Itemset): number | null {
  const cx = count(tx, x);
  if (cx === 0) return null;
  return count(tx, [...new Set([...x, ...y])]) / cx;
}

/** confidence(X -> Y) / support(Y); null when either denominator is 0. */
export function lift(tx: readonly Basket[], x: Itemset, y: Itemset): number | null {
  const c = confidence(tx, x, y);
  const sy = support(tx, y);
  if (c === null || sy === 0) return null;
  return c / sy;
}
