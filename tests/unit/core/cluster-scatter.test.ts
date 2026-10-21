// @vitest-environment jsdom
import '../svg-stubs';
import { describe, expect, it } from 'vitest';
import { ClusterScatterLayer, type ClusterScatterSpec } from '../../../src/core/plot/cluster-scatter';
import { CLUSTER, NEGATIVE, UNASSIGNED, WHITE } from '../../../src/core/plot/marks';

const NS = 'http://www.w3.org/2000/svg';
const PTS = [[0, 0], [1, 1], [-1, 2], [2, -1]] as const;

function setup(rect = { left: 10, top: 10, width: 400, height: 200 }) {
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  const layer = new ClusterScatterLayer(g, { x: [-3, 3], y: [-3, 3] });
  layer.resize(rect);
  return { svg, layer };
}
const spec = (o: Partial<ClusterScatterSpec> = {}): ClusterScatterSpec => ({ points: PTS, labels: null, centers: null, ...o });

describe('ClusterScatterLayer', () => {
  it('labels null paints all points unassigned', () => {
    const { svg, layer } = setup();
    layer.update(spec(), false);
    const c = [...svg.querySelectorAll('circle.cs-point')];
    expect(c).toHaveLength(4);
    for (const p of c) {
      expect(p.getAttribute('fill')).toBe(UNASSIGNED);
      expect(p.getAttribute('data-cluster')).toBe('-');
    }
  });

  it('labels paint CLUSTER colours and data-cluster', () => {
    const { svg, layer } = setup();
    layer.update(spec({ labels: [0, 1, 1, 2] }), false);
    const c = [...svg.querySelectorAll('circle.cs-point')];
    expect(c.map((p) => p.getAttribute('data-cluster'))).toEqual(['0', '1', '1', '2']);
    expect(c.map((p) => p.getAttribute('fill'))).toEqual([CLUSTER[0], CLUSTER[1], CLUSTER[1], CLUSTER[2]]);
  });

  it('centers draw one marker per centre with M labels', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0], [1, 1]], trails: [[-1, -1], [0, 0]] }), false);
    const cs = [...svg.querySelectorAll('g.cs-center')];
    expect(cs).toHaveLength(2);
    expect(cs.map((g) => g.querySelector('text')!.textContent)).toEqual(['M1', 'M2']);
    expect(cs[1].querySelector('path.cs-plus')!.getAttribute('stroke')).toBe(CLUSTER[1]);
    expect(svg.querySelectorAll('.cs-trail')).toHaveLength(2);
  });

  it('trails sit above the points, below rings and centres, with a white outline', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[1, 1]], trails: [[0, 0]] }), false);
    const order = [...svg.querySelector('.cs-layer')!.children].map((g) => g.getAttribute('class'));
    expect(order).toEqual(['cs-lines', 'cs-points', 'cs-trails', 'cs-rings', 'cs-centers']);
    const t = svg.querySelector('g.cs-trail')!;
    expect(Number(t.getAttribute('opacity'))).toBeCloseTo(0.75);
    const outline = t.querySelector('path.cs-trail-outline')!;
    expect(outline.getAttribute('stroke')).toBe(WHITE);
    expect(outline.getAttribute('stroke-width')).toBe('4');
    expect(outline.getAttribute('d')).toBe(t.querySelector('path.cs-trail-plus')!.getAttribute('d'));
    expect(outline.getAttribute('transform')).toBe(t.querySelector('path.cs-trail-plus')!.getAttribute('transform'));
    expect(t.querySelector('path.cs-trail-plus')!.getAttribute('d')).toBe('M-6,0H6M0,-6V6');
    expect(t.querySelector('path.cs-trail-arrow')!.getAttribute('stroke-width')).toBe('2');
  });

  it('lines mark only the nearest centre as data-nearest', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0], [1, 1], [2, 2]], lines: [{ point: 3, nearest: 1 }] }), false);
    const l = [...svg.querySelectorAll('line.cs-line')];
    expect(l).toHaveLength(3);
    const near = l.filter((e) => e.getAttribute('data-nearest') === 'true');
    expect(near).toHaveLength(1);
    expect(near[0].getAttribute('data-center')).toBe('1');
    expect(near[0].getAttribute('data-point')).toBe('3');
  });

  it('rings for negative and selected can coexist on one point', () => {
    const { svg, layer } = setup();
    layer.update(spec({ changed: [0], negative: [2], selected: 2 }), false);
    expect(svg.querySelectorAll('.cs-ring[data-kind="changed"][data-i="0"]')).toHaveLength(1);
    expect(svg.querySelectorAll('.cs-ring[data-kind="negative"][data-i="2"]')).toHaveLength(1);
    expect(svg.querySelectorAll('.cs-ring[data-kind="selected"][data-i="2"]')).toHaveLength(1);
    expect(svg.querySelector('.cs-ring[data-kind="negative"]')!.getAttribute('stroke')).toBe(NEGATIVE);
  });

  it('equal aspect: one data unit has the same pixel length on both axes', () => {
    const { svg, layer } = setup();
    layer.update(spec(), false);
    const [a, b, , d] = [...svg.querySelectorAll('circle.cs-point')].map((p) => [Number(p.getAttribute('cx')), Number(p.getAttribute('cy'))]);
    const ux = b[0] - a[0]; // +1 data unit in x
    const uy = a[1] - b[1]; // +1 data unit in y (y is inverted)
    expect(ux).toBeGreaterThan(0);
    expect(Math.abs(ux - uy)).toBeLessThan(0.2);
    expect(Math.abs(d[0] - a[0] - 2 * ux)).toBeLessThan(0.3);
  });

  it('animate=false sets final positions immediately', () => {
    const { svg, layer } = setup();
    layer.update(spec({ labels: [0, 0, 0, 0] }), false);
    const before = svg.querySelectorAll('circle.cs-point')[1].getAttribute('cx');
    layer.update({ ...spec({ labels: [1, 1, 1, 1] }), points: [[0, 0], [2, 1], [-1, 2], [2, -1]] }, false);
    const p = svg.querySelectorAll('circle.cs-point')[1];
    expect(p.getAttribute('cx')).not.toBe(before);
    expect(p.getAttribute('fill')).toBe(CLUSTER[1]);
  });

  it('destroy removes the layer', () => {
    const { svg, layer } = setup();
    layer.update(spec(), false);
    layer.destroy();
    expect(svg.querySelector('.cs-layer')).toBeNull();
    expect(svg.querySelectorAll('circle')).toHaveLength(0);
  });

  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const attrs = (svg: Element, sel: string, a: string): (string | null)[] => [...svg.querySelectorAll(sel)].map((e) => e.getAttribute(a));

  it('an instant update cancels a running animated one', async () => {
    const { svg, layer } = setup();
    layer.update(spec({ labels: [0, 0, 0, 0], centers: [[0, 0]] }), false);
    layer.update({ ...spec({ labels: [1, 1, 1, 1], centers: [[1, 1]] }), points: [[2, 2], [1, 1], [-1, 2], [2, -1]] }, true);
    layer.update(spec({ labels: [2, 2, 2, 2], centers: [[-1, -1]] }), false);
    const want = attrs(svg, 'circle.cs-point', 'cx');
    const wantT = svg.querySelector('g.cs-center')!.getAttribute('transform');
    await wait(700);
    expect(attrs(svg, 'circle.cs-point', 'cx')).toEqual(want);
    expect(attrs(svg, 'circle.cs-point', 'fill')).toEqual(Array(4).fill(CLUSTER[2]));
    expect(svg.querySelector('g.cs-center')!.getAttribute('transform')).toBe(wantT);
  });

  it('resize mid-animation lands on the new scale', async () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0]], lines: [{ point: 1, nearest: 0 }] }), false);
    layer.update({ ...spec({ centers: [[1, 1]], lines: [{ point: 1, nearest: 0 }] }), points: [[2, 2], [1, 1], [-1, 2], [2, -1]] }, true);
    layer.resize({ left: 0, top: 0, width: 200, height: 200 });
    const want = attrs(svg, 'circle.cs-point', 'cx');
    const wantL = attrs(svg, 'line.cs-line', 'x2');
    await wait(700);
    expect(attrs(svg, 'circle.cs-point', 'cx')).toEqual(want);
    expect(attrs(svg, 'line.cs-line', 'x2')).toEqual(wantL);
  });

  it('lines and rings animate with the points and end at the target', async () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0]], lines: [{ point: 1, nearest: 0 }], negative: [1] }), false);
    layer.update(spec({ centers: [[2, 2]], lines: [{ point: 1, nearest: 0 }], negative: [1] }), true);
    const x2 = svg.querySelector('line.cs-line')!.getAttribute('x2');
    const c0 = Number(svg.querySelector('g.cs-center')!.getAttribute('transform')!.match(/translate\(([-\d.]+)/)![1]);
    await wait(700);
    const c1 = Number(svg.querySelector('g.cs-center')!.getAttribute('transform')!.match(/translate\(([-\d.]+)/)![1]);
    expect(c1).toBeGreaterThan(c0); // centre glided
    expect(Number(svg.querySelector('line.cs-line')!.getAttribute('x2'))).toBeCloseTo(c1, 0);
    expect(x2).not.toBe(String(c1)); // the line did not jump ahead of the centre
  });

  it('repeated update keeps element counts', () => {
    const { svg, layer } = setup();
    const s = spec({ labels: [0, 1, 1, 0], centers: [[0, 0], [1, 1]], trails: [[0, 0], [1, 1]], lines: [{ point: 0, nearest: 0 }], changed: [1], negative: [2], selected: 3 });
    layer.update(s, false);
    layer.update(s, false);
    layer.update(s, false);
    expect(svg.querySelectorAll('circle.cs-point')).toHaveLength(4);
    expect(svg.querySelectorAll('g.cs-center')).toHaveLength(2);
    expect(svg.querySelectorAll('.cs-trail')).toHaveLength(2);
    expect(svg.querySelectorAll('line.cs-line')).toHaveLength(2);
    expect(svg.querySelectorAll('.cs-ring')).toHaveLength(3);
  });

  it('centre count 3 to 1 to 10 follows the spec', () => {
    const { svg, layer } = setup();
    const cs = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [i * 0.1, 0]);
    for (const n of [3, 1, 10]) {
      layer.update(spec({ centers: cs(n) }), false);
      expect(svg.querySelectorAll('g.cs-center')).toHaveLength(n);
    }
    expect(svg.querySelectorAll('g.cs-center text')[9].textContent).toBe('M10');
    layer.update(spec({ centers: null }), false);
    expect(svg.querySelectorAll('g.cs-center')).toHaveLength(0);
  });

  it('labels toggle between null and values', () => {
    const { svg, layer } = setup();
    layer.update(spec({ labels: [0, 1, 2, 0] }), false);
    layer.update(spec({ labels: null }), false);
    expect(attrs(svg, 'circle.cs-point', 'fill')).toEqual(Array(4).fill(UNASSIGNED));
    expect(attrs(svg, 'circle.cs-point', 'data-cluster')).toEqual(Array(4).fill('-'));
    layer.update(spec({ labels: [0, 1, 2, 0] }), false);
    expect(attrs(svg, 'circle.cs-point', 'data-cluster')).toEqual(['0', '1', '2', '0']);
  });

  it('resize moves points, centres, lines and rings', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[1, 1]], lines: [{ point: 0, nearest: 0 }], selected: 1 }), false);
    const before = [attrs(svg, 'circle.cs-point', 'cx')[1], svg.querySelector('g.cs-center')!.getAttribute('transform'), svg.querySelector('line.cs-line')!.getAttribute('x2'), svg.querySelector('.cs-ring')!.getAttribute('cx')];
    layer.resize({ left: 0, top: 0, width: 600, height: 600 });
    const after = [attrs(svg, 'circle.cs-point', 'cx')[1], svg.querySelector('g.cs-center')!.getAttribute('transform'), svg.querySelector('line.cs-line')!.getAttribute('x2'), svg.querySelector('.cs-ring')!.getAttribute('cx')];
    after.forEach((a, i) => expect(a).not.toBe(before[i]));
  });

  // Label boxes from the written attributes, with the layer's estimate (jsdom has no text metrics; font 12 px).
  const FS = 12;
  type Box = { l: number; t: number; r: number; b: number };
  const textBox = (t: Element, ox = 0, oy = 0): Box => {
    const w = (t.textContent ?? '').length * 0.68 * FS;
    const x = Number(t.getAttribute('x')) + ox;
    const y = Number(t.getAttribute('y')) + oy;
    const a = t.getAttribute('text-anchor') ?? 'start';
    const l = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x;
    return { l, t: y - 0.92 * FS, r: l + w, b: y + 0.25 * FS };
  };
  const hit = (p: Box, q: Box): boolean => Math.min(p.r, q.r) > Math.max(p.l, q.l) && Math.min(p.b, q.b) > Math.max(p.t, q.t);
  const centreLabelBoxes = (svg: Element): Box[] => [...svg.querySelectorAll('g.cs-center')].map((g) => {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute('transform')!)!;
    return textBox(g.querySelector('text.cs-center-label')!, Number(m[1]), Number(m[2]));
  });
  const plusBoxes = (svg: Element): Box[] => [...svg.querySelectorAll('g.cs-center')].map((g) => {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute('transform')!)!;
    const x = Number(m[1]);
    const y = Number(m[2]);
    return { l: x - 7, t: y - 7, r: x + 7, b: y + 7 };
  });

  it('centre labels of two centres 0,1 apart do not touch each other or the other plus', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0], [0.1, 0]] }), false);
    const [a, b] = centreLabelBoxes(svg);
    const [pa, pb] = plusBoxes(svg);
    expect(hit(a, b)).toBe(false);
    expect(hit(a, pb)).toBe(false);
    expect(hit(b, pa)).toBe(false);
    // three crowded centres, as in the bad start
    layer.update(spec({ centers: [[0, 0], [0.25, 0.1], [0.5, -0.05]] }), false);
    const boxes = centreLabelBoxes(svg);
    const plus = plusBoxes(svg);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i !== j) expect(hit(boxes[i], plus[j]), `M${i + 1} label on M${j + 1} plus`).toBe(false);
        if (i < j) expect(hit(boxes[i], boxes[j]), `M${i + 1} x M${j + 1}`).toBe(false);
      }
    }
  });

  it('the selected-point label avoids a nearby centre and its label', () => {
    const { svg, layer } = setup();
    // point 1 sits at (1,1); the centre is just up and to its right, where the ring label would go
    layer.update(spec({ centers: [[1.3, 1.25]], selected: 1 }), false);
    const ring = svg.querySelector('text.cs-ring-label')!;
    expect(ring.textContent).toBe('Nokta 2');
    const rb = textBox(ring);
    expect(hit(rb, centreLabelBoxes(svg)[0])).toBe(false);
    expect(hit(rb, plusBoxes(svg)[0])).toBe(false);
  });

  it('a lone centre keeps its label up and to the right', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0]] }), false);
    const t = svg.querySelector('text.cs-center-label')!;
    expect(Number(t.getAttribute('x'))).toBeGreaterThan(0);
    expect(Number(t.getAttribute('y'))).toBeLessThan(0);
    expect(t.getAttribute('text-anchor') ?? 'start').toBe('start');
  });

  it('lines with a bad point index, or without centres, are dropped', () => {
    const { svg, layer } = setup();
    layer.update(spec({ centers: [[0, 0]], lines: [{ point: 99, nearest: 0 }, { point: -1, nearest: 0 }, { point: 1, nearest: 0 }] }), false);
    expect(svg.querySelectorAll('line.cs-line')).toHaveLength(1);
    layer.update(spec({ centers: null, lines: [{ point: 1, nearest: 0 }] }), false);
    expect(svg.querySelectorAll('line.cs-line')).toHaveLength(0);
  });
});
