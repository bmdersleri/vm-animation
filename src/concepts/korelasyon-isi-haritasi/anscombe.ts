import { pearson } from '../../core/stats';
import { ANSCOMBE_JSON, type AnscombeSet, type Leverage } from './data';

export type { AnscombeSet };

/** The four classic Anscombe sets: same summary, four different pictures. */
export const ANSCOMBE: AnscombeSet[] = ANSCOMBE_JSON.sets;

/** Set IV's single high-x point: display number 4, array index 7. */
export const LEVERAGE: Leverage = ANSCOMBE_JSON.leverage;

/**
 * Set `setIndex`'s leverage point moved to `y`, then Pearson of the whole set.
 * Moving the point never empties x's spread, so the result stays defined for every y.
 */
export function anscombeR(setIndex: number, y: number): number {
  const set = ANSCOMBE[setIndex];
  if (!set) return NaN;
  const ys = [...set.y];
  ys[LEVERAGE.index] = y;
  return pearson(set.x, ys);
}

/** Set IV without its leverage point: the remaining x is constant, so Pearson is NaN. */
export function anscombeWithoutLeverage(): number {
  const set = ANSCOMBE[LEVERAGE.set - 1];
  const keep = set.x.map((_, i) => i).filter((i) => i !== LEVERAGE.index);
  return pearson(keep.map((i) => set.x[i]), keep.map((i) => set.y[i]));
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
