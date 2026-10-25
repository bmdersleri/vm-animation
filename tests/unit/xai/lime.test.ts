import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/xai_shap_lime.json';
import { KERNEL_WIDTH, LIME_RUNS, limeRun } from '../../../src/concepts/xai/data';
import { kernelWeight, limeFit, patternDistance } from '../../../src/concepts/xai/lime';
import type { Pattern } from '../../../src/concepts/xai/data';

describe('xai lime', () => {
  it('limeFit matches sklearn ridge for every preset run', () => {
    expect(fixture.ridge).toHaveLength(LIME_RUNS.length * 3);
    for (const fx of fixture.ridge) {
      const run = limeRun(fx.row, fx.seed, fx.samples);
      const fit = limeFit(run.patterns, fx.width);
      const tag = `${fx.row}/${fx.seed}/${fx.samples}/${fx.width}`;
      fit.coef.forEach((c, j) => {
        expect(Math.abs(c - fx.coef[j]), `${tag} coef ${j}`).toBeLessThan(1e-9);
      });
      expect(Math.abs(fit.intercept - fx.intercept), `${tag} intercept`).toBeLessThan(1e-9);
      expect(Math.abs(fit.localPred - fx.localPred), `${tag} localPred`).toBeLessThan(1e-9);
      expect(Math.abs((fit.score as number) - fx.score), `${tag} score`).toBeLessThan(1e-9);
    }
  });

  it('kernel weights read 1, 0.744, 0.553, 0.411', () => {
    const w = KERNEL_WIDTH;
    expect(Math.round(kernelWeight(patternDistance(7), w) * 1000) / 1000).toBe(1);
    expect(Math.round(kernelWeight(patternDistance(3), w) * 1000) / 1000).toBe(0.744);
    expect(Math.round(kernelWeight(patternDistance(1), w) * 1000) / 1000).toBe(0.553);
    expect(Math.round(kernelWeight(patternDistance(0), w) * 1000) / 1000).toBe(0.411);
  });

  it('limeFit solves with empty patterns', () => {
    const patterns: Pattern[] = [
      { mask: 0, n: 0, mean: 0, ss: 0 },
      { mask: 1, n: 3, mean: 0.2, ss: 0.01 },
      { mask: 2, n: 0, mean: 0, ss: 0 },
      { mask: 3, n: 2, mean: 0.4, ss: 0.02 },
      { mask: 4, n: 0, mean: 0, ss: 0 },
      { mask: 5, n: 4, mean: 0.3, ss: 0.05 },
      { mask: 6, n: 0, mean: 0, ss: 0 },
      { mask: 7, n: 1, mean: 0.9, ss: 0 },
    ];
    const fit = limeFit(patterns, 1.3);
    for (const v of [...fit.coef, fit.intercept, fit.localPred]) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(fit.score as number)).toBe(true);
  });

  it('limeFit stays finite at the narrowest width', () => {
    for (const run of LIME_RUNS.filter(r => r.samples === 50)) {
      const fit = limeFit(run.patterns, 0.3);
      for (const v of [...fit.coef, fit.intercept, fit.localPred]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
