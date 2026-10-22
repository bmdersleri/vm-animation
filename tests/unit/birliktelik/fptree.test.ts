import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { conditionalBase, fpGrowth, fpTree } from '../../../src/concepts/birliktelik/fptree';
import { minCountFor } from '../../../src/concepts/birliktelik/rules';

const tx = sepetData.transactions;

describe('fp-tree', () => {
  it('fp-growth finds the same sets as apriori for every min_support', () => {
    for (let k = 1; k <= 18; k++) {
      expect(Object.fromEntries(fpGrowth(tx, k)), `min count ${k}`).toEqual(sepetData.fixture.frequent[String(k)]);
    }
  });

  it('min_support 0.5 / 0.3 / 0.2 / 0.15 give 4 / 7 / 12 / 16 sets through minCountFor', () => {
    for (const [ms, sets] of [[0.5, 4], [0.3, 7], [0.2, 12], [0.15, 16]]) {
      const k = minCountFor(ms, tx.length);
      expect(fpGrowth(tx, k).size, `min_support ${ms}`).toBe(sets);
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

  it('the final tree has the expected structure and stable node ids', () => {
    const t = fpTree(tx, 4);
    const last = t.snapshots[18];
    expect(last.children.map((c) => [c.id, c.count])).toContainEqual(['root>sut', 12]);
    expect(last.children.map((c) => [c.id, c.count])).toContainEqual(['root>ekmek', 4]);
    const sut = last.children.find((c) => c.item === 'sut');
    expect(sut?.children.find((c) => c.item === 'yumurta')?.count).toBe(4);
    const ids = (n: { id: string; children: readonly (typeof n)[] }): string[] => [n.id, ...n.children.flatMap(ids)];
    const early = new Set(ids(t.snapshots[5]));
    const late = new Set(ids(last));
    for (const id of early) expect(late.has(id), id).toBe(true);
  });

  it('peynir conditional base gives sut 4 and yumurta 4', () => {
    const base = conditionalBase(fpTree(tx, 4), 'peynir');
    const total = (item: string): number => base.filter((p) => p.path.includes(item)).reduce((s, p) => s + p.count, 0);
    expect(total('sut')).toBe(4);
    expect(total('yumurta')).toBe(4);
    expect(total('ekmek')).toBe(1);
    const key = (p: { path: readonly string[]; count: number }): string => `${p.path.join('>')}:${p.count}`;
    expect(base.map(key).sort()).toEqual(['sut:1', 'sut>ekmek>yumurta:1', 'sut>yumurta:2', 'yumurta:1']);
  });
});
