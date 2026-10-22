import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { setKey } from '../../../src/concepts/birliktelik/format';
import { minCountFor, rules } from '../../../src/concepts/birliktelik/rules';
import { count } from '../../../src/concepts/birliktelik/metrics';
import { applyEdits } from '../../../src/concepts/birliktelik-olculeri/view';

const tx = sepetData.transactions;
const r6 = (v: number): number => Math.round(v * 1e6);

describe('rules', () => {
  it('rules at 0.2 and 0.5 match mlxtend', () => {
    const got = rules(tx, 0.2, 0.5);
    const want = sepetData.fixture.rules;
    expect(got).toHaveLength(want.length);
    got.forEach((g, i) => {
      expect([setKey(g.x), setKey(g.y)]).toEqual([want[i].x, want[i].y]);
      expect(g.support).toBeCloseTo(want[i].support, 5);
      expect(g.confidence).toBeCloseTo(want[i].confidence, 5);
      expect(g.lift).toBeCloseTo(want[i].lift, 5);
    });
  });

  it('rule counts match the mlxtend grid', () => {
    const entries = Object.entries(sepetData.fixture.grid);
    expect(entries).toHaveLength(12);
    for (const [key, want] of entries) {
      const [s, c] = key.split('|').map(Number);
      expect(rules(tx, s, c).length, key).toBe(want);
    }
  });

  it('rules on edited baskets match a brute-force enumeration', () => {
    const items = sepetData.items;
    const cells = tx.length * items.length;
    // seeded MINSTD generator: the same 20 edit lists on every run
    let seed = 20261022;
    const rand = (m: number): number => {
      seed = (seed * 48271) % 2147483647;
      return seed % m;
    };
    const subsets = (set: readonly string[]): string[][] =>
      Array.from({ length: (1 << set.length) - 1 }, (_, m) => set.filter((_, i) => (m + 1) & (1 << i)));
    const all = subsets(items);
    for (let k = 0; k < 20; k++) {
      const edits = Array.from({ length: 1 + rand(30) }, () => rand(cells));
      const baskets = applyEdits(edits);
      const n = baskets.length;
      for (const s of [0.1, 0.2, 0.3]) {
        for (const c of [0.3, 0.5]) {
          const want = new Map<string, number>();
          for (const x of all) {
            for (const y of all) {
              if (y.some((i) => x.includes(i))) continue;
              const both = count(baskets, [...x, ...y]);
              if (both < minCountFor(s, n)) continue;
              const conf = both / count(baskets, x);
              if (conf < c - 1e-9) continue;
              want.set(`${setKey(x)}>${setKey(y)}`, r6(conf / (count(baskets, y) / n)));
            }
          }
          const got = new Map(rules(baskets, s, c).map((r) => [`${setKey(r.x)}>${setKey(r.y)}`, r6(r.lift)]));
          expect(got, `edits ${edits.join(',')} at ${s} / ${c}`).toEqual(want);
        }
      }
    }
  });

  it('9 of 13 rules have lift above 1.1', () => {
    const all = rules(tx, 0.2, 0.5);
    expect(all).toHaveLength(13);
    expect(all.filter((r) => r.lift > 1.1)).toHaveLength(9);
  });
});
