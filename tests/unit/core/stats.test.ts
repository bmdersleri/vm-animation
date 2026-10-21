import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/onisleme_sklearn.json';
import { clip, mean, median, quantile, quantileStep, std0, zscores } from '../../../src/core/stats';

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
