// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { CURVES, REFERENCE, monthOf } from '../../../src/concepts/model-kaymasi/data';
import { go, num, setup, texts } from './harness';

const sum = (el: Element, sel: string, a: string): number => [...el.querySelectorAll(sel)].reduce((s, e) => s + num(e, a), 0);

describe('drift panels (steps 4 and 7)', () => {
  it('step 4 shifts the histogram in one panel and turns the curve in the other', () => {
    const { el, player } = setup();
    go(player, 'veri-kavram');
    const panels = [...el.querySelectorAll('.drift-panel')];
    expect(panels.map((p) => p.getAttribute('data-scenario'))).toEqual(['ani', 'kavram']);
    const [ani, kavram] = panels;
    // the histogram mass moves in the data-shift panel (current bars sit right of the reference bars) and stays in the other
    const centre = (p: Element, cls: string): number => {
      const bars = [...p.querySelectorAll(`.${cls}`)];
      const total = bars.reduce((s, b) => s + num(b, 'data-share'), 0);
      return bars.reduce((s, b) => s + num(b, 'data-share') * num(b, 'data-bin'), 0) / total;
    };
    expect(centre(ani, 'hist-cur') - centre(ani, 'hist-ref')).toBeGreaterThan(2);
    expect(Math.abs(centre(kavram, 'hist-cur') - centre(kavram, 'hist-ref'))).toBeLessThan(0.7);
    // the curve keeps its coefficient in one panel and turns in the other
    const coef = (p: Element, cls: string): number => num(p.querySelector(`.${cls}`)!, 'data-coef');
    expect(coef(ani, 'curve-ref')).toBe(REFERENCE.coef);
    expect(coef(ani, 'curve-refit')).toBe(CURVES.ani.coef);
    expect(coef(kavram, 'curve-refit')).toBe(CURVES.kavram.coef);
    expect(coef(kavram, 'curve-refit')).toBeLessThan(0);
    expect(texts(ani, '.drift-title')[0].toLowerCase()).toContain('veri kayması: p(x) değişti');
    expect(texts(kavram, '.drift-title')[0].toLowerCase()).toContain('kavram kayması: p(y | x) değişti');
    // the scenario's name is the verdict: the title does not say it twice
    expect(texts(kavram, '.drift-title')[0].toLowerCase().split('kavram kayması')).toHaveLength(2);
    expect(el.querySelector('.drift-legend')!.textContent).toContain(f(REFERENCE.coef, 3));
  });

  it('the Lab draws the chosen scenario in one panel', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'veri-kavram');
    player.setParams({ scenario: 0 });
    const panels = el.querySelectorAll('.drift-panel');
    expect(panels).toHaveLength(1);
    expect(panels[0].getAttribute('data-scenario')).toBe('yok');
    expect(texts(el, '.drift-title')[0].toLowerCase()).toContain('kayma yok');
  });

  it('step 7 mean difference stays small while std grows', () => {
    const { el, player } = setup();
    go(player, 'ortalama-yaniltir');
    const m = monthOf('yayilim', 18);
    const diff = el.querySelector('.stat-box[data-stat="diff"]')!.textContent!;
    const std = el.querySelector('.stat-box[data-stat="std"]')!.textContent!;
    expect(diff).toContain(f(m.diff, 2));
    expect(std).toContain(`${f(REFERENCE.std, 2)} → ${f(m.std, 2)}`);
    expect(m.diff).toBeLessThan(1);
    expect(m.std).toBeGreaterThan(1.5 * REFERENCE.std);
    // two histograms, 22 bins each, shares summing to 1
    expect(el.querySelectorAll('.hist-ref')).toHaveLength(22);
    expect(el.querySelectorAll('.hist-cur')).toHaveLength(22);
    expect(sum(el, '.hist-ref', 'data-share')).toBeCloseTo(1, 6);
    expect(sum(el, '.hist-cur', 'data-share')).toBeCloseTo(1, 6);
  });
});
