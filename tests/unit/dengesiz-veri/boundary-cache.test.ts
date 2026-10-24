import { afterEach, describe, expect, it, vi } from 'vitest';
import { averagePrecision, classify } from '../../../src/concepts/degerlendirme/curves';
import { fitLogReg, type LogRegModel } from '../../../src/concepts/dengesiz/logreg';
import { toScaled } from '../../../src/concepts/dengesiz/smote';
import { modelFor, resultFor, testScores, weightsFor, type FitParams, type Method } from '../../../src/concepts/dengesiz-veri/boundary';
import { smoteFor, TRAIN } from '../../../src/concepts/dengesiz-veri/model';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';

const METHOD_IDS: Method[] = ['yok', 'smote', 'agirlik'];
const BASE: FitParams = { k: sc.defaults.k, seed: sc.defaults.seed, ratio: sc.defaults.ratio, weight: sc.defaults.weight, manualWeight: sc.defaults.manualWeight };
const VARIANTS: Partial<FitParams>[] = [{}, { ratio: 0.3 }, { k: 1 }, { seed: 43 }, { weight: 'elle', manualWeight: 30 }, { weight: 'dengeli' }, { weight: 'yok' }];

/** A fit from scratch, outside every cache: the same inputs the page's model reads. */
function freshModel(method: Method, p: FitParams): LogRegModel {
  const X = TRAIN.map(toScaled);
  const y = TRAIN.map((c) => c.churn);
  let fit;
  if (method === 'smote') {
    const s = smoteFor(p.k, p.seed, p.ratio);
    fit = fitLogReg(
      X.concat(s.map((q) => ({ x: q.x, y: q.y }))),
      y.concat(s.map(() => 1 as const)),
      null,
      1,
    );
  } else if (method === 'agirlik') {
    const w = weightsFor(p);
    fit = fitLogReg(
      X,
      y,
      y.map((v) => (v === 1 ? w.pos : w.neg)),
      1,
    );
  } else {
    fit = fitLogReg(X, y, null, 1);
  }
  return { coef: fit.coef, intercept: fit.intercept };
}

/** `resultFor` (fit cache plus score cache) against a fresh fit, at two thresholds. */
function expectFresh(method: Method, p: FitParams): void {
  const fresh = testScores(freshModel(method, p));
  const want = averagePrecision(fresh);
  for (const t of [0.5, 0.2]) {
    const got = resultFor(method, p, t);
    const label = `${method} ${JSON.stringify(p)} t=${t}`;
    if (want === null) {
      expect(got.ap, label).toBeNull();
    } else {
      expect(got.ap, label).toBeCloseTo(want, 12);
    }
    expect(got.matrix, label).toEqual(classify(fresh, t));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dengesiz-veri boundary caches', () => {
  it('the cached PR-AUC and matrix equal a fresh fit for every method and parameter set, repeats included', () => {
    const warn = vi.spyOn(console, 'warn');
    for (let pass = 0; pass < 2; pass++) {
      for (const method of METHOD_IDS) {
        for (const v of VARIANTS) {
          expectFresh(method, { ...BASE, ...v });
        }
      }
    }
    // every fit of these settings converges: no console warning
    expect(warn).not.toHaveBeenCalled();
  });

  it('a 60-stop ratio sweep clears the fit cache and the results stay fresh', () => {
    const ratios = Array.from({ length: 60 }, (_, i) => 0.1 + (0.9 * i) / 59);
    for (const ratio of ratios) {
      const p = { ...BASE, ratio };
      const a = modelFor('smote', p);
      expect(resultFor('smote', p, 0.5).ap).toBeCloseTo(averagePrecision(testScores(a))!, 12);
    }
    // after the clear (24 entries), earlier settings are refitted and still match a fresh fit
    for (const method of METHOD_IDS) {
      for (const v of VARIANTS.slice(0, 3)) {
        expectFresh(method, { ...BASE, ...v });
      }
    }
    expectFresh('smote', { ...BASE, ratio: ratios[0] });
  });
});
