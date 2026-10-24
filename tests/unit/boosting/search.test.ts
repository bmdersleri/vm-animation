import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/boosting_sklearn.json';
import { SURFACE } from '../../../src/concepts/boosting/data';
import {
  cellIndex, gridTrials, mulberry32, sequentialSearch,
} from '../../../src/concepts/boosting/search';

describe('search', () => {
  it('mulberry32 matches the python twin', () => {
    for (const m of fixture.mulberry) {
      const rng = mulberry32(m.seed);
      for (const v of m.values) {
        expect(rng()).toBe(v);
      }
    }
  });

  it('grid of budget 8 is depths 3 5 by four learning rates', () => {
    const cells = gridTrials(8);
    const want: number[] = [];
    for (const d of [2, 4]) {
      for (const l of [0, 2, 4, 6]) {
        want.push(cellIndex(d, l));
      }
    }
    expect(cells).toEqual(want);
    expect(cells.map((c) => SURFACE.depths[Math.floor(c / 9)])).toEqual([3, 3, 3, 3, 5, 5, 5, 5]);
    expect(cells.slice(0, 4).map((c) => Number(SURFACE.lrs[c % 9].toPrecision(3))))
      .toEqual([0.01, 0.0316, 0.1, 0.316]);
  });

  it('sequential search matches the python twin for seeds 0 to 4', () => {
    expect(fixture.search.runs).toHaveLength(5);
    for (const run of fixture.search.runs) {
      expect(sequentialSearch(SURFACE.auc, fixture.search.budget, run.seed), `seed ${run.seed}`)
        .toEqual(run.order);
    }
  });

  it('sequential search never repeats a cell', () => {
    for (const seed of [0, 1, 2, 3, 4, 99]) {
      const order = sequentialSearch(SURFACE.auc, 54, seed);
      expect(order).toHaveLength(54);
      expect(new Set(order).size).toBe(54);
    }
  });
});
