import { formatNumber } from '../../core/plot/format';

export type Criterion = 'gini' | 'entropi';
/** [class 0 count, class 1 count] */
export type Counts = readonly [number, number];

const total = (c: Counts): number => c[0] + c[1];

/** Impurity of one node; an empty node has impurity 0. */
export function impurity(c: Counts, k: Criterion): number {
  const n = total(c);
  if (n === 0) return 0;
  if (k === 'gini') return 1 - c.reduce((s, x) => s + (x / n) ** 2, 0);
  return c.reduce((s, x) => (x === 0 ? s : s - (x / n) * Math.log2(x / n)), 0);
}

/** Size-weighted impurity of the children. */
export function weighted(children: readonly Counts[], k: Criterion): number {
  const n = children.reduce((s, c) => s + total(c), 0);
  if (n === 0) return 0;
  return children.reduce((s, c) => s + (total(c) / n) * impurity(c, k), 0);
}

/** Impurity decrease (Gini decrease or information gain) of a split. */
export function decrease(parent: Counts, children: readonly Counts[], k: Criterion): number {
  return impurity(parent, k) - weighted(children, k);
}

function childFormula(c: Counts, k: Criterion): string {
  const n = total(c);
  if (k === 'gini') return `1 − (${c[0]}/${n})² − (${c[1]}/${n})²`;
  const terms = c.map((x) => (x === 0 ? '0' : `${x}/${n}·log₂(${x}/${n})`));
  return terms.map((t, i) => (i === 0 ? `−${t}` : `− ${t}`)).join(' ');
}

/** The weighted-impurity formula with the numbers filled in, ending in "= value". */
export function formulaText(children: readonly Counts[], k: Criterion): string {
  const n = children.reduce((s, c) => s + total(c), 0);
  const parts = children
    .filter((c) => total(c) > 0)
    .map((c) => `${total(c)}/${n}·(${childFormula(c, k)})`);
  return `${parts.join(' + ')} = ${formatNumber(weighted(children, k), 3)}`;
}
