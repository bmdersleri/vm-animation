import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { aprioriTrace } from '../../../src/concepts/birliktelik/apriori';
import { fpGrowth } from '../../../src/concepts/birliktelik/fptree';
import { minCountFor } from '../../../src/concepts/birliktelik/rules';
import { setAbbr } from '../../../src/concepts/birliktelik/format';
import { aprioriScenario as scenario } from '../../../src/concepts/apriori/scenario';
import { SUPPORT_STOPS } from '../../../src/concepts/apriori/view';
import { labTextTests } from '../lab-text';

const steps = scenario.steps;
const tx = sepetData.transactions;
const text = (id: string): string => steps.find((s) => s.id === id)!.text;
const trace = aprioriTrace(tx, 4);

describe('apriori scenario', () => {
  it('step ids follow the spec', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'uzay', 'seviye1', 'ozellik', 'seviye2', 'budama', 'dur', 'esik', 'fp-sira', 'fp-agac', 'kosullu', 'karsilastir',
    ]);
    for (const s of steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(scenario.defaults).toEqual({ minCount: 4, level: 0, inserted: 0, baseItem: null, node: null });
  });

  it('level 2 text names the 6 frequent pairs from the trace', () => {
    const pairs = trace.levels[1].candidates;
    const frequent = pairs.filter((c) => c.status === 'frequent');
    expect(frequent).toHaveLength(6);
    for (const c of frequent) expect(text('seviye2')).toContain(`${setAbbr(c.set)} ${c.count}`);
    for (const c of pairs.filter((q) => q.status === 'infrequent')) expect(text('seviye2')).toContain(`${setAbbr(c.set)} ${c.count}`);
    expect(text('seviye2')).toContain(`${pairs.length} çift aday`);
    expect(text('seviye2')).toContain('6 tanesi sık');
    expect(text('seviye2')).toContain('4 tanesi sık değil');
  });

  it('threshold sweep stops give 4, 7, 12, 16 sets', () => {
    const sweep = steps.find((s) => s.id === 'esik')!.sweep!;
    expect(sweep.key).toBe('minCount');
    expect(sweep.values).toEqual([0.5, 0.3, 0.2, 0.15].map((s) => minCountFor(s, tx.length)));
    expect(sweep.values).toEqual([9, 6, 4, 3]);
    expect(SUPPORT_STOPS.map((s) => aprioriTrace(tx, s.minCount).frequent.size)).toEqual([4, 7, 12, 16]);
    expect(text('esik')).toContain('0,5 → 0,3 → 0,2 → 0,15');
    expect(text('esik')).toContain('9 → 6 → 4 → 3 fiş');
    expect(text('esik')).toContain('0,15 × 18 = 2,7 → en az 3');
    expect(text('esik')).toContain('4 → 7 → 12 → 16');
  });

  it('step texts read their numbers from the trace', () => {
    expect(text('uzay')).toContain('2⁶ − 1 = 63');
    expect(text('seviye1')).toContain('6 aday');
    expect(text('seviye1')).toContain('Reçel 3 < 4 → sık değil; diğer 5 ürün sık');
    expect(text('seviye1')).toContain('min_support 0,2 → en az 4 fiş');
    expect(text('ozellik')).toContain('(31 düğüm)');
    expect(text('budama')).toContain('EST (ST sık değil)');
    expect(text('budama')).toContain('ESY 5 (sık), SYP 3 (sık değil)');
    expect(text('dur')).toContain(`${trace.frequent.size} sık küme`);
    expect(text('dur')).toContain(`${trace.counted} aday sayıldı`);
    expect(text('dur')).toContain('63 küme sayardı');
    expect(trace.frequent.size).toBe(12);
    expect(trace.counted).toBe(18);
  });

  it('fp-growth steps read the tree and the conditional base', () => {
    expect(text('fp-sira')).toContain('Süt 12, Ekmek 11, Yumurta 10, Tereyağı 7, Peynir 5');
    expect(text('fp-sira')).toContain('Reçel 3 < 4');
    expect(text('fp-agac')).toMatch(/18 fiş \d+ düğümde toplanır/);
    expect(text('kosullu')).toContain('Süt 4, Ekmek 1, Yumurta 4');
    expect(text('kosullu')).toContain('{Süt, Peynir} 4 ≥ 4 sık');
    expect(text('kosullu')).toContain('{Yumurta, Peynir} 4 ≥ 4 sık');
    expect(text('kosullu')).toContain('{Süt, Yumurta, Peynir} 3 < 4 sık değil');
    expect(text('karsilastir')).toContain('aynı 12 sık kümeyi');
    expect(fpGrowth(tx, 4).size).toBe(12);
    expect(text('karsilastir')).toContain('Apriori 0,75 ms, FP-Growth 0,49 ms');
  });

  it('steps paint the levels the spec names', () => {
    const level = (id: string): number => steps.find((s) => s.id === id)!.params!.level!;
    expect(['uzay', 'seviye1', 'ozellik', 'seviye2', 'budama', 'dur', 'esik'].map(level)).toEqual([0, 1, 1, 2, 3, 6, 6]);
    expect(steps.find((s) => s.id === 'esik')!.params).not.toHaveProperty('minCount');
    expect(steps.find((s) => s.id === 'kosullu')!.params).toMatchObject({ baseItem: 'peynir', inserted: 18 });
  });

  it('no product name takes a Turkish suffix in any step text', () => {
    const names = Object.values(sepetData.names);
    const bad = new RegExp(`(${names.join('|')})(['’]|\\p{L})`, 'u');
    for (const s of steps) {
      expect(s.text, s.id).not.toMatch(bad);
      expect(s.labText ?? '', s.id).not.toMatch(bad);
      expect(s.title, s.id).not.toMatch(bad);
    }
  });

  labTextTests(steps, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
