import { covariance2, type Cov2 } from '../../core/stats';
import { PAIR, type Pt } from './data';

export type Birim = 1 | 1000;

/** Eigen-decomposition of a 2x2 covariance: l1 >= l2, v1 angle in [0, 180) degrees, v2 = (v1.y, -v1.x). */
export interface Eig2 {
  l1: number;
  l2: number;
  v1: Pt;
  v2: Pt;
}

export interface PairFit {
  cov: Cov2;
  eig: Eig2;
  pc1Deg: number;
  evr: [number, number];
}

const RAD = Math.PI / 180;

/** Sample covariance (n - 1), as PCA.explained_variance_. */
export function covOf(points: readonly Pt[]): Cov2 {
  return covariance2(
    points.map((p) => p[0]),
    points.map((p) => p[1]),
    1,
  );
}

/** Degrees modulo 180, in [0, 180). */
export function normDeg(deg: number): number {
  const d = ((deg % 180) + 180) % 180;
  return d >= 180 ? 0 : d;
}

/** Direction of an axis in degrees, [0, 180). */
export function angleOf(v: Pt): number {
  return normDeg(Math.atan2(v[1], v[0]) / RAD);
}

export function eig2(c: Cov2): Eig2 {
  const r = Math.hypot((c.xx - c.yy) / 2, c.xy);
  const mid = (c.xx + c.yy) / 2;
  const l1 = mid + r;
  const l2 = mid - r;
  let v1: Pt;
  if (c.xy === 0) {
    v1 = c.xx >= c.yy ? [1, 0] : [0, 1];
  } else {
    const deg = normDeg((0.5 * Math.atan2(2 * c.xy, c.xx - c.yy)) / RAD);
    v1 = [Math.cos(deg * RAD), Math.sin(deg * RAD)];
  }
  return { l1, l2, v1, v2: [v1[1], -v1[0]] };
}

/** Variance of the data projected on u = (cos t, sin t): u' C u. */
export function projVar(c: Cov2, deg: number): number {
  const ux = Math.cos(deg * RAD);
  const uy = Math.sin(deg * RAD);
  return ux * ux * c.xx + 2 * ux * uy * c.xy + uy * uy * c.yy;
}

/** Multiplies the y coordinate by the unit factor. */
export function withBirim(points: readonly Pt[], birim: Birim): Pt[] {
  return points.map((p): Pt => [p[0], p[1] * birim]);
}

export function meanOf(points: readonly Pt[]): Pt {
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / points.length, sy / points.length];
}

/** Scalar projection t = (p - mean) . u of every point on direction deg. */
export function projections(points: readonly Pt[], deg: number): Float64Array {
  const m = meanOf(points);
  const ux = Math.cos(deg * RAD);
  const uy = Math.sin(deg * RAD);
  const out = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    out[i] = (points[i][0] - m[0]) * ux + (points[i][1] - m[1]) * uy;
  }
  return out;
}

/** Foot of the perpendicular from each point onto the line through the mean along u. */
export function footOn(points: readonly Pt[], deg: number): Pt[] {
  const m = meanOf(points);
  const ux = Math.cos(deg * RAD);
  const uy = Math.sin(deg * RAD);
  return Array.from(projections(points, deg), (t): Pt => [m[0] + t * ux, m[1] + t * uy]);
}

/** Projected variance for theta = 0..180 (181 values). */
export function varianceCurve(c: Cov2): number[] {
  return Array.from({ length: 181 }, (_, d) => projVar(c, d));
}

/** Smallest k with cum[k - 1] > t (sklearn searchsorted side="right" + 1). */
export function componentsFor(cum: readonly number[], t: number): number {
  for (let k = 1; k <= cum.length; k++) if (cum[k - 1] > t) return k;
  return cum.length;
}

const fits = new Map<Birim, PairFit>();

export function pairFit(birim: Birim): PairFit {
  let f = fits.get(birim);
  if (!f) {
    const cov = covOf(withBirim(PAIR, birim));
    const eig = eig2(cov);
    const total = eig.l1 + eig.l2;
    f = { cov, eig, pc1Deg: angleOf(eig.v1), evr: [eig.l1 / total, eig.l2 / total] };
    fits.set(birim, f);
  }
  return f;
}
