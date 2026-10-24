import { describe, expect, it, vi } from 'vitest';
import type * as LogReg from '../../../src/concepts/dengesiz/logreg';

// every fit in this file reports "not converged", the spec's error case the real data never reaches
vi.mock('../../../src/concepts/dengesiz/logreg', async (importOriginal) => {
  const real = await importOriginal<typeof LogReg>();
  return {
    ...real,
    fitLogReg: (...args: Parameters<typeof real.fitLogReg>) => ({ ...real.fitLogReg(...args), converged: false, iterations: 50 }),
  };
});

const { modelFor, resultFor } = await import('../../../src/concepts/dengesiz-veri/boundary');
const { dengesizVeriScenario: sc } = await import('../../../src/concepts/dengesiz-veri/scenario');

describe('dengesiz-veri boundary: Newton does not converge', () => {
  it('warns once per fit in the console and keeps the last coefficients', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = { ...sc.defaults, weight: 'dengeli' as const };
    const model = modelFor('agirlik', p);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Newton did not converge in 50 steps \(agirlik\|/);
    expect(model.coef.every(Number.isFinite)).toBe(true);
    // the cached model is reused: no second warning, and the page still gets finite numbers
    const r = resultFor('agirlik', p, 0.5);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(r.ap === null || Number.isFinite(r.ap)).toBe(true);
    warn.mockRestore();
  });
});
