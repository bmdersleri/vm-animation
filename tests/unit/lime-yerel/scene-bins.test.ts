// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BINS, limeRun } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const run = limeRun(301, 42, 5000);

describe('bins scene', () => {
  it('step 2 marks the customer bins', () => {
    const { el, player } = setup();
    go(player, 'kartil');
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('bins');
    expect(el.querySelectorAll('.number-line')).toHaveLength(3);
    expect(el.querySelectorAll('.bin-cut')).toHaveLength(9);
    expect(el.querySelectorAll('.bin-band')).toHaveLength(12);
    const active = [...el.querySelectorAll('.bin-active')];
    expect(active).toHaveLength(3);
    expect(active.map((a) => a.getAttribute('data-name'))).toEqual([0, 1, 2].map((j) => BINS.names[j][run.bins[j]]));
    expect(texts(el, '.bin-name')).toEqual(active.map((a) => a.getAttribute('data-name')));
    expect(texts(el, '.bin-cut-label')).toEqual(['17', '28', '41,25', '39,87', '51,59', '59,36', '2294,79', '2474,31', '2714,64']);
    expect(el.querySelectorAll('.bin-value')).toHaveLength(3);
    expect(el.querySelector('.bins-plot')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('every mark lies inside the svg at 1280 and 390 px', () => {
    for (const [w, h] of [
      [1280, 540],
      [390, 700],
    ]) {
      const { el, player } = setup(w, h);
      go(player, 'kartil');
      const svg = el.querySelector('.bins-plot')!;
      const width = num(svg, 'width');
      expect(width).toBeLessThanOrEqual(w);
      for (const c of el.querySelectorAll('.bin-cut line')) {
        expect(num(c, 'x1')).toBeGreaterThan(0);
        expect(num(c, 'x1')).toBeLessThan(width);
      }
      for (const c of el.querySelectorAll('.bin-value')) {
        expect(num(c, 'cx')).toBeGreaterThan(0);
        expect(num(c, 'cx')).toBeLessThan(width);
      }
      for (const b of el.querySelectorAll('.bin-band')) {
        expect(num(b, 'x') + num(b, 'width')).toBeLessThanOrEqual(width);
      }
    }
  });
});
