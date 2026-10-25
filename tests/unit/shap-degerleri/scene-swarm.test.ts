// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { CUSTOMERS } from '../../../src/concepts/xai/data';
import { tenureCorrelation } from '../../../src/concepts/shap-degerleri/calc';
import { formatNumber as f } from '../../../src/core/plot/format';
import { go, num, setup } from './harness';

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

describe('swarm scene', () => {
  it('step 9 draws three hundred dots', () => {
    const { el, player } = setup();
    go(player, 'ozet-grafik');
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('swarm');
    expect(el.querySelectorAll('.swarm-row')).toHaveLength(3);
    expect(el.querySelectorAll('.swarm-dot')).toHaveLength(3 * CUSTOMERS.length);
    for (const row of el.querySelectorAll('.swarm-row')) {
      expect(row.querySelectorAll('.swarm-dot')).toHaveLength(CUSTOMERS.length);
    }
    expect(el.querySelectorAll('.swarm-dot.is-highlight')).toHaveLength(3);
    expect(el.querySelector('.swarm-zero')).not.toBeNull();
    expect(el.querySelector('.swarm-legend')).not.toBeNull();
    expect(el.querySelector('.swarm-note')!.textContent).toContain(`korelasyon ${f(tenureCorrelation(), 2)}`);
    expect(el.querySelector('.swarm-note')!.textContent).toContain('bu veride tersi görülür');
    expect(el.querySelector('.swarm-plot')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('high tenure sits right', () => {
    const { el, player } = setup();
    go(player, 'ozet-grafik');
    const dots = [...el.querySelectorAll('.swarm-row[data-feature="0"] .swarm-dot')];
    const high = dots.filter((d) => num(d, 'data-t') >= 0.8).map((d) => num(d, 'cx'));
    const low = dots.filter((d) => num(d, 'data-t') <= 0.2).map((d) => num(d, 'cx'));
    expect(high.length).toBeGreaterThan(10);
    expect(mean(high)).toBeGreaterThan(mean(low));
  });

  it('dots keep off each other and the lab can recolour and ring a customer', () => {
    const { el, player } = setup();
    go(player, 'ozet-grafik');
    const dots = [...el.querySelectorAll('.swarm-row[data-feature="1"] .swarm-dot')];
    const r = num(dots[0], 'r');
    let close = 0;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = Math.hypot(num(dots[i], 'cx') - num(dots[j], 'cx'), num(dots[i], 'cy') - num(dots[j], 'cy'));
        if (d < r * 1.2) close += 1;
      }
    }
    expect(close).toBeLessThanOrEqual(3);
    const before = el.querySelector('.swarm-row[data-feature="0"] .swarm-dot')!.getAttribute('fill');
    player.setParam('colorBy', 1);
    expect(el.querySelector('.swarm-row[data-feature="0"] .swarm-dot')!.getAttribute('fill')).not.toBe(before);
    player.setParam('highlight', 77);
    expect(el.querySelector('.swarm-dot.is-highlight')!.getAttribute('data-row')).toBe('77');
  });
});
