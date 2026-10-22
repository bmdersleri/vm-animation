import type { Basket, Itemset } from './data';
import { aprioriTrace } from './apriori';
import { keyToSet, setKey } from './format';

export interface Rule {
  readonly x: Itemset;
  readonly y: Itemset;
  readonly support: number;
  readonly confidence: number;
  readonly lift: number;
}

const EPS = 1e-9;
const r6 = (v: number): number => Math.round(v * 1e6);

/** Smallest basket count whose support reaches `minSupport` (float-safe). */
export function minCountFor(minSupport: number, n: number): number {
  return Math.max(1, Math.ceil(minSupport * n - EPS));
}

/**
 * The rule set of mlxtend `association_rules` on `apriori` output. Sorted by lift desc,
 * then confidence desc, then "x->y" text (compared at 6 decimals).
 */
export function rules(tx: readonly Basket[], minSupport: number, minConfidence: number): Rule[] {
  const n = tx.length;
  if (n === 0) return [];
  const { frequent } = aprioriTrace(tx, minCountFor(minSupport, n));
  const out: Rule[] = [];
  for (const [key, cnt] of frequent) {
    const set = keyToSet(key);
    if (set.length < 2) continue;
    for (let mask = 1; mask < (1 << set.length) - 1; mask++) {
      const x = set.filter((_, i) => mask & (1 << i));
      const y = set.filter((_, i) => !(mask & (1 << i)));
      const confidence = cnt / (frequent.get(setKey(x)) as number);
      if (confidence < minConfidence - EPS) continue;
      const sy = (frequent.get(setKey(y)) as number) / n;
      out.push({ x, y, support: cnt / n, confidence, lift: confidence / sy });
    }
  }
  const text = (r: Rule): string => `${setKey(r.x)}->${setKey(r.y)}`;
  return out.sort(
    (a, b) =>
      r6(b.lift) - r6(a.lift) ||
      r6(b.confidence) - r6(a.confidence) ||
      (text(a) < text(b) ? -1 : text(a) > text(b) ? 1 : 0),
  );
}
