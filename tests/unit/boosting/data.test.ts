import { describe, it, expect } from 'vitest';
import {
  BOOK, BOOK_LRS, BOOK_XGB_AUC, CURVES, REG, SURFACE,
} from '../../../src/concepts/boosting/data';

describe('boosting data', () => {
  it('book numbers come from the data', () => {
    expect([...BOOK.mse]).toEqual([0.2952, 0.2138, 0.1587, 0.1201, 0.0933]);
    expect(BOOK.nu).toBe(0.3);
    expect(BOOK.depth).toBe(2);
    expect([...BOOK_LRS]).toEqual([0.01, 0.05, 0.1, 0.3, 0.5]);
    expect([...BOOK_XGB_AUC]).toEqual([0.9261, 0.9625, 0.9713, 0.9711, 0.9693]);
    expect(REG.train.x).toHaveLength(80);
    expect(REG.val.y).toHaveLength(80);
    expect(CURVES.lrs).toEqual([0.01, 0.05, 0.1, 0.3, 0.5, 1]);
    // Inverted U at 150 trees: nu 0.01 lowest, best in the middle, 0.5 below the best.
    const auc = BOOK_LRS.map((lr) => CURVES.byLr[CURVES.lrs.indexOf(lr)].valAuc[149]);
    const best = auc.indexOf(Math.max(...auc));
    expect(auc.indexOf(Math.min(...auc))).toBe(0);
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThan(auc.length - 1);
    for (const c of CURVES.byLr) {
      expect(c.trainLoss).toHaveLength(500);
      expect(c.valLoss).toHaveLength(500);
      expect(c.valAuc).toHaveLength(500);
    }
  });

  it('surface has 6 by 9 finite cells', () => {
    expect(SURFACE.depths).toEqual([1, 2, 3, 4, 5, 6]);
    expect(SURFACE.lrs).toHaveLength(9);
    expect(SURFACE.auc).toHaveLength(6);
    for (const row of SURFACE.auc) {
      expect(row).toHaveLength(9);
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    expect(SURFACE.nTrees).toBe(100);
    expect(SURFACE.cv).toBe(3);
  });
});
