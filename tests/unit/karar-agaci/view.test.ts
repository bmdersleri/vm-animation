import { describe, expect, it } from 'vitest';
import { deriveTreeView } from '../../../src/concepts/karar-agaci/view';
import { SCAN_N, treeScenario, type TreeParams } from '../../../src/concepts/karar-agaci/scenario';
import { bestSplit, sweep, toSamples } from '../../../src/concepts/karar-agaci/cart';
import { train } from '../../../src/concepts/karar-agaci/data';

const D = treeScenario.defaults;
const p = (over: Partial<TreeParams> = {}): TreeParams => ({ ...D, ...over });
const samples = toSamples(train);
const n0 = sweep(samples, 0, 'gini').length;

describe('deriveTreeView', () => {
  it('part per step', () => {
    const parts = treeScenario.steps.map((_, i) => deriveTreeView(i, p()).part);
    expect(parts.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(parts.slice(6, 11)).toEqual([2, 2, 2, 2, 2]);
    expect(parts[11]).toBe(3);
  });

  it('step 0 has four empty cards and no strip', () => {
    const v = deriveTreeView(0, p({ shown: 0 }));
    expect(v.cards).toHaveLength(4);
    expect(v.cards.every((c) => !c.filled && !c.win)).toBe(true);
    expect(v.strip).toBeNull();
    expect(v.root).toEqual([9, 5]);
  });

  it('step 2 focuses Hava with its formula', () => {
    const v = deriveTreeView(2, p({ shown: 1 }));
    expect(v.cards[0].title).toBe('Hava');
    expect(v.cards[0].filled).toBe(true);
    expect(v.cards[1].filled).toBe(false);
    expect(v.strip).toContain('= 0,343');
    expect(v.gainLabel).toBe('Gini azalması');
  });

  it('step 3 focuses the last filled card', () => {
    const v = deriveTreeView(3, p({ shown: 3 }));
    expect(v.cards.filter((c) => c.filled)).toHaveLength(3);
    expect(v.strip).toContain('·(');
  });

  it('step 4 marks Hava as the winner, Bulutlu 4/0', () => {
    const v = deriveTreeView(4, p({ shown: 4 }));
    expect(v.cards.map((c) => c.win)).toEqual([true, false, false, false]);
    const bulutlu = v.cards[0].branches.find((b) => b.label === 'Bulutlu');
    expect(bulutlu?.counts).toEqual([4, 0]);
    expect(v.strip).toContain('= 0,343');
  });

  it('entropy step labels bilgi kazancı and Hava wins with 0.247', () => {
    const v = deriveTreeView(5, p({ shown: 4, criterion: 'entropi' }));
    expect(v.gainLabel).toBe('bilgi kazancı (bit)');
    expect(v.criterion).toBe('entropi');
    expect(v.cards[0].win).toBe(true);
    expect(v.cards[0].decrease).toBeCloseTo(0.247, 3);
  });

  it('scan index maps to feature and threshold; the curve grows to upTo', () => {
    const a = deriveTreeView(7, p({ scan: 3 }));
    expect(a.scanLine?.feature).toBe(0);
    expect(a.scanLine?.threshold).toBe(sweep(samples, 0, 'gini')[3].threshold);
    expect(a.curve?.feature).toBe(0);
    expect(a.curve?.upTo).toBe(3);
    expect(a.curve?.otherBest).toBeNull();
    const b = deriveTreeView(7, p({ scan: n0 + 2 }));
    expect(b.scanLine?.feature).toBe(1);
    expect(b.scanLine?.threshold).toBe(sweep(samples, 1, 'gini')[2].threshold);
    expect(b.curve?.feature).toBe(1);
    expect(b.curve?.upTo).toBe(2);
    const best0 = deriveTreeView(7, p({ scan: SCAN_N - 1 }));
    expect(b.curve?.otherBest).toEqual(sweep(samples, 0, 'gini').reduce((m, q) => (q.impurity < m.impurity - 1e-12 ? q : m)));
    expect(best0.curve?.upTo).toBe(SCAN_N - n0 - 1);
    expect(deriveTreeView(7, p({ scan: -1 })).scanLine).toBeNull();
    expect(deriveTreeView(7, p({ scan: -1 })).curve).toBeNull();
  });

  it('step 8 shows two cards, one per feature, the winner equals bestSplit', () => {
    const v = deriveTreeView(8, p({ depth: 1 }));
    const best = bestSplit(samples, 'gini')!;
    expect(v.cards).toHaveLength(2);
    expect(v.cards.map((c) => c.win)).toEqual([best.feature === 0, best.feature === 1]);
    const w = v.cards[best.feature];
    expect(w.impurity).toBeCloseTo(best.impurity, 12);
    expect(w.branches.map((b) => b.counts)).toEqual([best.left, best.right]);
    expect(v.chosen?.threshold).toBe(best.threshold);
    expect(v.tree?.split?.threshold).toBe(best.threshold);
    expect(v.tree?.left?.split).toBeNull();
    expect(v.strip).not.toBeNull();
    expect(v.acc?.test).toBeNull();
  });

  it('userSplit gives a forced root with two leaves and keeps chosen', () => {
    const v = deriveTreeView(8, p({ depth: 1, userSplit: { feature: 1, threshold: 0.5 } }));
    const best = bestSplit(samples, 'gini')!;
    expect(v.tree?.split?.feature).toBe(1);
    expect(v.tree?.split?.threshold).toBe(0.5);
    expect(v.tree?.left?.split).toBeNull();
    expect(v.tree?.right?.split).toBeNull();
    expect(v.tree?.left?.box.y[1]).toBe(0.5);
    expect(v.tree?.right?.box.y[0]).toBe(0.5);
    expect(v.chosen?.threshold).toBe(best.threshold);
    expect(v.chosen?.feature).toBe(best.feature);
  });

  it('deep tree reaches full training accuracy and shows test only when asked', () => {
    const v = deriveTreeView(10, p({ depth: Infinity, showTest: true }));
    expect(v.acc?.train).toBe(1);
    expect(v.acc?.test).toBeLessThan(1);
    expect(v.showTest).toBe(true);
    expect(deriveTreeView(10, p({ depth: Infinity })).acc?.test).toBeNull();
  });

  it('book step: one card, 0.480 → 0.300', () => {
    const v = deriveTreeView(11, p());
    expect(v.part).toBe(3);
    expect(v.root).toEqual([60, 40]);
    expect(v.cards).toHaveLength(1);
    const c = v.cards[0];
    expect(c.branches.map((b) => b.counts)).toEqual([[15, 35], [45, 5]]);
    expect(c.filled && c.win).toBe(true);
    expect(c.impurity).toBeCloseTo(0.3, 12);
    expect(c.decrease).toBeCloseTo(0.18, 12);
    expect(v.strip).toContain('= 0,300');
    const e = deriveTreeView(11, p({ criterion: 'entropi' }));
    expect(e.cards[0].decrease).toBeCloseTo(0.296, 3);
    expect(e.gainLabel).toBe('bilgi kazancı (bit)');
  });
});
