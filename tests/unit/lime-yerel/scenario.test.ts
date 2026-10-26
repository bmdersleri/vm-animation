import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BINS, BOOK, CUSTOMERS, KERNEL_WIDTH, MODEL, PRESETS, customerByRow, limeRun } from '../../../src/concepts/xai/data';
import { limeYerelScenario as sc } from '../../../src/concepts/lime-yerel/scenario';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const f3 = (v: number) => f(v, 3);
const signed = (v: number) => (v > 0 ? `+${f3(v)}` : f3(v));
const run = limeRun(301, 42, 5000);
const run77 = limeRun(77, 42, 5000);

describe('lime-yerel scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'yerel-soru',
      'kartil',
      'komsuluk',
      'ikili',
      'cekirdek',
      'vekil',
      'sadakat',
      'kararlilik',
      'shap-lime',
      'hata-ayiklama',
    ]);
    expect(sc.defaults).toMatchObject({ customer: 301, width: KERNEL_WIDTH, samples: 5000, compare: 77, fixed: false });
    expect(PRESETS[0]).toBe(301);
  });

  it('step texts read numbers from data', () => {
    const c = customerByRow(301);
    expect(step('yerel-soru').text).toContain(`p(ayrılma) = ${f3(c.p)}`);
    expect(step('yerel-soru').text).toContain(`tenure ${c.values[0]}, MonthlyCharges ${f(c.values[1], 2)}, TotalCharges 2366,05`);
    expect(step('kartil').text).toContain('tenure 17 / 28 / 41,25');
    expect(step('kartil').text).toContain('MonthlyCharges 39,87 / 51,59 / 59,36');
    expect(step('kartil').text).toContain('TotalCharges 2294,79 / 2474,31 / 2714,64');
    expect(step('kartil').text).toContain(`${MODEL.nTrain} eğitim müşterisi`);
    for (const j of [0, 1, 2]) {
      expect(step('kartil').text).toContain(BINS.names[j][run.bins[j]]);
    }
    expect(step('komsuluk').text).toContain(`Örnek sayısı ${run.samples}`);
    expect(step('ikili').text).toContain(`${run.patterns[7].n} örnek, ortalama p = ${f3(run.patterns[7].mean)}`);
    expect(step('cekirdek').text).toContain(`w = 0,75 · √3 = ${f3(KERNEL_WIDTH)}`);
    expect(step('cekirdek').text).toContain('1,000 / 0,744 / 0,553 / 0,411');
    expect(step('vekil').text).toContain(`tenure > 41.25 ${signed(run.fit.coef[0])}`);
    expect(step('vekil').text).toContain(`${signed(run.fit.coef[2])}`);
    expect(step('vekil').text).toContain(`kesişim ${f3(run.fit.intercept)}`);
    expect(step('sadakat').text).toContain(
      `${f3(run.fit.intercept)} + ${f3(run.fit.coef[0])} + ${f3(run.fit.coef[1])} − ${f3(-run.fit.coef[2])} = ${f3(run.fit.localPred)}`,
    );
    expect(step('sadakat').text).toContain(`model ${f3(c.p)}`);
    expect(step('sadakat').text).toContain(`R² = ${f3(run.fit.score!)}`);
    expect(step('kararlilik').text).toContain('11 tohumda');
    expect(step('kararlilik').text).toMatch(/5000 örnekle 0,\d{3} … 0,\d{3}, 50 örnekle -?[−0-9,]+ … /);
    // the book's bolum13_kod09 run (seeds 42 and 0-9): 0.525 - 0.551 with 5000 samples, 0.404 - 0.554 with 50
    expect(step('kararlilik').text.replace(/\s/g, ' ')).toContain('5000 örnekle 0,525 … 0,551, 50 örnekle 0,404 … 0,554');
    const c77 = customerByRow(77);
    expect(step('shap-lime').text).toContain(`MonthlyCharges (${signed(c77.shap[1])})`);
    expect(step('shap-lime').text).toContain(`tenure (${signed(run77.fit.coef[0])})`);
    expect(step('shap-lime').text).toContain(`model p = ${f3(c77.p)}, vekil tahmini ${f3(run77.fit.localPred)}`);
    expect(step('shap-lime').text).toContain(`${CUSTOMERS.length} test müşterisinin ${MODEL.topDisagree} tanesinde`);
    expect(step('hata-ayiklama').text).toContain(f3(BOOK.fixedCodeP));
  });

  it('book values are pinned', () => {
    expect([...run.fit.coef.map(f3), f3(run.fit.intercept)]).toEqual(['0,540', '0,074', '−0,023', '0,146']);
    expect(f3(run.fit.localPred)).toBe('0,737');
  });

  it('no step resets the lab customer choice', () => {
    const keys = ['customer', 'width', 'samples', 'compare', 'fixed'];
    for (const s of sc.steps) {
      for (const k of keys) {
        expect(Object.keys(s.params ?? {}), s.id).not.toContain(k);
      }
    }
  });

  it('step 3 sweeps five groups of a hundred dots', () => {
    expect(step('komsuluk').sweep?.key).toBe('scan');
    expect(step('komsuluk').sweep?.values).toHaveLength(5);
    expect(sc.steps.filter((s) => s.sweep).map((s) => s.id)).toEqual(['komsuluk', 'shap-lime', 'hata-ayiklama']);
    // step 9: the book customer, then the pair; step 10: five bugs, then the corrected code
    expect(step('shap-lime').sweep?.values).toEqual([1, 2]);
    expect(step('hata-ayiklama').sweep?.values).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
