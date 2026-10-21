import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/onisleme_sklearn.json';
import { clip, covariance2, histCounts, mean, median, pearson, quantile, quantileStep, skewness, std0, variance, zscores } from '../../../src/core/stats';
import boyut from '../../fixtures/boyut_sklearn.json';
import { PAIR } from '../../../src/concepts/pca/data';
import { VALUES } from '../../../src/concepts/ozellik-secimi/data';

const iqr = fixture.iqr;
const raw = [...iqr.sorted].reverse(); // unsorted input on purpose
const del = [29.85, 38.5, 42.3, 45, 51.1, 56.95, 60.2];

describe('quantile', () => {
  it('matches pandas', () => {
    expect(quantile(raw, 0.25)).toBeCloseTo(iqr.q1, 9);
    expect(quantile(raw, 0.75)).toBeCloseTo(iqr.q3, 9);
    expect(quantile(del, 0.25)).toBeCloseTo(iqr.deleted.q1, 9);
    expect(quantile(del, 0.75)).toBeCloseTo(iqr.deleted.q3, 9);
    for (const s of fixture.extremeSweep) {
      expect(quantile(s.iqr.sorted, 0.25)).toBeCloseTo(s.iqr.q1, 9);
      expect(quantile(s.iqr.sorted, 0.75)).toBeCloseTo(s.iqr.q3, 9);
    }
  });
  it("quantileStep shows the book's positions", () => {
    const a = quantileStep(raw, 0.25);
    expect(a).toMatchObject({ n: 8, pos: 1.75, lo: 1, frac: 0.75, a: 38.5, b: 42.3 });
    expect(a.value).toBeCloseTo(iqr.q1, 9);
    const b = quantileStep(raw, 0.75);
    expect(b).toMatchObject({ pos: 5.25, lo: 5, a: 56.95, b: 60.2 });
    expect(b.frac).toBeCloseTo(0.25, 12);
    expect(quantileStep(del, 0.25).pos).toBe(1.5);
  });
});

describe('summary stats', () => {
  it('mean, median, std0 and zscores match', () => {
    expect(mean(raw)).toBeCloseTo(iqr.mean, 9);
    expect(median(raw)).toBeCloseTo(iqr.median, 9);
    expect(std0(raw)).toBeCloseTo(iqr.std0, 9);
    // iqr.z is in the book's row order, not sorted order
    const z = zscores([29.85, 56.95, 42.3, 38.5, 45, 60.2, 51.1, 480]);
    z.forEach((v, i) => expect(v).toBeCloseTo(iqr.z[i], 9));
    expect(Math.max(...z)).toBeLessThanOrEqual(iqr.zBound + 1e-9);
  });
  it('fill mean and median', () => {
    const known = [29.85, 56.95, 42.3, 38.5, 200, 45];
    expect(mean(known)).toBeCloseTo(fixture.fill.mean, 9);
    expect(median(known)).toBeCloseTo(fixture.fill.median, 9);
  });
  it('clip', () => {
    const c = clip(iqr.sorted, iqr.fences.k15[0], iqr.fences.k15[1]);
    expect(mean(c)).toBeCloseTo(iqr.meanClipped, 9);
  });
  it('inputs are not mutated', () => {
    const x = [3, 1, 2];
    quantile(x, 0.5); median(x); quantileStep(x, 0.5); zscores(x); clip(x, 1, 2);
    expect(x).toEqual([3, 1, 2]);
  });
});

const rel = (a: number, b: number) => (b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b));

describe('variance / covariance / pearson', () => {
  it('variance ddof 0 matches VarianceThreshold', () => {
    VALUES.forEach((col, c) => {
      const want = boyut.secim.variance[c];
      if (want === 0) expect(variance(col)).toBe(0);
      else expect(rel(variance(col), want)).toBeLessThan(1e-9);
    });
  });
  it('variance ddof 1', () => expect(variance([1, 2, 3, 4], 1)).toBe(5 / 3));
  it('covariance2 and pearson match numpy on the PCA pair', () => {
    const xs = PAIR.map((p) => p[0]);
    const ys = PAIR.map((p) => p[1]);
    const c = covariance2(xs, ys);
    const cov = boyut.pca.pair.cov;
    expect(rel(c.xx, cov[0][0])).toBeLessThan(1e-9);
    expect(rel(c.xy, cov[0][1])).toBeLessThan(1e-9);
    expect(rel(c.yy, cov[1][1])).toBeLessThan(1e-9);
    expect(rel(pearson(xs, ys), boyut.pca.pair.r)).toBeLessThan(1e-9);
  });
});

describe('skewness', () => {
  const cases: [string, number[], number][] = [
    ['002', [8, 10, 12, 12, 14, 15, 18, 20, 25, 30], 0.9010585],
    ['003', [5, 6, 7, 8, 8, 9, 10, 11, 12, 28], 2.5395077],
    ['simetrik', [10, 12, 14, 15, 16, 16, 17, 18, 20, 22], 0],
    ['sol', [4, 8, 10, 12, 13, 14, 14, 15, 16, 17], -1.0607687],
  ];
  it.each(cases)('%s serisi pandas G1 verir', (_n, xs, want) => {
    expect(skewness(xs)).toBeCloseTo(want, 6);
  });
  it('n < 3 ve sabit seride NaN', () => {
    expect(skewness([1, 2])).toBeNaN();
    expect(skewness([5, 5, 5, 5])).toBeNaN();
  });
});

describe('histCounts', () => {
  it('002 serisi 3 / 5 / 10 kova', () => {
    const xs = [8, 10, 12, 12, 14, 15, 18, 20, 25, 30];
    expect(histCounts(xs, 3).counts).toEqual([6, 2, 2]);
    expect(histCounts(xs, 5).counts).toEqual([4, 2, 2, 1, 1]);
    expect(histCounts(xs, 10).counts).toEqual([2, 2, 1, 1, 1, 1, 0, 1, 0, 1]);
    expect(histCounts(xs, 5).edges).toEqual([8, 12.4, 16.8, 21.2, 25.6, 30]);
  });
  it('son kova sağdan kapalı', () => {
    expect(histCounts([0, 1, 2, 3], 3).counts).toEqual([1, 1, 2]);
  });
});
