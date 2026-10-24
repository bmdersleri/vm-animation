import generated from './data/boosting.json';
import type { RegNode } from './regtree';

/** Points of a one-feature regression set. */
export type Pts = { x: readonly number[]; y: readonly number[] };

/** Classification curves of one learning rate; index k = k + 1 trees. */
export type LrCurve = {
  lr: number;
  trainLoss: readonly number[];
  valLoss: readonly number[];
  valAuc: readonly number[];
};

type Generated = {
  reg: { train: Pts; val: Pts; mean: number };
  book: {
    nu: number;
    depth: number;
    mse: number[];
    trees: Pick<RegNode, 't' | 'l' | 'r' | 'v'>[][];
  };
  curves: { lrs: number[]; byLr: LrCurve[] };
  surface: {
    depths: number[];
    lrs: number[];
    auc: number[][];
    nTrees: number;
    cv: number;
  };
};

const data = generated as unknown as Generated;

/** The book's regression data (rounded to 4 decimals) and the training mean of y. */
export const REG: { train: Pts; val: Pts; mean: number } = data.reg;

/** The book's hand loop: learning rate, depth and the training error after each of 5 trees. */
export const BOOK: { nu: number; depth: number; mse: readonly number[] } = {
  nu: data.book.nu,
  depth: data.book.depth,
  mse: data.book.mse,
};

/** Classifier curves for six learning rates, 500 trees each (index k = k + 1 trees). */
export const CURVES: { lrs: readonly number[]; byLr: readonly LrCurve[] } = data.curves;

/** The five learning rates of the book's comparison. */
export const BOOK_LRS: readonly number[] = [0.01, 0.05, 0.1, 0.3, 0.5];

/** The AUC values the book prints for XGBoost at those rates (only for the "differences" sentence). */
export const BOOK_XGB_AUC: readonly number[] = [0.9261, 0.9625, 0.9713, 0.9711, 0.9693];

/** Search surface: cross-validated AUC for depth (rows) by learning rate (columns). */
export const SURFACE: {
  depths: readonly number[];
  lrs: readonly number[];
  auc: readonly (readonly number[])[];
  nTrees: number;
  cv: number;
} = data.surface;
