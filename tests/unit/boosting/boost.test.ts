import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/boosting_sklearn.json';
import { BOOK, CURVES, REG } from '../../../src/concepts/boosting/data';
import {
  bestIndex, boost, boostSegments, earlyStop, predictBoost,
} from '../../../src/concepts/boosting/boost';

describe('boost', () => {
  it('the book loop gives the five book errors', () => {
    const run = boost(REG.train, REG.val, BOOK.nu, BOOK.depth, 5);
    const got = run.trainMse.map((v) => Math.round(v * 1e4) / 1e4);
    expect(got).toEqual([0.2952, 0.2138, 0.1587, 0.1201, 0.0933]);
    expect(got).toEqual([...BOOK.mse]);
    expect(run.f0).toBeCloseTo(REG.mean, 12);
  });

  it('train and val errors match sklearn for nu and depth grid', () => {
    expect(fixture.grid).toHaveLength(9);
    for (const g of fixture.grid) {
      const run = boost(REG.train, REG.val, g.nu, g.depth, 200);
      expect(run.trainMse).toHaveLength(200);
      for (let k = 0; k < 200; k++) {
        expect(run.trainMse[k], `train nu ${g.nu} depth ${g.depth} k ${k}`).toBeCloseTo(g.trainMse[k], 9);
        expect(run.valMse[k], `val nu ${g.nu} depth ${g.depth} k ${k}`).toBeCloseTo(g.valMse[k], 9);
      }
    }
  });

  it('segments reproduce predictBoost', () => {
    const run = boost(REG.train, REG.val, 0.3, 2, 30);
    for (const m of [0, 1, 5, 30]) {
      const segs = boostSegments(run, 0.3, m, 0, 10);
      expect(segs[0].x0).toBe(0);
      expect(segs[segs.length - 1].x1).toBe(10);
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i].x0).toBe(segs[i - 1].x1);
      }
      for (const s of segs) {
        const mid = (s.x0 + s.x1) / 2;
        expect(s.y).toBeCloseTo(predictBoost(run, 0.3, mid, m), 12);
      }
      for (const x of REG.train.x) {
        const seg = segs.find((s) => x >= s.x0 && x <= s.x1)!;
        expect(seg.y).toBeCloseTo(predictBoost(run, 0.3, x, m), 12);
      }
    }
  });

  it('best index of the nu 0.3 val curve is the data dip', () => {
    const run = boost(REG.train, REG.val, 0.3, 2, 200);
    const best = bestIndex(run.valMse);
    expect(best).toBe(34);
    expect(Math.round(run.valMse[best - 1] * 1e4) / 1e4).toBe(0.0139);
    const loss = CURVES.byLr[CURVES.lrs.indexOf(0.3)].valLoss;
    expect(bestIndex(loss)).toBe(91);
    expect(bestIndex([3, 1, 1, 2])).toBe(2);
  });

  it('early stop at the curve end reports no stop', () => {
    const run = boost(REG.train, REG.val, 0.3, 2, 200);
    const best = bestIndex(run.valMse);
    expect(earlyStop(run.valMse, 10)).toEqual({ best, stop: best + 10 });
    expect(earlyStop(run.valMse, 200)).toEqual({ best, stop: null });
    expect(earlyStop([3, 2, 1], 1)).toEqual({ best: 3, stop: null });
  });
});
