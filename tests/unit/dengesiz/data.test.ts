import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/dengesiz_sklearn.json';
import { averagePrecision } from '../../../src/concepts/degerlendirme/curves';
import {
  BOOK01, COMPARE, CUSTOMERS, CV, KOD05, LEAK, LEAK_EXAMPLE,
} from '../../../src/concepts/dengesiz/data';

const count = (split: 'train' | 'test', churn: 0 | 1): number =>
  CUSTOMERS.filter(c => c.split === split && c.churn === churn).length;

describe('dengesiz data', () => {
  it('book numbers come from the data', () => {
    expect(CUSTOMERS).toHaveLength(2000);
    expect(CUSTOMERS.filter(c => c.churn === 1)).toHaveLength(124);
    expect([count('train', 0), count('train', 1)]).toEqual([1313, 87]);
    expect([count('test', 0), count('test', 1)]).toEqual([563, 37]);
    expect(BOOK01.matrix).toEqual({ tn: 563, fp: 0, fn: 37, tp: 0 });
    expect(COMPARE.weighted.ap.toFixed(3)).toBe('0.173');
    expect(KOD05.matrix.tn + KOD05.matrix.fp + KOD05.matrix.fn + KOD05.matrix.tp).toBe(600);
  });

  it('leaky ap matches average precision of its scores', () => {
    expect(LEAK.seeds).toEqual([42, 0, 1, 2, 3, 4]);
    LEAK.bySeed.forEach((run, t) => {
      const want = fixture.ap[t];
      expect(want.seed).toBe(run.seed);
      expect(Math.abs(averagePrecision(run.leaky.scores)! - want.leaky)).toBeLessThan(1e-9);
      expect(Math.abs(averagePrecision(run.honest.scores)! - want.honest)).toBeLessThan(1e-9);
      expect(Math.abs(run.leaky.ap - want.leaky)).toBeLessThan(5e-5);
      expect(Math.abs(run.honest.ap - want.honest)).toBeLessThan(5e-5);
      expect(run.leaky.scores).toHaveLength(run.leaky.n);
      expect(run.leaky.scores.filter(s => s.actual === 1)).toHaveLength(run.leaky.pos);
      expect(run.honest.scores.filter(s => s.actual === 1)).toHaveLength(37);
    });
    expect(LEAK.bySeed[0].leaky.n).toBe(1126);
    expect(LEAK.bySeed[0].leaky.pos).toBe(529);
    expect(LEAK.bySeed[0].leaky.synthPos).toBe(505);
  });

  it('compare scores reproduce their stored ap', () => {
    for (const name of ['base', 'smote', 'weighted'] as const) {
      const got = averagePrecision(COMPARE[name].scores)!;
      expect(Math.abs(got - COMPARE[name].ap)).toBeLessThan(5e-5);
      expect(COMPARE[name].scores.filter(s => s.actual === 1)).toHaveLength(37);
    }
  });

  it('leak example parents are training churners', () => {
    // "Training" is the leaky split (unstratified, after SMOTE); the generator checks it.
    // Here the parents must be two different churners.
    expect(LEAK_EXAMPLE.parents[0]).not.toBe(LEAK_EXAMPLE.parents[1]);
    for (const p of LEAK_EXAMPLE.parents) {
      expect(CUSTOMERS[p].churn).toBe(1);
    }
    const [tenure, charge] = LEAK_EXAMPLE.point;
    expect(tenure).toBeGreaterThanOrEqual(6);
    expect(tenure).toBeLessThanOrEqual(66);
    expect(charge).toBeGreaterThanOrEqual(30);
    expect(charge).toBeLessThanOrEqual(110);
  });

  it('cv mean is the mean of the folds', () => {
    expect(CV.folds).toHaveLength(5);
    const mean = CV.folds.reduce((s, f) => s + f.ap, 0) / CV.folds.length;
    expect(Math.abs(mean - CV.mean)).toBeLessThan(1e-4);
    for (const f of CV.folds) {
      expect(f.smoteNeg).toBe(f.trainNeg);
      expect(f.smotePos).toBe(f.trainNeg);
      expect(f.trainNeg + f.valNeg).toBe(1876);
      expect(f.trainPos + f.valPos).toBe(124);
    }
  });
});
