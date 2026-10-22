import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { conditionalBase, fpGrowth, fpTree } from '../../../src/concepts/birliktelik/fptree';

const tx = sepetData.transactions;

describe('fp-tree', () => {
  it('fp-growth finds the same sets as apriori for every min_support', () => {
    for (let k = 1; k <= 18; k++) {
      expect(Object.fromEntries(fpGrowth(tx, k)), `min count ${k}`).toEqual(sepetData.fixture.frequent[String(k)]);
    }
  });

  it('items are ordered by frequency and recel is dropped at 4 baskets', () => {
    const t = fpTree(tx, 4);
    expect(t.order).toEqual(['sut', 'ekmek', 'yumurta', 'tereyagi', 'peynir']);
    expect(t.header.map((h) => h.total)).toEqual([12, 11, 10, 7, 5]);
    expect(t.filtered.flat()).not.toContain('recel');
    expect(t.filtered[0]).toEqual(['sut', 'ekmek', 'yumurta']);
    expect(t.snapshots).toHaveLength(19);
  });

  it('the last snapshot counts sum to the filtered baskets', () => {
    const t = fpTree(tx, 4);
    t.snapshots.forEach((snap, i) => {
      const n = t.filtered.slice(0, i).filter((f) => f.length > 0).length;
      expect(snap.children.reduce((s, c) => s + c.count, 0), `snapshot ${i}`).toBe(n);
    });
  });

  it('peynir conditional base gives sut 4 and yumurta 4', () => {
    const base = conditionalBase(fpTree(tx, 4), 'peynir');
    const total = (item: string): number => base.filter((p) => p.path.includes(item)).reduce((s, p) => s + p.count, 0);
    expect(total('sut')).toBe(4);
    expect(total('yumurta')).toBe(4);
    expect(total('ekmek')).toBe(1);
  });
});
