import { describe, it, expect } from 'vitest';
import { FILL, IQR } from '../../../src/concepts/iqr-aykiri/data';
import { impute, intervene, tukey, withExtreme, zOf } from '../../../src/concepts/iqr-aykiri/outlier';
import { mean } from '../../../src/core/stats';
import fixture from '../../fixtures/onisleme_sklearn.json';

const T = 1e-9;
const near = (a: number | null, b: number) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThan(T);
};
const nearAll = (a: readonly (number | null)[], b: readonly number[]) => {
  expect(a).toHaveLength(b.length);
  b.forEach((v, i) => near(a[i], v));
};

describe('impute', () => {
  it('matches SimpleImputer', () => {
    const m = impute(FILL.values, 'ortalama');
    nearAll(m.values, fixture.fill.imputed.mean);
    near(m.fillValue, fixture.fill.mean);
    expect(Math.abs((m.fillValue as number) - 68.7667)).toBeLessThan(1e-4);
    const d = impute(FILL.values, 'medyan');
    nearAll(d.values, fixture.fill.imputed.median);
    near(d.fillValue, 43.65);
    const n = impute(FILL.values, 'yok');
    expect(n.values).toEqual(FILL.values);
    expect(n.fillValue).toBeNull();
  });
});

describe('tukey', () => {
  it('on 003', () => {
    const f = fixture.iqr;
    const t = tukey(IQR.values, 1.5);
    near(t.q1.value, f.q1);
    near(t.q3.value, f.q3);
    near(t.iqr, f.iqr);
    near(t.lo, f.fences.k15[0]);
    near(t.hi, f.fences.k15[1]);
    expect(t.outliers).toEqual([7]);
    expect(t.whiskers).toEqual([29.85, 60.2]);
    const t3 = tukey(IQR.values, 3);
    near(t3.lo, f.fences.k30[0]);
    near(t3.hi, f.fences.k30[1]);
    expect(t3.outliers).toEqual([7]);
  });

  it('extreme sweep matches pandas', () => {
    for (const s of fixture.extremeSweep) {
      const t = tukey(withExtreme(IQR.values, IQR.extremeIndex, s.x), 1.5);
      near(t.q1.value, s.iqr.q1);
      near(t.q3.value, s.iqr.q3);
      near(t.lo, s.iqr.lo);
      near(t.hi, s.iqr.hi);
      expect(t.outliers).toEqual(s.iqr.outliers);
      const imp = impute(withExtreme(FILL.values, FILL.extremeIndex, s.x), 'ortalama');
      nearAll(imp.values, s.fill.imputedMean);
      near(zOf(withExtreme(IQR.values, IQR.extremeIndex, s.x), s.x), s.iqr.zExtreme);
    }
  });

  it('extreme 50 sorts into the crowd', () => {
    const t = tukey(withExtreme(IQR.values, 7, 50), 1.5);
    expect(t.sorted).toEqual([29.85, 38.5, 42.3, 45, 50, 51.1, 56.95, 60.2]);
    expect(t.outliers).toEqual([]);
  });
});

describe('intervene', () => {
  it('delete recomputes with n = 7', () => {
    const r = intervene(IQR.values, 1.5, 'sil');
    expect(r.values[7]).toBeNull();
    expect(r.kept).toHaveLength(7);
    expect(r.changed).toEqual([7]);
    const d = fixture.iqr.deleted;
    const t = tukey(r.kept, 1.5);
    near(t.q1.value, d.q1);
    near(t.q3.value, d.q3);
    near(t.lo, d.lo);
    near(t.hi, d.hi);
    near(mean(r.kept), fixture.iqr.meanDeleted);
  });

  it('clip keeps n = 8', () => {
    const r = intervene(IQR.values, 1.5, 'kirp');
    expect(r.kept).toHaveLength(8);
    near(r.values[7], fixture.iqr.fences.k15[1]);
    near(r.values[7], 82.38125);
    near(mean(r.kept), fixture.iqr.meanClipped);
    const r3 = intervene(IQR.values, 3, 'kirp');
    near(mean(r3.kept), fixture.iqr.clippedK30Mean);
  });

  it('no outlier: intervene changes nothing', () => {
    const v = withExtreme(IQR.values, 7, 80);
    for (const a of ['sil', 'kirp'] as const) {
      const r = intervene(v, 1.5, a);
      expect(r.changed).toEqual([]);
      expect(r.values).toEqual(v);
    }
  });

  it('z never reaches 3 with eight values', () => {
    for (const s of fixture.extremeSweep) {
      expect(zOf(withExtreme(IQR.values, 7, s.x), s.x)).toBeLessThanOrEqual(Math.sqrt(7));
    }
  });
});
