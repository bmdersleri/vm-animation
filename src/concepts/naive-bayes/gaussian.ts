export interface GaussModel {
  prior: [number, number];
  /** theta[class][feature], as in scikit-learn. */
  theta: [number, number][];
  /** var[class][feature], smoothed, as in scikit-learn. */
  var: [number, number][];
}

type Row = [number, number];

/** scikit-learn GaussianNB: var_smoothing = 1e-9 · largest feature variance (ddof 0). */
export function fitGaussian(x: Row[], y: (0 | 1)[]): GaussModel {
  const n = x.length;
  const feat = [0, 1].map((f) => {
    const m = x.reduce((s, r) => s + r[f], 0) / n;
    return x.reduce((s, r) => s + (r[f] - m) ** 2, 0) / n;
  });
  const eps = 1e-9 * Math.max(feat[0], feat[1]);
  const prior: Row = [0, 0];
  const theta: Row[] = [[0, 0], [0, 0]];
  const variance: Row[] = [[0, 0], [0, 0]];
  for (const k of [0, 1] as const) {
    const rows = x.filter((_, i) => y[i] === k);
    prior[k] = rows.length / n;
    for (const f of [0, 1] as const) {
      const m = rows.reduce((s, r) => s + r[f], 0) / rows.length;
      theta[k][f] = m;
      variance[k][f] = rows.reduce((s, r) => s + (r[f] - m) ** 2, 0) / rows.length + eps;
    }
  }
  return { prior, theta, var: variance };
}

function logPdf(m: GaussModel, cls: 0 | 1, feature: 0 | 1, v: number): number {
  const s2 = m.var[cls][feature];
  return -0.5 * Math.log(2 * Math.PI * s2) - (v - m.theta[cls][feature]) ** 2 / (2 * s2);
}

/** Gaussian density of one feature under one class. */
export function pdf(m: GaussModel, cls: 0 | 1, feature: 0 | 1, v: number): number {
  return Math.exp(logPdf(m, cls, feature, v));
}

/** Posterior [P(Kaldı), P(Ayrıldı)] in log space with log-sum-exp. */
export function proba(m: GaussModel, x: Row): [number, number] {
  const lp = ([0, 1] as const).map(
    (k) => Math.log(m.prior[k]) + logPdf(m, k, 0, x[0]) + logPdf(m, k, 1, x[1]),
  );
  const mx = Math.max(lp[0], lp[1]);
  const z = mx + Math.log(Math.exp(lp[0] - mx) + Math.exp(lp[1] - mx));
  return [Math.exp(lp[0] - z), Math.exp(lp[1] - z)];
}
