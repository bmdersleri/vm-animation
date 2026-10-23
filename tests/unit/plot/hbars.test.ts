// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { HBarsLayer, type HBar, type HBarsOptions } from '../../../src/core/plot/hbars';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';

function setup() {
  const svg = document.createElementNS(NS, 'svg');
  document.body.append(svg);
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  const g = select(svg).append('g');
  return { svg, layer: new HBarsLayer(g, new TextMeasure(probe)) };
}

afterEach(() => document.body.replaceChildren());

const bars: HBar[] = [
  { id: 'a', row: 0, slot: 0, cls: 'x', value: 5, text: '5', label: 'a' },
  { id: 'b', row: 1, slot: 0, cls: 'x', value: 10, text: '10', label: 'b' },
];
const opts = (max: number): HBarsOptions => ({
  rect: { x: 0, y: 0, w: 400, h: 100 },
  tick: 13,
  rows: 2,
  slots: 1,
  max,
  itemCls: 'item',
  ms: 0,
});

describe('HBarsLayer', () => {
  it('scales bars to max', () => {
    const { svg, layer } = setup();
    const geo = layer.draw(bars, opts(10));
    const w = [...svg.querySelectorAll('g.item rect.bar')].map((r) => Number(r.getAttribute('width')));
    expect(w).toHaveLength(2);
    expect(w[1]).toBeGreaterThan(w[0]);
    expect(w[1]).toBeCloseTo(geo.xOf(10) - geo.x0, 0);
    expect(w[0]).toBeCloseTo((geo.xOf(10) - geo.x0) / 2, 0);
  });

  it('max 0 draws finite minimal bars', () => {
    const { svg, layer } = setup();
    const geo = layer.draw(bars, opts(0));
    expect(Number.isFinite(geo.xOf(5))).toBe(true);
    expect(geo.xOf(5)).toBe(geo.x0);
    for (const r of svg.querySelectorAll('g.item rect.bar')) {
      expect(Number.isFinite(Number(r.getAttribute('width')))).toBe(true);
    }
    expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
