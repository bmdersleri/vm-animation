import { describe, it, expect } from 'vitest';
import { formatNumber as f, formatPercent } from '../../../src/core/plot/format';
import { CUSTOMERS, MODEL, PRESETS, customerByRow } from '../../../src/concepts/xai/data';
import { marginals, orderings } from '../../../src/concepts/xai/shapley';
import { shapDegerleriScenario as sc } from '../../../src/concepts/shap-degerleri/scenario';
import { tenureCorrelation } from '../../../src/concepts/shap-degerleri/calc';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const f3 = (v: number) => f(v, 3);
const signed = (v: number) => (v > 0 ? `+${f3(v)}` : f3(v));

describe('shap-degerleri scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'kara-kutu',
      'genel-onem',
      'koalisyon',
      'marjinal',
      'alti-siralama',
      'toplam',
      'kuvvet',
      'global',
      'ozet-grafik',
      'sinirlar',
    ]);
    expect(sc.defaults).toMatchObject({ customer: 301, order: 0, second: 77, highlight: 301, colorBy: -1 });
    expect(PRESETS[0]).toBe(301);
  });

  it('step texts read numbers from data', () => {
    const c = customerByRow(301);
    const c77 = customerByRow(77);
    const c217 = customerByRow(217);
    expect(step('kara-kutu').text).toContain(`p(ayrılma) = ${f3(c.p)}`);
    expect(step('kara-kutu').text).toContain(`tenure ${c.values[0]}, MonthlyCharges ${f(c.values[1], 2)}, TotalCharges 2366,05`);
    expect(step('kara-kutu').text).toContain(formatPercent(MODEL.accuracy, 1));
    expect(step('genel-onem').text).toContain(MODEL.importances.map(f3).join(' / '));
    expect(step('koalisyon').text).toContain(`v(∅) = ${f3(c.v[0])}`);
    expect(step('koalisyon').text).toContain(`v({tenure}) = ${f3(c.v[1])}`);
    expect(step('koalisyon').text).toContain(`v(hepsi) = ${f3(c.v[7])}`);
    const m0 = marginals(c.v, orderings()[0]);
    const m5 = marginals(c.v, orderings()[5]);
    expect(step('marjinal').text).toContain(m0.map(signed).join(', '));
    expect(step('marjinal').text).toContain(`toplam ${f3(c.p - MODEL.base)} = ${f3(c.p)} − ${f3(MODEL.base)}`);
    expect(step('marjinal').text).toContain(`TotalCharges → MonthlyCharges → tenure sırasında ${signed(m5[0])}`);
    expect(step('alti-siralama').text).toContain(c.shap.map(f3).join(' / '));
    expect(step('alti-siralama').text).toContain('⅓, ⅙, ⅙, ⅓');
    expect(step('toplam').text).toContain(`${f3(MODEL.base)} → ${signed(c.shap[0])} → ${signed(c.shap[1])} → ${signed(c.shap[2])} → ${f3(c.p)}`);
    expect(step('kuvvet').text).toContain(`p = ${f3(c77.p)}`);
    expect(step('kuvvet').text).toContain(`tenure ${signed(c77.shap[0])}`);
    expect(step('kuvvet').text).toContain(`MonthlyCharges ${signed(c77.shap[1])}`);
    expect(step('kuvvet').text).toContain(`TotalCharges ${signed(c77.shap[2])}`);
    expect(step('global').text).toContain(MODEL.meanAbsShap.map(f3).join(' / '));
    expect(step('global').text).toContain(MODEL.importances.map(f3).join(' / '));
    expect(step('ozet-grafik').text).toContain(`korelasyon ${f(tenureCorrelation(), 2)}`);
    expect(step('ozet-grafik').text).toContain(`${CUSTOMERS.length} test müşterisi`);
    expect(step('sinirlar').text).toContain(`MonthlyCharges (${signed(c217.shap[1])}), tenure ${signed(c217.shap[0])}`);
    expect(step('sinirlar').text).toContain('müşteri 217');
  });

  it('no step resets the lab customer choice', () => {
    const keys = ['customer', 'order', 'second', 'highlight', 'colorBy'];
    for (const s of sc.steps) {
      for (const k of keys) {
        expect(Object.keys(s.params ?? {}), s.id).not.toContain(k);
      }
    }
  });

  it('steps 3 and 5 sweep', () => {
    expect(step('koalisyon').sweep?.key).toBe('scan');
    expect(step('koalisyon').sweep?.values).toHaveLength(8);
    expect(step('alti-siralama').sweep?.key).toBe('scan');
    expect(step('alti-siralama').sweep?.values).toHaveLength(6);
    expect(sc.steps.filter((s) => s.sweep)).toHaveLength(2);
  });
});
