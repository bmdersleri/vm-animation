import { describe, expect, it } from 'vitest';
import {
  BINS, BOOK, CLOUD, CUSTOMERS, KERNEL_WIDTH, LIME_ALL, LIME_RUNS, MODEL, PRESETS, SAMPLE_SIZES, SEEDS,
  customerByRow, limeRun,
} from '../../../src/concepts/xai/data';

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

describe('xai data', () => {
  it('book numbers come from data', () => {
    expect(round(customerByRow(301).p, 3)).toBe(0.945);
    expect(round(MODEL.accuracy, 3)).toBe(0.94);
    expect(MODEL.importances.map(v => round(v, 3))).toEqual([0.546, 0.231, 0.223]);
    expect(MODEL.meanAbsShap.map(v => round(v, 6))).toEqual([0.22106, 0.06458, 0.035807]);
    expect(customerByRow(301).shap.map(v => round(v, 6))).toEqual([0.567064, 0.092737, 0.039599]);
    expect(round(MODEL.base, 4)).toBe(0.2456);
    const fit = LIME_ALL.find(a => a.row === 301)!.fit;
    expect(fit.coef.map(v => round(v, 3))).toEqual([0.54, 0.074, -0.023]);
    expect(round(fit.intercept, 3)).toBe(0.146);
    expect(round(fit.localPred, 3)).toBe(0.737);
    expect(round(fit.score as number, 3)).toBe(0.693);
    expect(round(BOOK.fixedCodeP, 2)).toBe(0.96);
    expect(MODEL.topDisagree).toBe(24);
    expect(MODEL.nEstimators).toBe(200);
    expect(round(KERNEL_WIDTH, 3)).toBe(1.299);
  });

  it('split is 300 / 100 stratified', () => {
    expect(MODEL.nTrain).toBe(300);
    expect(MODEL.nTest).toBe(100);
    expect(MODEL.trainCounts).toEqual([226, 74]);
    expect(MODEL.testCounts).toEqual([75, 25]);
    expect(CUSTOMERS).toHaveLength(100);
    expect(LIME_ALL).toHaveLength(100);
    expect(PRESETS).toEqual([301, 77, 217, 176]);
    expect([0, 12, 1, 4].map(i => CUSTOMERS[i].row)).toEqual([301, 77, 217, 176]);
    expect(LIME_RUNS).toHaveLength(PRESETS.length * SEEDS.length * SAMPLE_SIZES.length);
    expect(limeRun(301, 42, 5000).patterns).toHaveLength(8);
    for (const row of PRESETS) {
      expect(CLOUD[row].p).toHaveLength(500);
      expect(CLOUD[row].values[0]).toEqual(customerByRow(row).values);
      expect(CLOUD[row].mask[0]).toBe(7);
    }
  });

  it('bins hold three cuts and four names per feature', () => {
    for (let j = 0; j < 3; j++) {
      expect(BINS.cuts[j]).toHaveLength(3);
      expect(BINS.names[j]).toHaveLength(4);
      expect(BINS.freqs[j]).toHaveLength(4);
      expect(BINS.freqs[j].reduce((a, b) => a + b, 0)).toBe(300);
    }
  });

  it('customer 301 bins are the book rules', () => {
    const run = limeRun(301, 42, 5000);
    expect(run.bins.map((b, j) => BINS.names[j][b])).toEqual([
      'tenure > 41.25',
      '39.87 < MonthlyCharges <= 51.59',
      '2294.79 < TotalCharges <= 2474.31',
    ]);
    expect(run.patterns.reduce((a, p) => a + p.n, 0)).toBe(5000);
    expect(run.patterns[7].n).toBeGreaterThan(0);
  });

  it('top feature differs on customer 77', () => {
    const top = (v: readonly number[]): number => v.reduce((b, x, i) => (Math.abs(x) > Math.abs(v[b]) ? i : b), 0);
    const c = customerByRow(77);
    const fit = LIME_ALL.find(a => a.row === 77)!.fit;
    expect(top(c.shap)).toBe(1);
    expect(top(fit.coef)).toBe(0);
  });
});
