// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BINS, CLOUD } from '../../../src/concepts/xai/data';
import { limeYerelScenario as sc } from '../../../src/concepts/lime-yerel/scenario';
import { deriveLimeView } from '../../../src/concepts/lime-yerel/view';
import { go, setup, texts } from './harness';

describe('cloud domain and room', () => {
  it('the axis domain comes from the drawn data with a small margin', () => {
    const cloud = CLOUD[301];
    const xs = [...cloud.values.map((v) => v[0]), ...BINS.cuts[0], 51];
    const ys = [...cloud.values.map((v) => v[1]), ...BINS.cuts[1], 51.06];
    const view = deriveLimeView(3, sc.defaults).cloud!;
    for (const [domain, vs] of [
      [view.domainX, xs],
      [view.domainY, ys],
    ] as const) {
      const lo = Math.min(...vs);
      const hi = Math.max(...vs);
      const span = hi - lo;
      expect(domain[0]).toBeLessThanOrEqual(lo);
      expect(domain[1]).toBeGreaterThanOrEqual(hi);
      expect(lo - domain[0]).toBeLessThanOrEqual(span * 0.06);
      expect(domain[1] - hi).toBeLessThanOrEqual(span * 0.06);
      expect(domain[0]).toBeGreaterThanOrEqual(0);
    }
  });

  it('no axis tick is negative at either width', () => {
    for (const [w, h] of [
      [1280, 540],
      [390, 470],
    ]) {
      const { el, player } = setup(w, h, 'lab');
      go(player, 'ikili');
      const ticks = texts(el, '.cloud-axes .tick text');
      expect(ticks.length).toBeGreaterThan(3);
      for (const t of ticks) {
        expect(t).not.toContain('−');
      }
    }
  });

  it('the note and legend fit the stage at 1280 px', () => {
    const { el, player } = setup(1280, 540, 'ders');
    go(player, 'ikili');
    const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
    const used = Number(el.querySelector('.cloud-scene')!.getAttribute('data-used'));
    expect(used).toBeLessThanOrEqual(avail);
    expect(el.querySelector('.cloud-note')!.hasAttribute('hidden')).toBe(false);
  });
});
