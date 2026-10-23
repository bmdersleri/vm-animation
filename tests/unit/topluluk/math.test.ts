import { describe, it, expect } from 'vitest';
import {
  ensembleVariance, labBootstrap, majorityAccuracy, meanStd, oobChance,
} from '../../../src/concepts/topluluk/math';

describe('topluluk math', () => {
  it('oob chance is 0.349 at 10 and tends to 1/e', () => {
    expect(oobChance(10)).toBeCloseTo(0.3487, 4);
    expect(oobChance(1)).toBe(0);
    expect(oobChance(100000)).toBeCloseTo(Math.exp(-1), 4);
  });

  it('three 0.8 models give 0.896', () => {
    expect(majorityAccuracy(0.8, 3)).toBeCloseTo(0.896, 10);
    expect(majorityAccuracy(0.8, 1)).toBeCloseTo(0.8, 10);
    expect(majorityAccuracy(0.5, 9)).toBeCloseTo(0.5, 10);
    expect(majorityAccuracy(0.8, 51)).toBeGreaterThan(0.99);
  });

  it('ensemble variance keeps rho sigma2 as m grows', () => {
    expect(ensembleVariance(0.3, 2, 1)).toBeCloseTo(2, 10);
    expect(ensembleVariance(0.3, 2, 1e9)).toBeCloseTo(0.6, 6);
    expect(ensembleVariance(0, 2, 4)).toBeCloseTo(0.5, 10);
    expect(ensembleVariance(1, 2, 50)).toBeCloseTo(2, 10);
  });

  it('lab bootstrap is deterministic and draws with replacement', () => {
    const a = labBootstrap(10, 7);
    expect(a).toEqual(labBootstrap(10, 7));
    expect(a).toHaveLength(10);
    for (const v of a) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
    expect(labBootstrap(10, 8)).not.toEqual(a);
    expect(new Set(labBootstrap(200, 1)).size).toBeLessThan(200);
  });

  it('mean and std follow numpy (ddof 0)', () => {
    const r = meanStd([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(r.mean).toBe(5);
    expect(r.std).toBe(2);
  });
});
