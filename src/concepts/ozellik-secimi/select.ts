import { variance } from '../../core/stats';
import { CHURN, COLUMNS, VALUES, type RfePath } from './data';

export type VtThreshold = 0 | 0.01 | 1 | 10;
export const VT_OPTIONS: readonly VtThreshold[] = [0, 0.01, 1, 10];

/** Population variance (ddof 0) of every column, like VarianceThreshold.variances_. */
export const VARIANCES: readonly number[] = VALUES.map((col) => variance(col));

/** VarianceThreshold.get_support: variance strictly above the threshold. */
export function varianceSupport(vars: readonly number[], t: number): boolean[] {
  return vars.map((v) => v > t);
}

/** One-way ANOVA F for two classes (f_classif); NaN when the within-group sum of squares is 0. */
export function fClassif(xs: readonly number[], y: readonly (0 | 1)[]): number {
  const sum = [0, 0];
  const cnt = [0, 0];
  xs.forEach((x, i) => { sum[y[i]] += x; cnt[y[i]]++; });
  const mean = [sum[0] / cnt[0], sum[1] / cnt[1]];
  const grand = (sum[0] + sum[1]) / xs.length;
  const ssb = cnt[0] * (mean[0] - grand) ** 2 + cnt[1] * (mean[1] - grand) ** 2;
  let ssw = 0;
  xs.forEach((x, i) => { ssw += (x - mean[y[i]]) ** 2; });
  if (ssw === 0) return NaN;
  return ssb / 1 / (ssw / (xs.length - 2));
}

export const F_SCORES: readonly number[] = VALUES.map((col) => fClassif(col, CHURN));

/** Score order: largest first, NaN last, ties by column index. */
export function scoreOrder(scores: readonly number[]): number[] {
  const key = (v: number): number => (Number.isNaN(v) ? -Infinity : v);
  return scores
    .map((_, i) => i)
    .sort((a, b) => key(scores[b]) - key(scores[a]) || a - b);
}

/** SelectKBest.get_support: the first k of scoreOrder, as a column mask. */
export function selectKBest(scores: readonly number[], k: number): boolean[] {
  const mask = scores.map(() => false);
  for (const c of scoreOrder(scores).slice(0, k)) mask[c] = true;
  return mask;
}

/** RFE.support_: the last n columns of the elimination order. */
export function rfeSelected(path: RfePath, n: number): boolean[] {
  const mask = COLUMNS.map(() => false);
  for (const c of path.order.slice(COLUMNS.length - n)) mask[c] = true;
  return mask;
}

/** RFE.ranking_: survivors 1, the last eliminated 2, and so on up to the first eliminated. */
export function rfeRanking(path: RfePath, n: number): number[] {
  const out = COLUMNS.map(() => 1);
  const cut = COLUMNS.length - n;
  path.order.slice(0, cut).forEach((c, i) => { out[c] = cut - i + 1; });
  return out;
}

export interface RfeState {
  /** Rounds shown, 0 … 8 − n. */
  shown: number;
  eliminated: { col: number; round: number }[];
  /** |beta| of this round's model: column → value. */
  coef: Map<number, number>;
  lastElim: number | null;
  survivors: number[];
}

/** `rounds` rounds (capped at 8 − n); the coefficients come from rounds[max(shown, 1) − 1]. */
export function rfeState(path: RfePath, n: number, rounds: number): RfeState {
  const shown = Math.max(0, Math.min(rounds, COLUMNS.length - n));
  const eliminated = path.order.slice(0, shown).map((col, i) => ({ col, round: i + 1 }));
  const model = path.rounds[Math.max(shown, 1) - 1];
  const coef = new Map<number, number>();
  model.remaining.forEach((c, i) => coef.set(c, model.coef[i]));
  const gone = new Set(eliminated.map((e) => e.col));
  return {
    shown,
    eliminated,
    coef,
    lastElim: shown > 0 ? path.order[shown - 1] : null,
    survivors: COLUMNS.map((_, c) => c).filter((c) => !gone.has(c)),
  };
}

/** Selected column names in COLUMNS order. */
export function names(mask: readonly boolean[]): string[] {
  return COLUMNS.filter((_, c) => mask[c]);
}
