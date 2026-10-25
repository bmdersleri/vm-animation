// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BINS, limeRun } from '../../../src/concepts/xai/data';
import { go, num, setup, texts, themeFonts } from './harness';

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

  it('negative bars grow left of the zero line, positive ones right', () => {
    const { el, player } = setup();
    go(player, 'vekil');
    const zx = num(el.querySelector('.lime-zero')!, 'x1');
    const [tenure, monthly, total] = [...el.querySelectorAll('.lime-bar rect.bar')];
    expect(num(tenure, 'x')).toBeCloseTo(zx, 0);
    expect(num(monthly, 'x')).toBeCloseTo(zx, 0);
    expect(num(total, 'x') + num(total, 'width')).toBeCloseTo(zx, 0);
    expect(num(total, 'x')).toBeLessThan(zx);
    // one scale for both directions: the widths keep the ratio of the coefficients
    expect(num(tenure, 'width') / num(total, 'width')).toBeCloseTo(run.fit.coef[0] / -run.fit.coef[2], 0);
    // the negative label sits left of its bar, the positive one right of its bar end
    const values = [...el.querySelectorAll('.lime-bar text.bar-value')];
    expect(num(values[2], 'x')).toBeLessThan(num(total, 'x'));
    expect(num(values[0], 'x')).toBeGreaterThan(num(tenure, 'x') + num(tenure, 'width'));
  });

  it('bars and labels stay inside the svg at 390 and 1280 px', () => {
    for (const [w, h] of [
      [390, 470],
      [1280, 540],
    ]) {
      const { el, player } = setup(w, h, 'lab');
      for (const id of ['vekil', 'sadakat']) {
        go(player, id);
        const svg = el.querySelector('.lime-plot')!;
        const width = num(svg, 'width');
        expect(width).toBeLessThanOrEqual(w);
        // a value text is about as wide as "+0,000" at the 13 px fallback font
        const textW = 6 * 0.62 * 13;
        for (const b of el.querySelectorAll('.lime-bar rect.bar')) {
          expect(num(b, 'x')).toBeGreaterThanOrEqual(0);
          expect(num(b, 'x') + num(b, 'width')).toBeLessThanOrEqual(width);
        }
        for (const t of el.querySelectorAll('.lime-bar text.bar-value')) {
          const x = num(t, 'x');
          const end = t.getAttribute('text-anchor') === 'end';
          expect(end ? x - textW : x).toBeGreaterThanOrEqual(0);
          expect(end ? x : x + textW).toBeLessThanOrEqual(width);
        }
        expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it('steps 8-10 render a quiet placeholder', () => {
    const { el, player } = setup();
    for (const id of ['kararlilik', 'shap-lime', 'hata-ayiklama']) {
      go(player, id);
      expect(el.querySelectorAll('.lime-host:not([hidden])')).toHaveLength(1);
      expect(el.querySelector('.lime-wait')).not.toBeNull();
    }
  });

  it('the zero line is drawn per bar and crosses no rule name or value label', () => {
    for (const [w, h, font] of [
      [1280, 540, 'wide'],
      [390, 450, 'narrow'],
    ] as const) {
      themeFonts(font);
      const { el, player } = setup(w, h, font === 'wide' ? 'ders' : 'lab');
      for (const id of ['vekil', 'sadakat']) {
        go(player, id);
        const zeros = [...el.querySelectorAll('.lime-zero')];
        expect(zeros).toHaveLength(3);
        const fs = font === 'wide' ? 18 : 13;
        const boxes = [...el.querySelectorAll('text.rule-name tspan')].map((t) => ({
          x0: num(t, 'x'),
          x1: num(t, 'x') + t.textContent!.length * 0.62 * fs,
          y0: num(t, 'y') - fs * 0.8,
          y1: num(t, 'y') + fs * 0.25,
        }));
        for (const v of el.querySelectorAll('.lime-bar text.bar-value')) {
          const x = num(v, 'x');
          const wText = v.textContent!.length * 0.62 * fs;
          const end = v.getAttribute('text-anchor') === 'end';
          const y = num(v.parentElement!.querySelector('rect.bar')!, 'height') / 2;
          const top = Number(/translate\(0,([\d.]+)\)/.exec(v.parentElement!.getAttribute('transform') ?? '')![1]);
          boxes.push({ x0: end ? x - wText : x, x1: end ? x : x + wText, y0: top + y - fs * 0.6, y1: top + y + fs * 0.6 });
        }
        for (const z of zeros) {
          const x = num(z, 'x1');
          const y0 = num(z, 'y1');
          const y1 = num(z, 'y2');
          for (const b of boxes) {
            const crossesX = x >= b.x0 && x <= b.x1;
            const crossesY = y0 < b.y1 && y1 > b.y0;
            expect(crossesX && crossesY, `${id} ${w}: zero ${x} ${y0}-${y1} vs ${JSON.stringify(b)}`).toBe(false);
          }
        }
      }
    }
  });
});
