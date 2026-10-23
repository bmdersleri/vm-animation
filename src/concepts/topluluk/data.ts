import generated from './data/topluluk.json';

/**
 * One node of a scikit-learn decision tree (array layout, node 0 = root).
 * A leaf has `f = -1`; `x[f] <= t` goes to `l`, otherwise to `r`.
 * `v` = training counts [Kaldı, Ayrıldı] at the node.
 */
export type TreeNode = {
  f: -1 | 0 | 1;
  t: number;
  l: number;
  r: number;
  v: [number, number];
};

export type Tree = readonly TreeNode[];

/** A Chapter 5 training customer: contract months, complaints, class (1 = Ayrıldı), display jitter. */
export type Customer = { t: number; c: number; y: 0 | 1; jy: number };

/** One bootstrap: the 25 draws, how often each customer was drawn, and the tree grown on it. */
export type Boot = { draws: number[]; counts: number[]; tree: Tree };

export type RfRow = {
  mf: number;
  /** How many of the 250 trees split on each feature at the root (all 600 rows). */
  roots: number[];
  oob: number;
  test: number;
  /** Mean test accuracy of a single tree of the forest. */
  treeAcc: number;
  /** Mean pairwise correlation of the trees' Ayrıldı probabilities on the test set. */
  rho: number;
};

type Generated = {
  customers: Customer[];
  single: TreeNode[];
  boots: Boot[];
  bookBoot: { ids: number[]; sample: number[]; counts: number[]; oob: number[] };
  experiment: { tree: number[]; bagging: number[] };
  oobCv: { oob: number; cv: number[]; seconds: { oob: number; cv: number } };
  oobCurve: { n: number; oob: number }[];
  rf: {
    names: string[];
    byMf: RfRow[];
    mdi: number[];
    withId: { names: string[]; mdi: number[]; perm: number[] };
  };
  picks: { vote: number; oob: number };
  nodeDemo: { drawn: [number, number]; winner: number };
};

const data = generated as unknown as Generated;

/** The 25 training customers of the Chapter 5 page. */
export const CUSTOMERS: readonly Customer[] = data.customers;

/** The full-depth tree on all 25 customers. */
export const SINGLE: Tree = data.single;

/** The 50 bootstrap draws and their full-depth trees. */
export const BOOTS: readonly Boot[] = data.boots;

/** The book's ch09_kod01 bootstrap of the ids 0-9. */
export const BOOK_BOOT: Generated['bookBoot'] = data.bookBoot;

/** ch09_kod02: accuracy of a single tree and of 50-tree bagging on 10 splits. */
export const EXPERIMENT: Generated['experiment'] = data.experiment;

/** ch09_kod04: OOB score, the 5 CV scores and the book's measured seconds. */
export const OOB_CV: Generated['oobCv'] = data.oobCv;

/** OOB score for 10, 20, ..., 500 trees. */
export const OOB_CURVE: readonly { n: number; oob: number }[] = data.oobCurve;

/** The 8-feature forest data: roots, OOB, test accuracy and correlation per max_features; importances. */
export const RF: Generated['rf'] = data.rf;

/** Marked customers: page 1 step 7 (vote) and page 2 step 5 (OOB row). */
export const PICKS: Generated['picks'] = data.picks;

/** Page 2 step 2: the two features a node may look at and the one the best split uses. */
export const NODE_DEMO: Generated['nodeDemo'] = data.nodeDemo;
