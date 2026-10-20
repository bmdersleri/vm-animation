export interface Natural {
  sick: number;
  tp: number;
  fn: number;
  healthy: number;
  fp: number;
  tn: number;
  /** tp / (tp + fp) from the rounded counts; null when nobody tests positive. */
  posterior: number | null;
  /** Exact Bayes posterior, without rounding. */
  exact: number;
}

const POPULATION = 1000;

/** Posterior P(sick | positive) from whole-person counts. */
export function posteriorOf(tp: number, fp: number): number | null {
  return tp + fp === 0 ? null : tp / (tp + fp);
}

/** 1.000 people with whole-person counts: each stage is rounded, as the spec requires. */
export function naturalCounts(prior: number, sens: number, fpr: number): Natural {
  const sick = Math.round(POPULATION * prior);
  const tp = Math.round(sick * sens);
  const healthy = POPULATION - sick;
  const fp = Math.round(healthy * fpr);
  const num = prior * sens;
  const den = num + (1 - prior) * fpr;
  return {
    sick,
    tp,
    fn: sick - tp,
    healthy,
    fp,
    tn: healthy - fp,
    posterior: posteriorOf(tp, fp),
    exact: den === 0 ? 0 : num / den,
  };
}
