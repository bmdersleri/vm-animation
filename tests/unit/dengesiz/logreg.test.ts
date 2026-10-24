import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/dengesiz_sklearn.json';
import { averagePrecision, classify } from '../../../src/concepts/degerlendirme/curves';
import { metrics } from '../../../src/concepts/degerlendirme/metrics';
import { BOOK01, CUSTOMERS, MODELS2D } from '../../../src/concepts/dengesiz/data';
import {
  balancedWeights, boundaryAt, fitLogReg, predictProba, type LogRegModel,
} from '../../../src/concepts/dengesiz/logreg';
import { smote, syntheticCount, toScaled, type Pt } from '../../../src/concepts/dengesiz/smote';

const train = CUSTOMERS.filter(c => c.split === 'train');
const test = CUSTOMERS.filter(c => c.split === 'test');
const trainPts = train.map(toScaled);
const trainY = train.map(c => c.churn);

function smoteTrainSet(k: number, ratio: number, seed: number): { X: Pt[]; y: (0 | 1)[] } {
  const minority = trainPts.filter((_, i) => trainY[i] === 1);
  const nNew = syntheticCount(trainY.length - minority.length, minority.length, ratio);
  const added = smote(minority, k, nNew, seed);
  return {
    X: [...trainPts, ...added.map(s => ({ x: s.x, y: s.y }))],
    y: [...trainY, ...added.map(() => 1 as const)],
  };
}

function weightsOf(y: readonly (0 | 1)[], pos: number, neg: number): number[] {
  return y.map(v => (v === 1 ? pos : neg));
}

/** Fits the four fixture models exactly as the generator does. */
function fitAll(): Record<'base' | 'smote' | 'weighted' | 'weight20', LogRegModel> {
  const sm = smoteTrainSet(5, 1, 42);
  const bw = balancedWeights(trainY);
  return {
    base: fitLogReg(trainPts, trainY, null, 1),
    smote: fitLogReg(sm.X, sm.y, null, 1),
    weighted: fitLogReg(trainPts, trainY, weightsOf(trainY, bw.pos, bw.neg), 1),
    weight20: fitLogReg(trainPts, trainY, weightsOf(trainY, 20, 1), 1),
  };
}

const testSamples = (model: LogRegModel) => test.map((c, i) => ({
  id: String(i),
  actual: c.churn,
  score: predictProba(model, toScaled(c)),
}));

describe('logreg', () => {
  it('newton matches sklearn for base smote balanced and manual weights', () => {
    const fitted = fitAll();
    for (const name of ['base', 'smote', 'weighted', 'weight20'] as const) {
      const want = fixture.logreg[name];
      const got = fitted[name];
      expect(Math.abs(got.coef[0] - want.coef[0])).toBeLessThan(1e-6);
      expect(Math.abs(got.coef[1] - want.coef[1])).toBeLessThan(1e-6);
      expect(Math.abs(got.intercept - want.intercept)).toBeLessThan(1e-6);
    }
  });

  it('newton converges for every lab corner', () => {
    for (const k of [1, 10]) {
      for (const ratio of [0.1, 1]) {
        for (const weight of [1, 30]) {
          const sm = smoteTrainSet(k, ratio, 42);
          const fit = fitLogReg(sm.X, sm.y, weightsOf(sm.y, weight, 1), 1);
          expect(fit.converged).toBe(true);
          expect(fit.iterations).toBeLessThan(50);
        }
      }
    }
  });

  it('boundary line gives probability one half', () => {
    const model = fitAll().smote;
    for (const threshold of [0.5, 0.2]) {
      const { a, b, c } = boundaryAt(model, threshold);
      for (const x of [-1, 0.3, 2]) {
        const y = (c - a * x) / b;
        expect(predictProba(model, { x, y })).toBeCloseTo(threshold, 12);
      }
    }
  });

  it('balanced weights are 8.05 and 0.53', () => {
    const w = balancedWeights(trainY);
    expect(w.pos).toBeCloseTo(1400 / (2 * 87), 12);
    expect(w.neg).toBeCloseTo(1400 / (2 * 1313), 12);
    expect(w.pos.toFixed(2)).toBe('8.05');
    expect(w.neg.toFixed(2)).toBe('0.53');
  });

  it('metrics of the all-negative matrix leave precision undefined', () => {
    const m = metrics(BOOK01.matrix);
    expect(m.precision).toBeNull();
    expect(BOOK01.precision).toBeNull();
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
    expect(m.accuracy).toBeCloseTo(BOOK01.accuracy, 3);
    expect(BOOK01.recall).toBe(0);
    expect(BOOK01.f1).toBe(0);
  });

  it('two feature models reproduce the generator matrices and ap', () => {
    const fitted = fitAll();
    for (const name of ['base', 'smote', 'weighted'] as const) {
      const samples = testSamples(fitted[name]);
      expect(classify(samples, 0.5)).toEqual(MODELS2D[name].matrix);
      expect(classify(samples, 0.5)).toEqual(fixture.logreg[name].matrix);
      expect(Math.abs(averagePrecision(samples)! - fixture.logreg[name].ap)).toBeLessThan(1e-4);
      expect(Math.abs(MODELS2D[name].ap - fixture.logreg[name].ap)).toBeLessThan(5e-5);
    }
  });
});
