import { describe, expect, it } from 'vitest';
import { aprioriTrace, latticeState } from '../../../src/concepts/birliktelik/apriori';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { minCountFor } from '../../../src/concepts/birliktelik/rules';
import { setKey, sortItems } from '../../../src/concepts/birliktelik/format';

const tx = sepetData.transactions;

describe('apriori', () => {
  it('frequent itemsets match mlxtend for every min_support', () => {
    for (let k = 1; k <= 18; k++) {
      const got = Object.fromEntries(aprioriTrace(tx, k).frequent);
      expect(got, `min count ${k}`).toEqual(sepetData.fixture.frequent[String(k)]);
    }
  });

  it('trace at 4 baskets counts 18 candidates and finds 12 sets', () => {
    const t = aprioriTrace(tx, 4);
    expect(t.counted).toBe(18);
    expect(t.frequent.size).toBe(12);
    expect(t.levels.map((l) => l.candidates.length)).toEqual([6, 10, 4]);
    expect(t.levels[0].candidates.find((c) => c.set[0] === 'recel')).toMatchObject({ status: 'infrequent', count: 3 });
  });

  it('level 3 prunes EST and ETY without counting', () => {
    const level3 = aprioriTrace(tx, 4).levels[2].candidates;
    const est = level3.find((c) => setKey(c.set) === 'ekmek,sut,tereyagi');
    const ety = level3.find((c) => setKey(c.set) === 'ekmek,yumurta,tereyagi');
    for (const c of [est, ety]) {
      expect(c).toMatchObject({ status: 'pruned', count: null });
    }
    expect(est?.prunedBy).toEqual(['sut', 'tereyagi']);
    expect(ety?.prunedBy).toEqual(['yumurta', 'tereyagi']);
  });

  it('every superset of an infrequent set is pruned in the lattice', () => {
    const t = aprioriTrace(tx, 4);
    const items = sepetData.items;
    let supersets = 0;
    for (let mask = 1; mask < 1 << items.length; mask++) {
      const set = sortItems(items.filter((_, i) => mask & (1 << i)));
      if (set.includes('recel') && set.length > 1) {
        expect(latticeState(t, set), setKey(set)).toBe('pruned');
        supersets++;
      }
    }
    expect(supersets).toBe(31);
    expect(latticeState(t, ['recel'])).toBe('infrequent');
    expect(latticeState(t, ['ekmek', 'sut'])).toBe('frequent');
    expect(latticeState(t, ['ekmek', 'sut', 'tereyagi'])).toBe('pruned');
    expect(latticeState(t, ['ekmek', 'sut', 'yumurta', 'tereyagi'])).toBe('pruned');
    expect(latticeState(t, [])).toBe('unseen');
  });

  it('min_support 0.5 / 0.3 / 0.2 / 0.15 give 4 / 7 / 12 / 16 sets through minCountFor', () => {
    for (const [ms, minCount, sets] of [[0.5, 9, 4], [0.3, 6, 7], [0.2, 4, 12], [0.15, 3, 16]]) {
      const k = minCountFor(ms, tx.length);
      expect(k, `min_support ${ms}`).toBe(minCount);
      expect(aprioriTrace(tx, k).frequent.size).toBe(sets);
      expect(Object.keys(sepetData.fixture.frequent[String(k)])).toHaveLength(sets);
    }
  });
});
