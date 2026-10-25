// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { MODEL, customerByRow } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const f3 = (v: number) => f(v, 3);
const signed = (v: number) => (v > 0 ? `+${f3(v)}` : f3(v));

describe('force scene', () => {
  it('step 6 waterfall ends at p', () => {
    const { el, player } = setup();
    go(player, 'toplam');
    const c = customerByRow(301);
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('waterfall');
    const segs = [...el.querySelectorAll('.wf-seg')];
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.getAttribute('data-sign'))).toEqual(['pos', 'pos', 'pos']);
    expect(num(segs[0], 'data-start')).toBeCloseTo(MODEL.base, 6);
    expect(num(segs[2], 'data-end')).toBeCloseTo(c.p, 6);
    expect(texts(el, '.wf-label')).toEqual([f3(MODEL.base), ...c.shap.map(signed), f3(c.p)]);
    expect(el.querySelector('.formula')!.textContent).toContain('φ₀ + Σ φ = p');
  });

  it('step 7 draws two force bars with negative segments', () => {
    const { el, player } = setup();
    go(player, 'kuvvet');
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('force');
    const bars = [...el.querySelectorAll('.force-bar')];
    expect(bars.map((b) => b.getAttribute('data-row'))).toEqual(['0', '1']);
    expect(bars[0].querySelectorAll('.wf-seg[data-sign="neg"]')).toHaveLength(0);
    expect(bars[0].querySelectorAll('.wf-seg[data-sign="pos"]')).toHaveLength(3);
    expect(bars[1].querySelectorAll('.wf-seg[data-sign="neg"]')).toHaveLength(2);
    expect(bars[1].querySelectorAll('.wf-seg[data-sign="pos"]')).toHaveLength(1);
    // one shared axis and a base line per bar
    expect(el.querySelectorAll('.wf-axis-line')).toHaveLength(1);
    expect(el.querySelectorAll('.wf-base-line')).toHaveLength(2);
    const second = bars[1].textContent ?? '';
    expect(second).toContain('MonthlyCharges −0,273');
    expect(second).toContain('tenure +0,200');
    player.setParam('second', 217);
    expect([...el.querySelectorAll('.force-bar')][1].textContent).toContain('Müşteri 217');
  });

  it('force bars stay inside the axis for p near zero', () => {
    const { el, player } = setup(1280, 540);
    go(player, 'kuvvet');
    player.setParams({ customer: 176, second: 176 });
    const c = customerByRow(176);
    expect(c.p).toBeLessThan(1e-9);
    const width = num(el.querySelector('.force-plot')!, 'width');
    for (const s of el.querySelectorAll('.wf-seg')) {
      const lo = Math.min(num(s, 'data-start'), num(s, 'data-end'));
      const hi = Math.max(num(s, 'data-start'), num(s, 'data-end'));
      expect(lo).toBeGreaterThanOrEqual(-1e-9);
      expect(hi).toBeLessThanOrEqual(1 + 1e-9);
      const xs = (s.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?(?=,)/g)!.map(Number);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(width);
    }
    expect(el.querySelector('.force-plot')!.innerHTML).not.toMatch(/NaN|Infinity/);
    // every label stays inside the plot, too
    for (const t of el.querySelectorAll('.force-plot .wf-label')) {
      expect(num(t, 'x')).toBeGreaterThanOrEqual(0);
      expect(num(t, 'x')).toBeLessThanOrEqual(width);
    }
  });
});
