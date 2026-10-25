// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '../svg-stubs';
import { WaterfallLayer, type WaterfallSpec } from '../../../src/core/plot/waterfall';

const NS = 'http://www.w3.org/2000/svg';
const BOX = { x: 0, y: 0, w: 600, h: 260 };

function setup() {
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  return { svg, layer: new WaterfallLayer(g) };
}

afterEach(() => document.body.replaceChildren());

const parts = [
  { id: 'a', label: 'tenure', value: 0.5 },
  { id: 'b', label: 'MonthlyCharges', value: -0.2 },
  { id: 'c', label: 'TotalCharges', value: 0.1 },
];
const spec = (over: Partial<WaterfallSpec> = {}): WaterfallSpec => ({
  base: 0.25,
  parts,
  total: 0.65,
  domain: [0, 1],
  mode: 'waterfall',
  ...over,
});
const seg = (svg: Element, id: string): Element => svg.querySelector(`.wf-seg[data-id="${id}"]`)!;

describe('WaterfallLayer', () => {
  it('segments chain from base to total', () => {
    const { svg, layer } = setup();
    layer.update(spec(), BOX, false);
    const segs = [...svg.querySelectorAll('.wf-seg')];
    expect(segs).toHaveLength(3);
    const start = segs.map((s) => Number(s.getAttribute('data-start')));
    const end = segs.map((s) => Number(s.getAttribute('data-end')));
    expect(start[0]).toBeCloseTo(0.25, 9);
    expect(end[2]).toBeCloseTo(0.65, 9);
    expect(start[1]).toBeCloseTo(end[0], 9);
    expect(start[2]).toBeCloseTo(end[1], 9);
    expect(svg.querySelector('.wf-base')).not.toBeNull();
    expect(svg.querySelector('.wf-total')).not.toBeNull();
    expect(svg.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('signs set the colour class', () => {
    const { svg, layer } = setup();
    layer.update(spec(), BOX, false);
    expect(seg(svg, 'a').getAttribute('data-sign')).toBe('pos');
    expect(seg(svg, 'b').getAttribute('data-sign')).toBe('neg');
    expect(seg(svg, 'c').getAttribute('data-sign')).toBe('pos');
    const text = (id: string) => svg.querySelector(`.wf-label[data-id="${id}"]`)!.textContent;
    expect(text('a')).toBe('+0,500');
    expect(text('b')).toBe('−0,200');
  });

  it('tiny segment keeps its label', () => {
    const { svg, layer } = setup();
    const tiny = [{ id: 'a', label: 'tenure', value: 0.003 }, { id: 'b', label: 'MonthlyCharges', value: 0.4 }];
    layer.update(spec({ parts: tiny, total: 0.653 }), BOX, false);
    const s = seg(svg, 'a');
    expect(s.getAttribute('data-tiny')).toBe('true');
    expect(s.getAttribute('d')).toMatch(/^M[\d.]+,[\d.]+L/);
    const label = svg.querySelector('.wf-label[data-id="a"]')!;
    expect(label.textContent).toBe('+0,003');
    expect(Number(label.getAttribute('x'))).toBeGreaterThanOrEqual(0);
    expect(Number(label.getAttribute('x'))).toBeLessThanOrEqual(BOX.w);
  });

  it('force mode stacks positives left of the total and negatives right of it', () => {
    const { svg, layer } = setup();
    const used = layer.update(spec({ mode: 'force', domain: [0, 1] }), BOX, false);
    const lo = (id: string) => Math.min(Number(seg(svg, id).getAttribute('data-start')), Number(seg(svg, id).getAttribute('data-end')));
    const hi = (id: string) => Math.max(Number(seg(svg, id).getAttribute('data-start')), Number(seg(svg, id).getAttribute('data-end')));
    expect(hi('a')).toBeCloseTo(0.65, 9);
    expect(hi('c')).toBeCloseTo(lo('a'), 9);
    expect(lo('b')).toBeCloseTo(0.65, 9);
    expect(hi('b')).toBeCloseTo(0.85, 9);
    expect(svg.querySelector('.wf-base-line')).not.toBeNull();
    expect(Number.isFinite(used)).toBe(true);
    expect(svg.querySelectorAll('.wf-name')).toHaveLength(0);
  });

  it('force labels clear the bar band and the base label does not sit on a segment', () => {
    const { svg, layer } = setup();
    layer.update(spec({ mode: 'force', domain: [0, 1] }), BOX, false);
    const ys = [...svg.querySelectorAll('.wf-seg')].flatMap((s) => (s.getAttribute('d') ?? '').match(/,(-?\d+(?:\.\d+)?)/g)!.map((m) => Number(m.slice(1))));
    const top = Math.min(...ys);
    const bot = Math.max(...ys);
    const text = 13;
    for (const l of svg.querySelectorAll('.wf-label')) {
      const y = Number(l.getAttribute('y'));
      const up = y < top;
      // half a text height plus a clear gap between the glyphs and the bar
      expect(up ? top - (y + text / 2) : y - text / 2 - bot, l.textContent!).toBeGreaterThanOrEqual(5);
    }
  });
  it('base and total bars start at 0 when the domain starts below 0, and at the axis start when it starts above 0', () => {
    const { svg, layer } = setup();
    const num = (sel: string, a: string): number => Number(svg.querySelector(sel)!.getAttribute(a));
    // a walk that dips below 0 widens the domain to -0.1; the value bars still start at 0
    layer.update(spec({ domain: [-0.1, 1] }), BOX, false);
    const xBase = num('.wf-base-line', 'x1');
    const xTotal = num('.wf-total-line', 'x1');
    const perUnit = (xTotal - xBase) / (0.65 - 0.25);
    const x0 = xBase - 0.25 * perUnit;
    expect(num('rect.wf-start', 'x')).toBeCloseTo(x0, 0);
    expect(num('rect.wf-total-bar', 'x')).toBeCloseTo(x0, 0);
    expect(num('rect.wf-start', 'x') + num('rect.wf-start', 'width')).toBeCloseTo(xBase, 0);
    expect(num('rect.wf-total-bar', 'x') + num('rect.wf-total-bar', 'width')).toBeCloseTo(xTotal, 0);
    // a domain that starts above 0 clamps the bar start to the axis start
    layer.update(spec({ domain: [0.1, 1] }), BOX, false);
    const xb = num('.wf-base-line', 'x1');
    const xt = num('.wf-total-line', 'x1');
    const x01 = xb - (0.25 - 0.1) * ((xt - xb) / (0.65 - 0.25));
    expect(num('rect.wf-start', 'x')).toBeCloseTo(x01, 0);
  });
});
