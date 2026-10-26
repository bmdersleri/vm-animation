import generated from './data/xai.json';

/** The three book features, in bit order of the coalition masks (bit 0 = tenure). */
export const FEATURES = ['tenure', 'MonthlyCharges', 'TotalCharges'] as const;

export type FeatureIndex = 0 | 1 | 2;
export type Triple = [number, number, number];

/** Split, test accuracy, forest importances and the global SHAP numbers. */
export interface Model {
  nTrain: number;
  nTest: number;
  /** Class counts [kalir, ayrilir] of the training and the test part. */
  trainCounts: [number, number];
  testCounts: [number, number];
  accuracy: number;
  importances: Triple;
  /** Base value v(empty set): the mean over the trees of the root churn rate. */
  base: number;
  /** Mean |SHAP| over the 100 test customers. */
  meanAbsShap: Triple;
  /** Test customers whose most influential feature differs between SHAP and LIME (seed 42, 5000 samples). */
  topDisagree: number;
  /** Trees of the forest (`n_estimators`). */
  nEstimators: number;
}

/** One test customer; `v[mask]` is the coalition value (bit 0 tenure, bit 1 MonthlyCharges, bit 2 TotalCharges). */
export interface Customer {
  row: number;
  values: Triple;
  label: 0 | 1;
  p: number;
  shap: Triple;
  v: number[];
}

export interface Bins {
  /** Three training quartile cuts per feature. */
  cuts: Triple[];
  /** Four lime-style rule names per feature. */
  names: string[][];
  /** Training count per bin. */
  freqs: number[][];
}

/** Samples sharing one binary pattern; bit j of `mask` = the sample feature j is in the customer bin. */
export interface Pattern {
  mask: number;
  n: number;
  mean: number;
  /** Within-pattern sum of squares of p. */
  ss: number;
}

export interface LimeResult {
  coef: Triple;
  intercept: number;
  localPred: number;
  /** Weighted R^2; null when the weighted total variance vanishes (the data always stores a number). */
  score: number | null;
}

export interface LimeRun {
  row: number;
  seed: number;
  samples: number;
  /** The customer bin index per feature. */
  bins: Triple;
  /** Eight patterns in mask order. */
  patterns: Pattern[];
  /** sklearn Ridge at the default kernel width. */
  fit: LimeResult;
}

export const MODEL: Model = generated.model as Model;

export const CUSTOMERS: Customer[] = generated.customers as Customer[];

const BY_ROW = new Map<number, Customer>(CUSTOMERS.map(c => [c.row, c]));

/** The test customer with this data row number. */
export function customerByRow(row: number): Customer {
  const customer = BY_ROW.get(row);
  if (!customer) {
    throw new Error(`no test customer with row ${row}`);
  }
  return customer;
}

/** Preset customers: the book one, the disagreement, a middle-risk one, a low-risk one (data rows). */
export const PRESETS = [301, 77, 217, 176] as const;

export const BINS: Bins = generated.bins as Bins;

export const SEEDS = [42, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const SAMPLE_SIZES = [50, 100, 500, 1000, 5000];

/** LIME default kernel width, 0.75 * sqrt(number of features). */
export const KERNEL_WIDTH = 0.75 * Math.sqrt(3);

export const LIME_RUNS: LimeRun[] = generated.runs.map(r => ({
  row: r.row,
  seed: r.seed,
  samples: r.samples,
  bins: r.bins as Triple,
  patterns: r.patterns.map(([n, mean, ss], mask) => ({ mask, n, mean, ss })),
  fit: r.fit as LimeResult,
}));

const RUN_INDEX = new Map<string, LimeRun>(LIME_RUNS.map(r => [`${r.row}/${r.seed}/${r.samples}`, r]));

/** The prepared run for a preset customer, seed and sample size. */
export function limeRun(row: number, seed: number, samples: number): LimeRun {
  const run = RUN_INDEX.get(`${row}/${seed}/${samples}`);
  if (!run) {
    throw new Error(`no LIME run for ${row} / ${seed} / ${samples}`);
  }
  return run;
}

/** All 100 test customers at seed 42 and 5000 samples. */
export const LIME_ALL: { row: number; bins: Triple; fit: LimeResult }[] = generated.all as {
  row: number;
  bins: Triple;
  fit: LimeResult;
}[];

type Cloud = { values: Triple[]; mask: number[]; p: number[] };

/** The first 500 samples of the seed 42 / 5000 run per preset customer (the first is the customer). */
export const CLOUD: Record<number, Cloud> = Object.fromEntries(
  Object.entries(generated.cloud).map(([row, c]) => [Number(row), c as Cloud]),
);

/** The book corrected debugging code (n_estimators=100): p and SHAP (tenure, MonthlyCharges, TotalCharges) of customer 301. */
export const BOOK = { fixedCodeP: generated.book.fixedCodeP, fixedCodeShap: generated.book.fixedCodeShap as Triple };
