// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BINS, limeRun } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const run = limeRun(301, 42, 5000);

describe('surrogate scene', () => {
  it('step 6 bars read the book weights', () => {
    const { el, player } = setup();
    go(player, 'vekil');
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('surrogate');
    const bars = [...el.querySelectorAll('.lime-bar')];
    expect(bars).toHaveLength(3);
    expect(texts(el, '.lime-bar .bar-value')).toEqual(['+0,540', '+0,074', '−0,023']);
    expect(bars.map((b) => b.classList.contains('is-pos'))).toEqual([true, true, false]);
    expect(bars.map((b) => b.classList.contains('is-neg'))).toEqual([false, false, true]);
    expect(texts(el, 'text.rule-name')).toEqual([0, 1, 2].map((j) => BINS.names[j][run.bins[j]]));
    expect(el.querySelector('.intercept-value')!.textContent).toBe('0,146');
    expect(el.querySelector('.fidelity-panel')!.hasAttribute('hidden')).toBe(true);
    const w = bars.map((b) => num(b.querySelector('rect.bar')!, 'width'));
    expect(w[0]).toBeGreaterThan(w[1]);
    expect(w[1]).toBeGreaterThan(w[2]);
  });

  it('step 7 shows surrogate and model', () => {
    const { el, player } = setup();
    go(player, 'sadakat');
    expect(el.querySelectorAll('.lime-bar')).toHaveLength(3);
    expect(el.querySelector('.fidelity-panel')!.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('.fidelity-model')!.textContent).toBe('0,945');
    expect(el.querySelector('.fidelity-local')!.textContent).toBe(f(run.fit.localPred, 3));
    expect(el.querySelector('.fidelity-r2')!.textContent).toBe(f(run.fit.score!, 3));
    expect(el.querySelector('.formula')!.textContent).toContain('0,146 + 0,540 + 0,074 − 0,023 = 0,737');
  });

  it('surrogate panel fits 390 px', () => {
    const { el, player } = setup(390, 700);
    go(player, 'sadakat');
    const svg = el.querySelector('.lime-plot')!;
    expect(num(svg, 'width')).toBeLessThanOrEqual(390);
    for (const b of el.querySelectorAll('.lime-bar rect.bar')) {
      expect(num(b, 'x') + num(b, 'width')).toBeLessThanOrEqual(num(svg, 'width'));
    }
    for (const t of el.querySelectorAll('text.rule-name tspan')) {
      expect(num(t, 'x')).toBeGreaterThanOrEqual(0);
      expect(num(t, 'y')).toBeGreaterThan(0);
      expect(t.textContent!.length * 0.62 * 13).toBeLessThanOrEqual(num(svg, 'width') + 80);
    }
    expect(num(svg, 'height')).toBeGreaterThan(0);
    expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('steps 8-10 render a quiet placeholder', () => {
    const { el, player } = setup();
    for (const id of ['kararlilik', 'shap-lime', 'hata-ayiklama']) {
      go(player, id);
      expect(el.querySelectorAll('.lime-host:not([hidden])')).toHaveLength(1);
      expect(el.querySelector('.lime-wait')).not.toBeNull();
    }
  });
});
