// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { limeRun } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const run = limeRun(301, 42, 5000);

describe('cloud scene', () => {
  it('step 3 draws five hundred dots', () => {
    const { el, player } = setup();
    go(player, 'komsuluk');
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('cloud');
    expect(el.querySelectorAll('.cloud-dot')).toHaveLength(500);
    expect(el.querySelectorAll('.cloud-star')).toHaveLength(1);
    expect(el.querySelectorAll('.bin-grid')).toHaveLength(6);
    const fills = new Set([...el.querySelectorAll('.cloud-dot')].map((d) => d.getAttribute('fill')));
    expect(fills.size).toBe(1);
    expect(el.querySelector('.pattern-wrap')!.hasAttribute('hidden')).toBe(true);
    expect(el.querySelector('.cloud-plot')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('step 3 sweep brings the dots in groups', () => {
    const { el, player } = setup();
    go(player, 'komsuluk', false);
    player.setParams({ scan: 1 });
    expect(el.querySelectorAll('.cloud-dot')).toHaveLength(100);
    player.setParams({ scan: 3 });
    expect(el.querySelectorAll('.cloud-dot')).toHaveLength(300);
  });

  it('every dot lies inside the plot at 1280 and 390 px', () => {
    for (const [w, h] of [
      [1280, 540],
      [390, 700],
    ]) {
      const { el, player } = setup(w, h);
      go(player, 'ikili');
      const svg = el.querySelector('.cloud-plot')!;
      const frame = el.querySelector('.frame')!;
      const l = num(frame, 'x');
      const t = num(frame, 'y');
      const r = l + num(frame, 'width');
      const b = t + num(frame, 'height');
      expect(num(svg, 'width')).toBeLessThanOrEqual(w);
      for (const d of el.querySelectorAll('.cloud-dot')) {
        expect(num(d, 'cx')).toBeGreaterThanOrEqual(l);
        expect(num(d, 'cx')).toBeLessThanOrEqual(r);
        expect(num(d, 'cy')).toBeGreaterThanOrEqual(t);
        expect(num(d, 'cy')).toBeLessThanOrEqual(b);
      }
    }
  });

  it('step 4 tabulates eight patterns', () => {
    const { el, player } = setup();
    go(player, 'ikili');
    const rows = [...el.querySelectorAll('.pattern-row')];
    expect(rows).toHaveLength(8);
    expect(rows[0].getAttribute('data-mask')).toBe('7');
    expect(texts(rows[0], '.pattern-mark')).toEqual(['✓', '✓', '✓']);
    expect(texts(rows[0], '.pattern-n')).toEqual([f(run.patterns[7].n, 0)]);
    expect(texts(rows[0], '.pattern-mean')).toEqual([f(run.patterns[7].mean, 3)]);
    expect(texts(rows[7], '.pattern-mark')).toEqual(['✗', '✗', '✗']);
    expect(el.querySelectorAll('.pattern-weight')).toHaveLength(0);
    const fills = new Set([...el.querySelectorAll('.cloud-dot')].map((d) => d.getAttribute('fill')));
    expect(fills.size).toBeGreaterThan(20);
    for (const fill of fills) {
      expect(fill).not.toMatch(/224,\s*123,\s*0|47,\s*111,\s*178/);
    }
    expect(el.querySelector('.cloud-star')).not.toBeNull();
    expect(el.querySelector('.cloud-legend')!.hasAttribute('hidden')).toBe(false);
  });
});
