import { describe, expect, it } from 'vitest';
import { deriveTreeView } from '../../../src/concepts/karar-agaci/view';
import { SCAN_N, treeScenario, type TreeParams } from '../../../src/concepts/karar-agaci/scenario';
import { bestSplit, forcedSplit, sweep, toSamples } from '../../../src/concepts/karar-agaci/cart';
import { train } from '../../../src/concepts/karar-agaci/data';
import { formulaText, impurity, rootFormula } from '../../../src/concepts/karar-agaci/impurity';
import { formatNumber } from '../../../src/core/plot/format';

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

  it('root row from step 2 on in parts 1 and 3, never in part 2', () => {
    expect(deriveTreeView(0, p()).rootRow).toBeNull();
    const g = deriveTreeView(1, p());
    expect(g.rootRow).toEqual({ label: 'Kök: 14 gün', counts: [9, 5], measures: [{ criterion: 'gini', value: impurity([9, 5], 'gini') }] });
    // the root step's strip is the root's own Gini
    expect(g.strip).toBe(rootFormula([9, 5], 'gini'));
    expect(g.strip).toContain('= 0,459');
    expect(deriveTreeView(1, p({ criterion: 'entropi' })).strip).toBe(rootFormula([9, 5], 'entropi'));
    for (const i of [2, 3, 4]) expect(deriveTreeView(i, p({ shown: 4 })).rootRow?.counts).toEqual([9, 5]);
    expect(deriveTreeView(5, p({ shown: 4, criterion: 'entropi' })).rootRow?.measures).toEqual([
      { criterion: 'entropi', value: impurity([9, 5], 'entropi') },
    ]);
    for (const i of [6, 7, 8, 9, 10]) expect(deriveTreeView(i, p({ depth: 1 })).rootRow, `index ${i}`).toBeNull();
  });

  it('book step: the root row and the card carry both criteria', () => {
    const v = deriveTreeView(11, p());
    expect(v.rootRow).toEqual({
      label: 'Kök: 100 müşteri',
      counts: [60, 40],
      measures: [
        { criterion: 'gini', value: impurity([60, 40], 'gini') },
        { criterion: 'entropi', value: impurity([60, 40], 'entropi') },
      ],
    });
    const c = v.cards[0];
    expect(c.alt?.criterion).toBe('entropi');
    expect(c.alt?.impurity).toBeCloseTo(0.675, 3);
    expect(c.alt?.decrease).toBeCloseTo(0.296, 3);
    // with entropy chosen, entropy comes first and Gini is the alternative
    const e = deriveTreeView(11, p({ criterion: 'entropi' }));
    expect(e.rootRow?.measures.map((m) => m.criterion)).toEqual(['entropi', 'gini']);
    expect(e.cards[0].alt?.criterion).toBe('gini');
    expect(e.cards[0].alt?.impurity).toBeCloseTo(0.3, 12);
  });

  it('only candidate questions are asked (title + "?")', () => {
    expect(deriveTreeView(2, p({ shown: 1 })).cards.every((c) => c.ask)).toBe(true);
    expect(deriveTreeView(8, p({ depth: 1 })).cards.every((c) => c.ask)).toBe(true);
    expect(deriveTreeView(11, p()).cards[0].ask).toBe(false);
  });

  it('a Lab user split at steps 7-9 shows its own card beside the tree\'s choice', () => {
    const best = bestSplit(samples, 'gini')!;
    for (const [i, depth] of [[6, 0], [7, 0], [8, 1]] as const) {
      const v = deriveTreeView(i, p({ depth, scan: -1, userSplit: { feature: 0, threshold: 23.4 } }));
      const s = forcedSplit(samples, 0, 23.4, 'gini');
      expect(v.cards, `index ${i}`).toHaveLength(2);
      const [own, tree] = v.cards;
      expect(own.title).toBe('Senin eşiğin: Sözleşme ≤ 23,4');
      expect(own.id).toBe('user');
      expect(own.ask).toBe(false);
      expect(own.win).toBe(false);
      expect(own.filled).toBe(true);
      expect(own.branches.map((b) => b.label)).toEqual(['≤ 23,4', '> 23,4']);
      expect(own.branches.map((b) => b.counts)).toEqual([s.left, s.right]);
      expect(own.impurity).toBeCloseTo(s.impurity, 12);
      expect(own.decrease).toBeCloseTo(impurity(v.tree!.counts, 'gini') - s.impurity, 12);
      expect(tree.title).toBe(`Ağacın seçimi: Şikâyet ≤ ${formatNumber(best.threshold, 1)}`);
      expect(tree.id).toBe('tree');
      expect(tree.win).toBe(true);
      expect(tree.impurity).toBeCloseTo(best.impurity, 12);
      expect(tree.branches.map((b) => b.counts)).toEqual([best.left, best.right]);
      // the strip follows the dragged split: its weighted Gini, live
      expect(v.strip).toBe(formulaText([s.left, s.right], 'gini'));
    }
    // dragged to the end of the axis: one side is empty, the weighted Gini equals the root's
    const e = deriveTreeView(6, p({ userSplit: { feature: 0, threshold: Math.max(...train.map((r) => r.t)) } }));
    expect(e.cards[0].branches[1].counts).toEqual([0, 0]);
    expect(e.cards[0].impurity).toBeCloseTo(impurity(e.tree!.counts, 'gini'), 12);
    expect(e.strip).not.toContain('NaN');
    // without a user split, steps 7-8 have no cards
    expect(deriveTreeView(6, p()).cards).toHaveLength(0);
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
