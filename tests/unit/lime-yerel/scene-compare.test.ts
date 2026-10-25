// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BINS, CUSTOMERS, FEATURES, LIME_ALL, MODEL, customerByRow } from '../../../src/concepts/xai/data';
import { go, num, setup, texts, themeFonts } from './harness';

const f3 = (v: number) => f(v, 3);
const signed = (v: number) => (v > 0 ? `+${f3(v)}` : f3(v));
const hidden = (e: Element | null) => e!.closest('[hidden]') !== null || e!.hasAttribute('hidden');

describe('compare scene', () => {
  it('step 9 book customer agrees', () => {
    const { el, player } = setup();
    go(player, 'shap-lime', false);
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('compare');
    expect(player.state.params.scan).toBe(1);
    // the book's kod06 table: rank, SHAP feature, LIME rule, in the same order
    const rows = [...el.querySelectorAll('.compare-row')];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.querySelector('.compare-shap-name')!.textContent)).toEqual([...FEATURES]);
    expect(rows.map((r) => r.querySelector('.compare-rule')!.textContent)).toEqual([
      'tenure > 41.25',
      '39.87 < MonthlyCharges <= 51.59',
      '2294.79 < TotalCharges <= 2474.31',
    ]);
    expect(hidden(el.querySelector('.compare-table'))).toBe(false);
    const badge = el.querySelector('.agree-badge')!;
    expect(badge.getAttribute('data-agree')).toBe('true');
    expect(badge.textContent).toContain('tenure');
    expect(el.querySelector('.compare-counter')!.textContent).toBe(
      `${CUSTOMERS.length} müşterinin ${MODEL.topDisagree} tanesinde en etkili özellik farklı`,
    );
    expect(el.querySelector('.formula')!.textContent).toContain('müşteri 301');
    expect(el.querySelector('.compare-scene')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('step 9 flags the disagreement on customer 77', () => {
    const { el, player } = setup();
    go(player, 'shap-lime');
    const c = customerByRow(77);
    const fit = LIME_ALL.find((r) => r.row === 77)!.fit;
    expect(hidden(el.querySelector('.compare-table'))).toBe(true);
    const badge = el.querySelector('.agree-badge')!;
    expect(badge.getAttribute('data-agree')).toBe('false');
    expect(badge.textContent).toContain('SHAP MonthlyCharges');
    expect(badge.textContent).toContain('LIME tenure');
    expect(el.querySelector('.compare-model')!.textContent).toBe(f3(c.p));
    expect(el.querySelector('.compare-local')!.textContent).toBe(f3(fit.localPred));
    expect(el.querySelector('.compare-model')!.textContent).toBe('0,055');
    expect(el.querySelector('.compare-local')!.textContent).toBe('0,602');
    // left panel: SHAP force bar with the three contributions; right panel: the LIME coefficients
    const segs = [...el.querySelectorAll('.compare-shap-plot .wf-seg')];
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.getAttribute('data-sign'))).toEqual(c.shap.map((v) => (v >= 0 ? 'pos' : 'neg')));
    expect(texts(el, '.compare-shap-plot .wf-label')).toContain(`MonthlyCharges ${signed(c.shap[1])}`);
    expect(texts(el, '.compare-bar .bar-value')).toEqual(fit.coef.map(signed));
    expect(texts(el, '.compare-bar .bar-value')[0]).toBe('+0,472');
    expect(texts(el, '.compare-lime-plot text.rule-name')).toEqual([0, 1, 2].map((j) => BINS.names[j][LIME_ALL.find((r) => r.row === 77)!.bins[j]]));
    expect(el.querySelector('.compare-note')!.textContent).toContain('modeli hatalı yapmaz');
    expect(el.querySelector('.compare-scene')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('the badge follows the chosen customer', () => {
    const { el, player } = setup();
    go(player, 'shap-lime');
    // every test customer draws two panels and a badge that agrees with the data
    for (const c of CUSTOMERS.slice(0, 12)) {
      player.setParams({ compare: c.row });
      const fit = LIME_ALL.find((r) => r.row === c.row)!.fit;
      const top = (v: number[]) => v.map(Math.abs).indexOf(Math.max(...v.map(Math.abs)));
      expect(el.querySelector('.agree-badge')!.getAttribute('data-agree'), `customer ${c.row}`).toBe(String(top(c.shap) === top(fit.coef)));
      expect(el.querySelectorAll('.compare-bar')).toHaveLength(3);
      expect(el.querySelector('.compare-scene')!.innerHTML).not.toMatch(/NaN|Infinity/);
    }
  });

  it('both stages fit the stage at 390 and 1280 px', () => {
    for (const [w, h, font] of [
      [390, 450, 'narrow'],
      [1280, 540, 'wide'],
    ] as const) {
      themeFonts(font);
      const { el, player } = setup(w, h, font === 'wide' ? 'ders' : 'lab');
      for (const finish of [false, true]) {
        go(player, 'shap-lime', finish);
        if (finish) {
          player.setParams({ compare: 217 });
        }
        const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
        const used = Number(el.querySelector('.compare-scene')!.getAttribute('data-used'));
        expect(used, `${w} ${finish}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
        for (const svg of el.querySelectorAll('.compare-shap-plot, .compare-lime-plot')) {
          expect(num(svg, 'width')).toBeLessThanOrEqual(w);
        }
      }
    }
  });
});
