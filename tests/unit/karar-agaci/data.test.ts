import { describe, it, expect } from 'vitest';
import { train, test, FEATURES, DOMAIN } from '../../../src/concepts/karar-agaci/data';
import fixture from '../../fixtures/karar-agaci_sklearn.json';

describe('karar-agaci data', () => {
  it('has train and test sizes in range', () => {
    expect(train.length).toBeGreaterThanOrEqual(24);
    expect(train.length).toBeLessThanOrEqual(30);
    expect(test.length).toBeGreaterThanOrEqual(10);
    expect(test.length).toBeLessThanOrEqual(12);
  });

  it('has integer t, c, y and bounded jitter', () => {
    for (const r of [...train, ...test]) {
      expect(Number.isInteger(r.t)).toBe(true);
      expect(Number.isInteger(r.c)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
      expect(r.t).toBeGreaterThanOrEqual(1);
      expect(r.t).toBeLessThanOrEqual(59);
      expect(r.c).toBeGreaterThanOrEqual(0);
      expect(r.c).toBeLessThanOrEqual(5);
      expect(Math.abs(r.jy)).toBeLessThanOrEqual(0.25);
    }
  });

  it('exports features and domain', () => {
    expect(FEATURES).toEqual(['Sözleşme süresi (ay)', 'Şikâyet sayısı']);
    expect(DOMAIN).toEqual({ x: [0, 60], y: [-0.5, 5.5] });
  });

  it('fixture has depth-2 and unlimited gini trees', () => {
    expect(fixture.trees.gini['2']).toBeDefined();
    expect(fixture.trees.gini['null']).toBeDefined();
  });
});
