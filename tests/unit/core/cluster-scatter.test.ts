// @vitest-environment jsdom
import '../svg-stubs';
import { describe, expect, it } from 'vitest';
import { ClusterScatterLayer, type ClusterScatterSpec } from '../../../src/core/plot/cluster-scatter';
import { CLUSTER, NEGATIVE, UNASSIGNED } from '../../../src/core/plot/marks';

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
});
