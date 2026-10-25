// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { kernelWeight } from '../../../src/concepts/xai/lime';
import { KERNEL_WIDTH } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

describe('kernel scene', () => {
  it('step 5 kernel weights read 1, 0.744, 0.553, 0.411', () => {
    const { el, player } = setup();
    go(player, 'cekirdek');
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('kernel');
    const pts = [...el.querySelectorAll('.kernel-point')];
    expect(pts).toHaveLength(4);
    const want = [0, 1, Math.SQRT2, Math.sqrt(3)].map((d) => kernelWeight(d, KERNEL_WIDTH));
    pts.forEach((p, i) => {
      expect(num(p, 'data-w')).toBeCloseTo(want[i], 5);
    });
    expect(want.map((w) => Math.round(w * 1000) / 1000)).toEqual([1, 0.744, 0.553, 0.411]);
    expect(texts(el, '.kernel-weight')).toEqual(want.map((w) => f(w, 3)));
    expect(el.querySelectorAll('.pattern-row')).toHaveLength(8);
    expect(texts(el, '.pattern-weight')).toHaveLength(8);
    expect(el.querySelector('.formula')!.textContent).toContain('w = 1,299');
    expect(el.querySelector('.kernel-curve')).not.toBeNull();
  });

  it('narrow kernel shows no NaN', () => {
    const { el, player } = setup();
    go(player, 'cekirdek');
    for (const width of [0.3, 0.001]) {
      player.setParam('width', width);
      expect(el.querySelector('.lime-host:not([hidden])')!.innerHTML).not.toMatch(/NaN|Infinity/);
      expect(el.querySelector('.formula')!.textContent).not.toMatch(/NaN|Infinity/);
    }
    player.setParam('width', 0.3);
    expect(texts(el, '.kernel-weight')[0]).toBe('1,000');
    expect(texts(el, '.kernel-weight')[3]).toBe('0,000');
  });
});
