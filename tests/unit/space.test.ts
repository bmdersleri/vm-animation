import { describe, it, expect } from 'vitest';
import { featureSpace } from '../../src/concepts/knn/space';
import type { DatasetId } from '../../src/concepts/knn/data';

const combos: [DatasetId, boolean][] = [['aylik', false], ['aylik', true], ['toplam', false], ['toplam', true]];

describe('featureSpace', () => {
  it.each(combos)('toRaw(toSpace(r)) round-trips (%s, scaled=%s)', (d, scaled) => {
    const s = featureSpace(d, scaled);
    for (const r of [{ tenure: 3, value: 70.5 }, { tenure: 60, value: 1234 }, { tenure: 0, value: 0 }]) {
      const back = s.toRaw(s.toSpace(r));
      expect(Math.abs(back.tenure - r.tenure)).toBeLessThan(1e-9);
      expect(Math.abs(back.value - r.value)).toBeLessThan(1e-9);
    }
  });

  it.each(['aylik', 'toplam'] as DatasetId[])('scaled points have mean 0 and std 1 (%s)', (d) => {
    const s = featureSpace(d, true);
    const n = s.points.length;
    for (const key of ['x', 'y'] as const) {
      const mean = s.points.reduce((a, p) => a + p[key], 0) / n;
      const sd = Math.sqrt(s.points.reduce((a, p) => a + (p[key] - mean) ** 2, 0) / n);
      expect(Math.abs(mean)).toBeLessThan(1e-9);
      expect(Math.abs(sd - 1)).toBeLessThan(1e-9);
    }
  });

  it('is memoised per (dataset, scaled)', () => {
    expect(featureSpace('aylik', true)).toBe(featureSpace('aylik', true));
    expect(featureSpace('aylik', true)).not.toBe(featureSpace('aylik', false));
  });

  it('domain is the point extent padded 8% each side', () => {
    const s = featureSpace('aylik', false);
    const xs = s.points.map((p) => p.x);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    expect(s.domain.x[0]).toBeCloseTo(lo - 0.08 * (hi - lo), 9);
    expect(s.domain.x[1]).toBeCloseTo(hi + 0.08 * (hi - lo), 9);
  });
});
