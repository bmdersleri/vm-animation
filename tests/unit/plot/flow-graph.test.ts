// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import {
  FlowGraphLayer,
  edgeGeometry,
  type FlowEdge,
  type FlowGraphSpec,
  type FlowNode,
} from '../../../src/core/plot/flow-graph';
import { overlap } from '../../../src/core/plot/label-place';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';

function setup() {
  const svg = document.createElementNS(NS, 'svg');
  document.body.append(svg);
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  const g = select(svg).append('g');
  return { svg, layer: new FlowGraphLayer(g, new TextMeasure(probe)) };
}

afterEach(() => document.body.replaceChildren());

const node = (id: string, x: number, y: number, kind: FlowNode['kind'] = 'phase', label = [id]): FlowNode => ({
  id, label, kind, x, y, w: 120, h: 50,
});
const nodes: FlowNode[] = [node('a', 100, 100), node('b', 300, 100), node('c', 500, 100, 'decision'), node('d', 300, 260, 'end')];
const edges: FlowEdge[] = [
  { id: 'ab', from: 'a', to: 'b', kind: 'forward', label: 'ileri' },
  { id: 'bc', from: 'b', to: 'c', kind: 'forward' },
  { id: 'ca', from: 'c', to: 'a', kind: 'back', bend: -70, label: 'geri' },
  { id: 'cd', from: 'c', to: 'd', kind: 'outer', tone: 'alarm', label: 'dış' },
];
const spec = (extra: Partial<FlowGraphSpec> = {}): FlowGraphSpec => ({ nodes, edges, ...extra });

/** Is p on the border of the node (rectangle or diamond), within tol px? */
function onBorder(n: FlowNode, p: [number, number], tol = 0.6): boolean {
  const dx = Math.abs(p[0] - n.x);
  const dy = Math.abs(p[1] - n.y);
  if (n.kind === 'decision') return Math.abs(dx / (n.w / 2) + dy / (n.h / 2) - 1) < tol / 20;
  const onV = Math.abs(dx - n.w / 2) < tol && dy <= n.h / 2 + tol;
  const onH = Math.abs(dy - n.h / 2) < tol && dx <= n.w / 2 + tol;
  return onV || onH;
}

describe('FlowGraphLayer', () => {
  it('draws one group per node and one path per edge', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), 0, 14);
    expect(svg.querySelectorAll('g.flow-node')).toHaveLength(4);
    expect(svg.querySelectorAll('path.flow-edge')).toHaveLength(4);
    expect(svg.querySelectorAll('text.flow-edge-label')).toHaveLength(3);
    expect(svg.querySelector('g.flow-node[data-node="a"]')).not.toBeNull();
    expect(svg.querySelector('path.flow-edge[data-edge="ca"]')).not.toBeNull();
    layer.draw(spec(), 0, 14);
    expect(svg.querySelectorAll('g.flow-node')).toHaveLength(4);
    layer.clear();
    expect(svg.querySelectorAll('g.flow-node')).toHaveLength(0);
  });

  it('decision nodes draw a diamond', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), 0, 14);
    expect(svg.querySelector('g.flow-node[data-node="c"] path.flow-shape')).not.toBeNull();
    expect(svg.querySelector('g.flow-node[data-node="c"] rect')).toBeNull();
    expect(svg.querySelector('g.flow-node[data-node="a"] rect')).not.toBeNull();
    expect(svg.querySelector('g.flow-node[data-node="c"]')?.getAttribute('data-kind')).toBe('decision');
  });

  it('marks the current node and dims the listed nodes', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ current: 'b', dim: ['a', 'd'] }), 0, 14);
    expect(svg.querySelector('g.flow-node.is-current')?.getAttribute('data-node')).toBe('b');
    const dim = [...svg.querySelectorAll('g.flow-node.is-dim')].map((g) => g.getAttribute('data-node'));
    expect(dim.sort()).toEqual(['a', 'd']);
  });

  it('path edges get is-path and their kind class', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ path: ['ab', 'ca'] }), 0, 14);
    const cls = (id: string) => svg.querySelector(`path.flow-edge[data-edge="${id}"]`)!.classList;
    expect(cls('ab').contains('is-path')).toBe(true);
    expect(cls('ab').contains('kind-forward')).toBe(true);
    expect(cls('ca').contains('is-path')).toBe(true);
    expect(cls('ca').contains('kind-back')).toBe(true);
    expect(cls('bc').contains('is-path')).toBe(false);
    expect(cls('cd').contains('kind-outer')).toBe(true);
  });

  it('alarm tone colours the outer edge', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), 0, 14);
    const e = svg.querySelector('path.flow-edge[data-edge="cd"]')!;
    expect(e.classList.contains('tone-alarm')).toBe(true);
    expect(svg.querySelector('path.flow-edge[data-edge="ab"]')!.classList.contains('tone-alarm')).toBe(false);
  });

  it('token sits on the border of the node it is at, away from its text', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ token: { at: 'b' } }), 0, 14);
    // a box: its upper right corner
    expect(svg.querySelector('circle.flow-token')!.getAttribute('transform')).toBe('translate(360,75)');
    // a rhombus: its top vertex
    layer.draw(spec({ token: { at: 'c' } }), 0, 14);
    const c = nodes[2];
    const fitted = layer.nodeBox('c');
    expect(svg.querySelector('circle.flow-token')!.getAttribute('transform')).toBe(`translate(${c.x},${fitted.t})`);
    layer.draw(spec(), 0, 14);
    expect(svg.querySelector('circle.flow-token')).toBeNull();
  });

  it('token with via lands on the edge end', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ token: { at: 'a' } }), 0, 14);
    layer.draw(spec({ token: { at: 'b', via: 'ab' } }), 0, 14);
    expect(svg.querySelectorAll('circle.flow-token')).toHaveLength(1);
    expect(svg.querySelector('circle.flow-token')!.getAttribute('transform')).toBe('translate(360,75)');
    expect(onBorder(nodes[1], edgeGeometry(nodes[0], nodes[1]).at(1))).toBe(true);
  });

  it('edge labels do not overlap node boxes or each other', () => {
    const { layer } = setup();
    layer.draw(spec(), 0, 14);
    const labels = layer.labelBoxes();
    expect(labels).toHaveLength(3);
    for (const b of labels) {
      for (const n of nodes) expect(overlap(b, layer.nodeBox(n.id))).toBe(0);
    }
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) expect(overlap(labels[i], labels[j])).toBe(0);
    }
  });

  it('labels wrap inside the node box', () => {
    const { svg, layer } = setup();
    const long = { ...node('x', 100, 100, 'phase', ['Veri hazırlama ve temizleme evresi']), w: 200 };
    layer.draw({ nodes: [long], edges: [] }, 0, 14);
    const spans = svg.querySelectorAll('g.flow-node[data-node="x"] text.flow-label tspan');
    expect(spans.length).toBeGreaterThan(1);
    expect(layer.nodeBox('x')).toEqual({ l: 0, t: 75, r: 200, b: 125 });
    const lines = [...spans].map((s) => s.textContent!);
    expect(lines.join(' ')).toBe('Veri hazırlama ve temizleme evresi');
    // jsdom measures 0.62 em per character
    for (const l of lines) expect(l.length * 14 * 0.62).toBeLessThanOrEqual(long.w);
    expect(spans.length * 14 * 1.2).toBeLessThanOrEqual(long.h + 1);
  });
});

describe('edgeGeometry', () => {
  it('edge geometry starts and ends on the node borders', () => {
    const [a, b, c, d] = nodes;
    for (const [from, to] of [[a, b], [b, c], [c, a], [c, d]] as const) {
      const g = edgeGeometry(from, to, 0);
      expect(onBorder(from, g.at(0))).toBe(true);
      expect(onBorder(to, g.at(1))).toBe(true);
    }
    const bent = edgeGeometry(a, b, -60);
    expect(onBorder(a, bent.at(0))).toBe(true);
    expect(onBorder(b, bent.at(1))).toBe(true);
    // the chord is horizontal at y = 100: the midpoint sits `bend` px off it, signed
    const up = edgeGeometry(a, b, 60);
    expect(Math.abs(up.mid[1] - 100)).toBeCloseTo(60, 5);
    expect(Math.sign(up.mid[1] - 100)).toBe(-Math.sign(bent.mid[1] - 100));
    expect(up.mid[0]).toBeCloseTo(200, 5);
    expect(edgeGeometry(a, b, 0).mid[1]).toBeCloseTo(100, 5);
    expect(up.d).toMatch(/^M[-\d.]+,[-\d.]+Q[-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+$/);
    expect(up.at(0.5)[1]).toBeCloseTo(up.mid[1], 5);
  });

  it('arrow heads keep their size whatever the stroke width', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ path: ['ab'] }), 0, 14);
    const markers = [...svg.querySelectorAll('marker')];
    expect(markers).toHaveLength(4);
    for (const m of markers) {
      expect(m.getAttribute('markerUnits')).toBe('userSpaceOnUse');
    }
  });

  it('a box grows to hold its label: widest line plus padding, every line', () => {
    const { svg, layer } = setup();
    const wide = { ...node('w', 200, 100, 'phase', ['Yaygınlaştırma ve izleme', 'ikinci satır']), w: 60, h: 20 };
    layer.draw({ nodes: [wide], edges: [] }, 0, 14);
    const box = layer.nodeBox('w');
    const lines = [...svg.querySelectorAll('g.flow-node[data-node="w"] tspan')].map((t) => t.textContent!);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // jsdom measures 0.62 em per character
    for (const l of lines) expect(l.length * 14 * 0.62 + 16).toBeLessThanOrEqual(box.r - box.l + 0.5);
    expect(lines.length * 14 * 1.2).toBeLessThanOrEqual(box.b - box.t);
    expect(box.r - box.l).toBeGreaterThanOrEqual(60);
  });

  it('a rhombus holds its text inside the inscribed rectangle', () => {
    const { svg, layer } = setup();
    const d = { ...node('d', 200, 100, 'decision', ['Veri', 'yeterli mi?']), w: 40, h: 20 };
    layer.draw({ nodes: [d], edges: [] }, 0, 14);
    const box = layer.nodeBox('d');
    const w = box.r - box.l;
    const h = box.b - box.t;
    const lines = [...svg.querySelectorAll('g.flow-node[data-node="d"] tspan')].map((t) => t.textContent!);
    const tw = Math.max(...lines.map((l) => l.length * 14 * 0.62));
    const th = lines.length * 14 * 1.2;
    expect(tw / w + th / h).toBeLessThanOrEqual(1);
  });

  it('an edge label can sit near its start', () => {
    const { svg, layer } = setup();
    const near: FlowEdge[] = [
      { id: 'ab', from: 'a', to: 'b', kind: 'back', label: 'geri', labelAt: 0.2 },
      { id: 'ba', from: 'b', to: 'a', kind: 'back', label: 'ileri', bend: 40 },
    ];
    layer.draw({ nodes: [node('a', 100, 100), node('b', 500, 100)], edges: near }, 0, 14);
    const x = (id: string) => Number(svg.querySelector(`text.flow-edge-label[data-edge="${id}"]`)!.getAttribute('x'));
    expect(x('ab')).toBeLessThan(250);
    expect(x('ba')).toBeGreaterThan(250);
  });
});
