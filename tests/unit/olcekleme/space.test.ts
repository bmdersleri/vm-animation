import { describe, it, expect } from 'vitest';
import { CUSTOMERS, QUERY, SPLIT } from '../../../src/concepts/olcekleme/data';
import { fitMinMax, fitRobust, fitStandard, transform } from '../../../src/concepts/olcekleme/scalers';
import { churnRate, distances, fitSplit, nearest, zPoint, type Unit } from '../../../src/concepts/olcekleme/space';
import fixture from '../../fixtures/onisleme_sklearn.json';

const TOL = 9;
const close = (a: readonly number[], b: readonly number[]) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], TOL));
};
const units: Unit[] = ['ay', 'yil', 'gun'];
const scale = fixture.scale;

describe('olcekleme space', () => {
  it('distances in four units match', () => {
    for (const u of units) close(distances(QUERY, u), scale.dist[u]);
    close(distances(QUERY, 'z'), scale.dist.z);
  });

  it('nearest per unit: M3, M2, M5, M3', () => {
    const got = [...units, 'z' as const].map((s) => nearest(distances(QUERY, s)));
    expect(got).toEqual([2, 1, 4, 2]);
  });

  it('drag cases match', () => {
    for (const dc of scale.dragCases) {
      const q = { t: dc.query[0], f: dc.query[1] };
      for (const s of [...units, 'z' as const]) {
        close(distances(q, s), dc.dist[s]);
        expect(nearest(distances(q, s))).toBe(dc.nearest[s]);
      }
    }
  });

  it('z does not depend on the unit', () => {
    CUSTOMERS.forEach((c, i) => {
      close(zPoint(c), scale.z[i]);
      for (const u of units) close(zPoint(c), scale.zByUnit[u][i]);
    });
    close(zPoint(QUERY), scale.queryZ);
  });

  it('three scalers on the bill column', () => {
    const fs = CUSTOMERS.map((c) => c.f);
    const mm = fitMinMax(fs);
    const rb = fitRobust(fs);
    close(fs.map((x) => transform(fitStandard(fs), x)), scale.fatura.StandardScaler);
    close(fs.map((x) => transform(mm, x)), scale.fatura.MinMaxScaler);
    close(fs.map((x) => transform(rb, x)), scale.fatura.RobustScaler);
    expect(rb.center).toBeCloseTo(scale.fatura.robust.center, TOL);
    expect(rb.scale).toBeCloseTo(scale.fatura.robust.scale, TOL);
    expect(mm.center).toBeCloseTo(scale.fatura.minmax.min, TOL);
    expect(mm.center + mm.scale).toBeCloseTo(scale.fatura.minmax.max, TOL);
  });

  it('zero scale falls back to 1', () => {
    expect(fitStandard([3, 3]).scale).toBe(1);
    expect(transform(fitMinMax([5, 5]), 7)).toBe(2);
  });

  it('split fits', () => {
    for (const [scope, ref] of [['egitim', fixture.split.fitTrain], ['tum', fixture.split.fitAll]] as const) {
      const r = fitSplit(scope);
      expect(r.mu).toBeCloseTo(ref.mu, TOL);
      expect(r.sigma).toBeCloseTo(ref.sigma, TOL);
      close(r.testZ, ref.testZ);
    }
    close(fitSplit('egitim').trainZ, fixture.split.fitTrain.trainZ);
    expect(fitSplit('egitim').testZ[2]).toBeCloseTo(-1.04, 2);
    expect(churnRate(SPLIT.train)).toBeCloseTo(0.2857, 4);
    expect(churnRate(SPLIT.test)).toBeCloseTo(0.3333, 4);
  });

  it('nearest takes the first of equal distances', () => {
    expect(nearest([3, 1, 1])).toBe(1);
  });
});
