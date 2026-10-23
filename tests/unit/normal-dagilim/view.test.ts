import { describe, it, expect } from 'vitest';
import { deriveNormalView } from '../../../src/concepts/normal-dagilim/view';
import { normalScenario } from '../../../src/concepts/normal-dagilim/scenario';
import { SERIES, SINAV_FIXED } from '../../../src/concepts/normal-dagilim/data';
import { mean, std, skewness } from '../../../src/core/stats';

const defaults = normalScenario.defaults;

describe('normal view', () => {
  it('step two fits the sample mean and standard deviation', () => {
    const curve = deriveNormalView(1, defaults).curve!;
    expect(curve.mu).toBeCloseTo(SERIES.sinav.mean, 12);
    expect(curve.sigma).toBeCloseTo(SERIES.sinav.std, 12);
  });

  it('skewed one-sigma sample share differs from the normal rule', () => {
    const band = deriveNormalView(6, { ...defaults, seri: 'cagri' }).bands[0];
    expect(Math.abs(band.sample - band.theory)).toBeGreaterThan(0.05);
  });

  it('scaler strip reports zero mean and unit standard deviation', () => {
    expect(deriveNormalView(7, { ...defaults, seri: 'cagri' }).strip).toMatch(/→ 0 · std .* → 1/);
  });

  it('normalizes histogram density mass', () => {
    for (let i = 0; i < 8; i++) {
      const v = deriveNormalView(i, defaults);
      expect(v.bins.reduce((s, b) => s + b.density * (b.hi - b.lo), 0)).toBeCloseTo(1, 10);
    }
  });

  it('computes interval probability and count with reversible bounds', () => {
    const v = deriveNormalView(3, defaults);
    expect(v.area!.p).toBeCloseTo(SINAV_FIXED.area, 6);
    expect(v.area!.count).toBe(SINAV_FIXED.count);
    expect(deriveNormalView(3, { ...defaults, a: 80, b: 60 }).area).toEqual(v.area);
    expect(deriveNormalView(3, { ...defaults, a: 60, b: 60 }).area!.p).toBe(0);
  });

  it('uses sample sigma for z and population sigma for StandardScaler', () => {
    expect(deriveNormalView(5, defaults).marker!.z).toBeCloseTo(SINAV_FIXED.z, 6);
    const v = deriveNormalView(7, { ...defaults, seri: 'cagri' });
    expect(mean(v.values)).toBeCloseTo(0, 12);
    expect(std(v.values, 0)).toBeCloseTo(1, 12);
    expect(skewness(v.values)).toBeCloseTo(SERIES.cagri.skew, 10);
  });

  it('shows all theoretical and empirical rule bands', () => {
    const v = deriveNormalView(4, defaults);
    for (const band of v.bands) {
      expect(band.sample).toBe(SERIES.sinav.band[band.k - 1].count / SERIES.sinav.values.length);
      expect(v.strip).toContain('±' + band.k + 'σ');
    }
  });

  it('keeps the histogram fixed when changing curve parameters', () => {
    const v = deriveNormalView(2, { ...defaults, mu: 100, sigma: 3 });
    expect(v.curve!.mu).toBe(100);
    expect(v.curve!.sigma).toBe(3);
    expect(v.bins).toEqual(deriveNormalView(2, defaults).bins);
  });

  it('respects Lab series selection in both skew and scaling steps', () => {
    const c = deriveNormalView(6, { ...defaults, seri: 'cagri' });
    expect(c.bands[0].sample).toBe(SERIES.cagri.band[0].count / SERIES.cagri.values.length);
    expect(c.mean).toBeGreaterThan(c.median);
    expect(deriveNormalView(7, { ...defaults, seri: 'sinav' }).seri).toBe('sinav');
  });

  it('keeps every strip finite at Lab extremes', () => {
    for (let i = 0; i < 8; i++) {
      for (const seri of ['sinav', 'cagri'] as const) {
        for (const sigma of [3, 20]) {
          const view = deriveNormalView(i, { ...defaults, seri, sigma, mu: 110, a: 110, b: 30, x: 110, k: 3 });
          expect(view.strip).not.toMatch(/NaN|Infinity|undefined/);
        }
      }
    }
  });
});
