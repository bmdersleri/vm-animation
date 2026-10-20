import { describe, it, expect } from 'vitest';
import { impurity, weighted, decrease, formulaText } from '../../../src/concepts/karar-agaci/impurity';
import { ATTRS, DAYS, candidates, winner } from '../../../src/concepts/karar-agaci/tennis';
import fixture from '../../fixtures/karar-agaci_sklearn.json';

describe('impurity', () => {
  it('root gini and entropy', () => {
    expect(impurity([9, 5], 'gini')).toBeCloseTo(0.459, 3);
    expect(impurity([9, 5], 'entropi')).toBeCloseTo(0.94, 3);
  });

  it('tennis table has 14 rows in spec order', () => {
    expect(DAYS).toHaveLength(14);
    expect(DAYS.map((d) => d.id)).toEqual(fixture.tennis.rows.map((r) => r.day));
    expect(DAYS.map((d) => d.y)).toEqual(fixture.tennis.rows.map((r) => r.y));
    expect(ATTRS).toEqual(fixture.tennis.attributes);
  });

  it('tennis candidates match the fixture', () => {
    const g = candidates('gini');
    const e = candidates('entropi');
    fixture.tennis.candidates.forEach((fc, i) => {
      expect(g[i].attr).toBe(i);
      expect(g[i].branches.map((b) => b.value)).toEqual(fc.branches.map((b) => b.value));
      expect(g[i].branches.map((b) => [...b.counts])).toEqual(fc.branches.map((b) => b.counts));
      expect(g[i].impurity).toBeCloseTo(fc.weightedGini, 3);
      expect(g[i].decrease).toBeCloseTo(fc.giniReduction, 3);
      expect(e[i].impurity).toBeCloseTo(fc.weightedEntropy, 3);
      expect(e[i].decrease).toBeCloseTo(fc.informationGain, 3);
    });
    expect(winner(g)).toBe(0);
    expect(winner(e)).toBe(0);
  });

  it('book example', () => {
    const kids = [[35, 15], [5, 45]] as const;
    expect(impurity([40, 60], 'gini')).toBeCloseTo(0.48, 3);
    expect(weighted(kids, 'gini')).toBeCloseTo(0.3, 3);
    expect(impurity([40, 60], 'entropi')).toBeCloseTo(0.971, 3);
    expect(weighted(kids, 'entropi')).toBeCloseTo(0.675, 3);
    expect(decrease([40, 60], kids, 'entropi')).toBeCloseTo(0.296, 3);
    expect(decrease([40, 60], kids, 'gini')).toBeCloseTo(fixture.book.giniReduction, 3);
  });

  it('formula text for Hava (gini)', () => {
    const hava = candidates('gini')[0];
    expect(formulaText(hava.branches.map((b) => b.counts), 'gini')).toBe(
      '5/14·(1 − (2/5)² − (3/5)²) + 4/14·(1 − (4/4)² − (0/4)²) + 5/14·(1 − (3/5)² − (2/5)²) = 0,343',
    );
  });

  it('formula text for entropy uses log2 and writes zero terms as 0', () => {
    const t = formulaText([[2, 3], [4, 0]], 'entropi');
    expect(t).toContain('−2/5·log₂(2/5) − 3/5·log₂(3/5)');
    expect(t).toContain('4/4·log₂(4/4)');
    expect(t).toContain('0');
  });

  it('empty child', () => {
    expect(weighted([[0, 0], [9, 5]], 'gini')).toBe(impurity([9, 5], 'gini'));
    expect(impurity([0, 0], 'entropi')).toBe(0);
  });
});
