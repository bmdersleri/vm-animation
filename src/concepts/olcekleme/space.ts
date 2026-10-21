import { CUSTOMERS, SPLIT } from './data';
import { fitStandard, transform, type Fitted } from './scalers';

export type Unit = 'ay' | 'yil' | 'gun';
export const UNIT_FACTOR: Record<Unit, number> = { ay: 1, yil: 1 / 12, gun: 30 };
export const UNIT_NAME: Record<Unit, string> = { ay: 'ay', yil: 'yıl', gun: 'gün' };

export type Pt2 = [number, number];

export function rawPoint(c: { t: number; f: number }, u: Unit): Pt2 {
  return [c.t * UNIT_FACTOR[u], c.f];
}

/** Fitted on the six customers; independent of the tenure unit. */
export interface ZFit { t: Fitted; f: Fitted }
export const Z_FIT: ZFit = {
  t: fitStandard(CUSTOMERS.map((c) => c.t)),
  f: fitStandard(CUSTOMERS.map((c) => c.f)),
};

export function zPoint(c: { t: number; f: number }, z: ZFit = Z_FIT): Pt2 {
  return [transform(z.t, c.t), transform(z.f, c.f)];
}

/** Euclidean distances from q to each customer (CUSTOMERS order). */
export function distances(q: { t: number; f: number }, space: Unit | 'z'): number[] {
  const pt = (c: { t: number; f: number }): Pt2 => (space === 'z' ? zPoint(c) : rawPoint(c, space));
  const [qx, qy] = pt(q);
  return CUSTOMERS.map((c) => {
    const [x, y] = pt(c);
    return Math.hypot(x - qx, y - qy);
  });
}

/** Index of the smallest distance; the first one wins ties. */
export function nearest(ds: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < ds.length; i++) if (ds[i] < ds[best]) best = i;
  return best;
}

export interface SplitFit { mu: number; sigma: number; testZ: number[]; trainZ: number[] }

export function fitSplit(scope: 'egitim' | 'tum'): SplitFit {
  const basis = scope === 'egitim' ? SPLIT.train.map((i) => SPLIT.values[i]) : SPLIT.values;
  const f = fitStandard(basis);
  return {
    mu: f.center,
    sigma: f.scale,
    testZ: SPLIT.test.map((i) => transform(f, SPLIT.values[i])),
    trainZ: SPLIT.train.map((i) => transform(f, SPLIT.values[i])),
  };
}

export function churnRate(idx: readonly number[]): number {
  return idx.reduce((s, i) => s + SPLIT.churn[i], 0) / idx.length;
}
