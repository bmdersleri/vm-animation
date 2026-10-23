import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/topluluk_sklearn.json';
import { BOOTS, CUSTOMERS, SINGLE } from '../../../src/concepts/topluluk/data';
import { leafCount, predictTree, rootSplit } from '../../../src/concepts/topluluk/tree';

describe('topluluk tree', () => {
  it('every tree matches sklearn on the fixture grid', () => {
    const { cols, rows, xs, ys, pred } = fixture.grid;
    expect(pred).toHaveLength(50);
    for (let k = 0; k < 50; k++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const got = predictTree(BOOTS[k].tree, [xs[c], ys[r]]);
          expect(got, `tree ${k} row ${r} col ${c}`).toBe(pred[k][r * cols + c]);
        }
      }
    }
  });

  it('the single tree fits all 25 customers', () => {
    expect(CUSTOMERS).toHaveLength(25);
    for (const cu of CUSTOMERS) {
      expect(predictTree(SINGLE, [cu.t, cu.c])).toBe(cu.y);
    }
    expect(leafCount(SINGLE)).toBeGreaterThan(1);
  });

  it('root splits of the first three trees differ', () => {
    const roots = BOOTS.slice(0, 3).map((b) => rootSplit(b.tree));
    for (const r of roots) {
      expect(r).not.toBeNull();
    }
    const keys = roots.map((r) => `${r?.f}|${r?.t}`);
    expect(new Set(keys).size).toBe(3);
  });

  it('a one-node tree has no root split', () => {
    const stump = [{ f: -1 as const, t: 0, l: -1, r: -1, v: [3, 1] as [number, number] }];
    expect(rootSplit(stump)).toBeNull();
    expect(leafCount(stump)).toBe(1);
    expect(predictTree(stump, [0, 0])).toBe(0);
  });
});
