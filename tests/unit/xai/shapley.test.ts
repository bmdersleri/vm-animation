import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/xai_shap_lime.json';
import { orderings, marginals, popcount, shapley, shapleyByOrder, shapleyWeight } from '../../../src/concepts/xai/shapley';

describe('xai shapley', () => {
  it('shapley matches the fixture for all hundred customers', () => {
    expect(fixture.customers).toHaveLength(100);
    for (const c of fixture.customers) {
      const phi = shapley(c.v);
      phi.forEach((value, j) => {
        expect(Math.abs(value - c.shap[j]), `row ${c.row} feature ${j}`).toBeLessThan(1e-12);
      });
    }
  });

  it('formula and orderings agree', () => {
    for (const c of fixture.customers) {
      const a = shapley(c.v);
      const b = shapleyByOrder(c.v);
      a.forEach((value, j) => {
        expect(Math.abs(value - b[j]), `row ${c.row} feature ${j}`).toBeLessThan(1e-12);
      });
    }
  });

  it('values add up to p', () => {
    for (const c of fixture.customers) {
      const phi = shapley(c.v);
      expect(Math.abs(c.v[0] + phi[0] + phi[1] + phi[2] - c.p), `row ${c.row}`).toBeLessThan(1e-12);
      expect(Math.abs(c.v[7] - c.p), `row ${c.row}`).toBeLessThan(1e-12);
    }
  });

  it('six orderings in lexicographic order', () => {
    expect(orderings()).toEqual([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]);
    const v = fixture.customers[0].v;
    const m = marginals(v, [0, 1, 2]);
    expect(m[0]).toBeCloseTo(v[1] - v[0], 15);
    expect(m[1]).toBeCloseTo(v[3] - v[1], 15);
    expect(m[2]).toBeCloseTo(v[7] - v[3], 15);
    const m2 = marginals(v, [2, 0, 1]);
    expect(m2[2]).toBeCloseTo(v[4] - v[0], 15);
    expect(m2[0]).toBeCloseTo(v[5] - v[4], 15);
    expect(m2[1]).toBeCloseTo(v[7] - v[5], 15);
    expect(popcount(0)).toBe(0);
    expect(popcount(5)).toBe(2);
    expect(popcount(7)).toBe(3);
  });

  it('weights for three features are a third and a sixth', () => {
    expect(shapleyWeight(0, 3)).toBeCloseTo(1 / 3, 15);
    expect(shapleyWeight(1, 3)).toBeCloseTo(1 / 6, 15);
    expect(shapleyWeight(2, 3)).toBeCloseTo(1 / 3, 15);
  });
});
