import raw from './data/secim_data.json';

export type Scaling = 'yok' | 'standard';

export interface RfeRound {
  remaining: number[];
  /** |beta| of each remaining column in this round. */
  coef: number[];
  eliminated: number;
}

export interface RfePath {
  /** Column indices in elimination order; the last one survives. */
  order: number[];
  rounds: RfeRound[];
  /** The refit on the last survivor (RFE(n_features_to_select=1).estimator_). */
  final: { remaining: number[]; coef: number[] };
}

const data = raw as unknown as {
  columns: string[];
  values: number[][];
  churn: (0 | 1)[];
  variance: number[];
  rfe: Record<Scaling, RfePath>;
};

export const COLUMNS: readonly string[] = data.columns;
/** Column-major: VALUES[column][customer], 8 x 400. */
export const VALUES: readonly (readonly number[])[] = data.values;
export const CHURN: readonly (0 | 1)[] = data.churn;
/** VarianceThreshold.variances_ (ddof 0); only for cross-checks, the view computes its own. */
export const VARIANCE: readonly number[] = data.variance;
export const RFE: Record<Scaling, RfePath> = data.rfe;
