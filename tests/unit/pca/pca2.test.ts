import { describe, it, expect } from 'vitest';
import { PAIR, SCREE, type Pt } from '../../../src/concepts/pca/data';
import {
  covOf,
  eig2,
  projVar,
  angleOf,
  normDeg,
  withBirim,
  meanOf,
  projections,
  footOn,
  varianceCurve,
  componentsFor,
  pairFit,
} from '../../../src/concepts/pca/pca2';
import { variance } from '../../../src/core/stats';
import fixture from '../../fixtures/boyut_sklearn.json';

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const axisDot = (v: Pt, w: number[]) => Math.abs(v[0] * w[0] + v[1] * w[1]);
const argMax = (xs: number[]) => xs.indexOf(Math.max(...xs));

describe('pca2', () => {
  const fx = fixture.pca.pair;
  const cov = covOf(PAIR);

  it('pair fit matches sklearn', () => {
    const f = pairFit(1);
    expect(close(f.eig.l1, fx.lambda[0])).toBe(true);
    expect(close(f.eig.l2, fx.lambda[1])).toBe(true);
    expect(close(axisDot(f.eig.v1, fx.components[0]), 1)).toBe(true);
    expect(close(axisDot(f.eig.v2, fx.components[1]), 1)).toBe(true);
    expect(close(f.evr[0], fx.evr[0])).toBe(true);
    expect(close(f.evr[1], fx.evr[1])).toBe(true);
    expect(Math.abs(f.pc1Deg - 45)).toBeLessThan(1e-9);
    expect(f.eig.v2).toEqual([f.eig.v1[1], -f.eig.v1[0]]);
  });

  it('x1000 sticks PC1 to the vertical axis', () => {
    const f = pairFit(1000);
    const x = fx.x1000;
    expect(close(f.eig.l1, x.lambda[0])).toBe(true);
    expect(close(f.eig.l2, x.lambda[1])).toBe(true);
    expect(close(axisDot(f.eig.v1, x.components[0]), 1)).toBe(true);
    expect(close(axisDot(f.eig.v2, x.components[1]), 1)).toBe(true);
    expect(close(f.evr[0], x.evr[0])).toBe(true);
    expect(close(f.evr[1], x.evr[1])).toBe(true);
    expect(f.pc1Deg).toBeGreaterThan(89.9);
    expect(f.pc1Deg).toBeLessThan(90);
    expect(f.evr[0]).toBeLessThan(1);
  });

  it('pairFit is memoised per unit', () => {
    expect(pairFit(1)).toBe(pairFit(1));
    expect(pairFit(1000)).not.toBe(pairFit(1));
  });

  it('projection variance by angle', () => {
    expect(close(projVar(cov, 0), fx.var0)).toBe(true);
    const ints = Array.from({ length: 180 }, (_, i) => projVar(cov, i));
    expect(argMax(ints)).toBe(45);
    expect(close(projVar(cov, 45), fx.lambda[0])).toBe(true);
    expect(close(projVar(cov, 135), fx.lambda[1])).toBe(true);
  });

  it('projVar is periodic with 180 degrees', () => {
    expect(projVar(cov, 30)).toBeCloseTo(projVar(cov, 210), 12);
    expect(normDeg(180)).toBe(0);
    expect(normDeg(-1)).toBe(179);
    expect(normDeg(359)).toBe(179);
    expect(angleOf([-1, -1])).toBeCloseTo(45, 12);
  });

  it('projections have the projected variance', () => {
    const t = projections(PAIR, 30);
    expect(t).toBeInstanceOf(Float64Array);
    expect(t).toHaveLength(PAIR.length);
    expect(variance([...t], 1)).toBeCloseTo(projVar(cov, 30), 10);
  });

  it('feet lie on the line', () => {
    const m = meanOf(PAIR);
    const u = [Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)];
    const feet = footOn(PAIR, 45);
    expect(feet).toHaveLength(PAIR.length);
    for (const f of feet) {
      expect(Math.abs((f[0] - m[0]) * u[1] - (f[1] - m[1]) * u[0])).toBeLessThan(1e-12);
    }
  });

  it('varianceCurve has 181 values peaking at 45 (x1) and 90 (x1000)', () => {
    const a = varianceCurve(pairFit(1).cov);
    const b = varianceCurve(pairFit(1000).cov);
    expect(a).toHaveLength(181);
    expect(b).toHaveLength(181);
    expect(argMax(a)).toBe(45);
    expect(argMax(b)).toBe(90);
  });

  it('withBirim scales only y', () => {
    expect(withBirim([[1, 2]], 1000)).toEqual([[1, 2000]]);
  });

  it('componentsFor matches PCA(n_components=t)', () => {
    const k = fixture.pca.kByThreshold as Record<string, number>;
    for (let t = 50; t <= 99; t++) {
      expect(componentsFor(SCREE.cum, t / 100)).toBe(k[String(t)]);
    }
  });

  it('eig2 of a diagonal matrix', () => {
    const e = eig2({ xx: 1, xy: 0, yy: 4 });
    expect(e.l1).toBe(4);
    expect(e.l2).toBe(1);
    expect(e.v1[0]).toBeCloseTo(0, 12);
    expect(e.v1[1]).toBeCloseTo(1, 12);
    expect(angleOf(e.v1)).toBeCloseTo(90, 12);
  });
});
