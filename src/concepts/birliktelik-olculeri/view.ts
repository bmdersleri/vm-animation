import { sepetData, type Basket, type Item, type Itemset } from '../birliktelik/data';
import { setBraces, setNames, sortItems } from '../birliktelik/format';
import { count } from '../birliktelik/metrics';
import { formatNumber, formatPercent } from '../../core/plot/format';

export const UNDEFINED = '— (tanımsız)';

/** A ratio with three decimals and a decimal comma: 0,636. */
export const ratioText = (v: number | null): string => (v === null ? UNDEFINED : formatNumber(v, 3));

/** A ratio as a percentage with one decimal: %63,6. */
export const percentText = (v: number): string => formatPercent(v, 1);

/**
 * The book's baskets with the Lab's cell edits applied. An edit is a cell code `row * items + column`;
 * a code listed an odd number of times toggles that cell. Baskets stay in product order.
 */
export function applyEdits(edits: readonly number[]): Basket[] {
  const items = sepetData.items;
  const flips = new Map<number, number>();
  for (const e of edits) if (Number.isInteger(e) && e >= 0) flips.set(e, (flips.get(e) ?? 0) + 1);
  return sepetData.transactions.map((b, row) =>
    items.filter((item, col) => b.includes(item) !== ((flips.get(row * items.length + col) ?? 0) % 2 === 1)),
  );
}

export interface Measures {
  /** Baskets. */
  n: number;
  /** Baskets containing X, Y, and both. */
  cx: number;
  cy: number;
  cxy: number;
  /** support(X ∪ Y). */
  support: number;
  /** support(Y): the base rate. null when there are no baskets. */
  base: number | null;
  /** count(X ∪ Y) / count(X); null when X never occurs. */
  confidence: number | null;
  /** confidence / support(Y); null when either denominator is 0. */
  lift: number | null;
}

const union = (x: Itemset, y: Itemset): Item[] => sortItems([...new Set([...x, ...y])]);

/** Counts and the three measures of the rule X -> Y (both sets non-empty), all from the baskets. */
export function measures(tx: readonly Basket[], x: Itemset, y: Itemset): Measures {
  const n = tx.length;
  const cx = count(tx, x);
  const cy = count(tx, y);
  const cxy = count(tx, union(x, y));
  const base = n === 0 ? null : cy / n;
  const confidence = cx === 0 ? null : cxy / cx;
  const lift = confidence === null || base === null || base === 0 ? null : confidence / base;
  return { n, cx, cy, cxy, support: n === 0 ? 0 : cxy / n, base, confidence, lift };
}

const fraction = (num: number, den: number): string => `${num} / ${den}`;
const rule = (x: Itemset, y: Itemset): string => `${setNames(x)} → ${setNames(y)}`;

/** "destek({Ekmek, Süt}) = 7 / 18 = 0,389" (a single item reads "destek(Ekmek)"). */
export function supportStrip(tx: readonly Basket[], set: Itemset): string {
  const c = count(tx, set);
  const label = set.length === 1 ? setNames(set) : setBraces(set);
  return `destek(${label}) = ${fraction(c, tx.length)} = ${tx.length === 0 ? UNDEFINED : ratioText(c / tx.length)}`;
}

/** "güven(Ekmek → Süt) = 7 / 11 = 0,636"; an X that never occurs reads "0 / 0 = — (tanımsız)". */
export function confidenceStrip(tx: readonly Basket[], x: Itemset, y: Itemset): string {
  const m = measures(tx, x, y);
  return `güven(${rule(x, y)}) = ${fraction(m.cxy, m.cx)} = ${ratioText(m.confidence)}`;
}

/** "taban oran = destek(Süt) = 12 / 18 = 0,667". */
export function baseStrip(tx: readonly Basket[], y: Itemset): string {
  const cy = count(tx, y);
  const label = y.length === 1 ? setNames(y) : setBraces(y);
  return `taban oran = destek(${label}) = ${fraction(cy, tx.length)} = ${tx.length === 0 ? UNDEFINED : ratioText(cy / tx.length)}`;
}

/** "kaldıraç(Ekmek → Süt) = 0,636 / 0,667 = 0,955"; undefined when confidence or the base rate is. */
export function liftStrip(tx: readonly Basket[], x: Itemset, y: Itemset): string {
  const m = measures(tx, x, y);
  const head = `kaldıraç(${rule(x, y)})`;
  if (m.lift === null) return `${head} = ${UNDEFINED}`;
  return `${head} = ${ratioText(m.confidence)} / ${ratioText(m.base)} = ${ratioText(m.lift)}`;
}

/** "Fiş 4: Ekmek, Süt, Yumurta, Tereyağı" (1-based basket number). */
export function basketLine(tx: readonly Basket[], row: number): string {
  return `Fiş ${row + 1}: ${tx[row].length === 0 ? 'boş sepet' : setNames(tx[row])}`;
}
