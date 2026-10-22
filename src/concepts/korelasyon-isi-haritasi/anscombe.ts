import { pearson } from '../../core/stats';
import { ANSCOMBE_JSON, type AnscombeSet, type Leverage } from './data';

export type { AnscombeSet };

/** The four classic Anscombe sets: same summary, four different pictures. */
export const ANSCOMBE: AnscombeSet[] = ANSCOMBE_JSON.sets;

/** Set IV's single high-x point: display number 4, array index 7. */
export const LEVERAGE: Leverage = ANSCOMBE_JSON.leverage;

/**
 * Set `setIndex`'s leverage point moved to `y`, then Pearson of the whole set.
 * NaN when what remains leaves x constant — exactly set IV with the point dropped.
 */
export function anscombeR(setIndex: number, y: number): number {
  const set = ANSCOMBE[setIndex];
  if (!set) return NaN;
  const ys = [...set.y];
  ys[LEVERAGE.index] = y;
  return pearson(set.x, ys);
}

/** Average ranks, ties sharing their mean rank (scipy's spearmanr convention). */
function ranks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const out = new Array<number>(xs.length);
  for (let k = 0; k < order.length; k++) {
    let j = k;
    while (j + 1 < order.length && order[j + 1].x === order[k].x) j++;
    const rank = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) out[order[m].i] = rank;
    k = j;
  }
  return out;
}

/** Spearman's rho: Pearson on the ranks. Set II's rho is 0,691 against Pearson's 0,816. */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  return pearson(ranks(xs), ranks(ys));
}
