import type { Selection } from 'd3-selection';
import type { Transition } from 'd3-transition';
import './flow-graph.css';
import { chooseOffset, offsets, type Box } from './label-place';
import { r1 } from './marks';
import type { TextMeasure } from './text-measure';
import { tr } from './transition';

type G = Selection<SVGGElement, unknown, null, undefined>;

export type FlowNodeKind = 'phase' | 'decision' | 'end';

/** A node: `label` lines, centre (x, y) and the box (w, h) the page's layout reserved for it, all in px. */
export interface FlowNode {
  id: string;
  label: string[];
  kind: FlowNodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An edge between two nodes; `bend` shifts the curve's midpoint off the chord by that many px (signed). */
export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: 'forward' | 'back' | 'outer';
  label?: string;
  bend?: number;
  /** Where along the curve the label sits, 0 = start (default 0.5); keeps labels of crossing edges apart. */
  labelAt?: number;
  tone?: 'alarm';
}

export interface FlowGraphSpec {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Node drawn as the current one (filled). */
  current?: string;
  /** Edge ids drawn heavier. */
  path?: string[];
  /** Node ids drawn faded. */
  dim?: string[];
  /** The token sits on `at`; with `via` (an edge id) and motion it walks along that edge first. */
  token?: { at: string; via?: string };
}

export interface EdgeGeometry {
  d: string;
  at(t: number): [number, number];
  mid: [number, number];
}

/** Distance from a node's centre to its border along the unit direction (ux, uy): rectangle or rhombus. */
function borderDistance(n: FlowNode, ux: number, uy: number): number {
  const ax = Math.abs(ux) / (n.w / 2);
  const ay = Math.abs(uy) / (n.h / 2);
  return n.kind === 'decision' ? 1 / (ax + ay) : 1 / Math.max(ax, ay);
}

/**
 * Pure curve of an edge: a quadratic Bezier from the border of `a` to the border of `b` (along the line
 * between their centres). The curve's midpoint (`mid`, also `at(0.5)`) lies `bend` px off the chord, to the
 * left of the direction a to b for positive `bend` (in screen coordinates, y down).
 */
export function edgeGeometry(a: FlowNode, b: FlowNode, bend = 0): EdgeGeometry {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const da = borderDistance(a, ux, uy);
  const db = borderDistance(b, ux, uy);
  const p0: [number, number] = [a.x + ux * da, a.y + uy * da];
  const p2: [number, number] = [b.x - ux * db, b.y - uy * db];
  // a quadratic curve's midpoint is half-way to its control point, so the control sits 2 * bend off the chord
  const c: [number, number] = [(p0[0] + p2[0]) / 2 - uy * 2 * bend, (p0[1] + p2[1]) / 2 + ux * 2 * bend];
  const at = (t: number): [number, number] => {
    const s = 1 - t;
    return [s * s * p0[0] + 2 * s * t * c[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * c[1] + t * t * p2[1]];
  };
  const d = `M${r1(p0[0])},${r1(p0[1])}Q${r1(c[0])},${r1(c[1])} ${r1(p2[0])},${r1(p2[1])}`;
  return { d, at, mid: at(0.5) };
}

const PAD = 8;
const PAD_Y = 6;
const LINE_K = 1.2;
const TOKEN_R = 6;

/** A node's box (w, h in px) and, when fitted, the label lines it holds. */
export interface FittedNode {
  w: number;
  h: number;
  lines: string[];
}

/** Box of `lines`: as wide as the widest line plus padding and as tall as the lines, but at least minW x minH; a rhombus is sized so the text block fits the rectangle inscribed in it (text width / w + text height / h <= 1). */
function boxFor(kind: FlowNodeKind, lines: string[], measure: TextMeasure, fontPx: number, minW: number, minH: number, wide = 1.6): FittedNode {
  const lh = fontPx * LINE_K;
  const widest = measure.maxWidth(lines, 'flow-label', fontPx);
  if (kind === 'decision') {
    const tw = widest + 8;
    const th = lines.length * lh + 4;
    const w = Math.max(minW, wide * tw);
    return { w, h: Math.max(minH, th / (1 - tw / w)), lines };
  }
  return { w: Math.max(minW, widest + 2 * PAD), h: Math.max(minH, lines.length * lh + 2 * PAD_Y), lines };
}

/**
 * The box a node needs for its label at `fontPx`: label lines wrap to the width the page asked for (`n.w`), the box
 * grows in height (and in width for a word wider than that) so that every line fits; never smaller than (n.w, n.h).
 */
export function fitNode(n: FlowNode, measure: TextMeasure, fontPx: number): FittedNode {
  const room = n.kind === 'decision' ? n.w / 1.6 - 8 : n.w - 2 * PAD;
  const lines = n.label.flatMap((l) => measure.wrap(l, room, 'flow-label', fontPx));
  return boxFor(n.kind, lines, measure, fontPx, n.w, n.h);
}

/**
 * The smallest box that holds the label lines as given, without wrapping (for pages that lay the nodes out from
 * their labels). A rhombus is `wide` times its text width (default 1.6): wider rhombi are lower.
 */
export function naturalSize(n: Pick<FlowNode, 'kind' | 'label'>, measure: TextMeasure, fontPx: number, wide = 1.6): { w: number; h: number } {
  const { w, h } = boxFor(n.kind, n.label, measure, fontPx, 0, 0, wide);
  return { w, h };
}

/** The token rests on a node's border, away from its text: a box's upper right corner, a rhombus's top vertex. */
function tokenPoint(n: FlowNode): [number, number] {
  return n.kind === 'decision' ? [n.x, n.y - n.h / 2] : [n.x + n.w / 2, n.y - n.h / 2];
}
let layerCount = 0;

const LABEL_CLEAR = 5;
const grow = (b: Box, m: number): Box => ({ l: b.l - m, t: b.t - m, r: b.r + m, b: b.b + m });
const boxOf = (n: FlowNode): Box => ({ l: n.x - n.w / 2, t: n.y - n.h / 2, r: n.x + n.w / 2, b: n.y + n.h / 2 });
const translate = (p: readonly [number, number]): string => `translate(${r1(p[0])},${r1(p[1])})`;

/**
 * Flow graph: box, rhombus and end nodes, labelled forward / back / outer edges with arrow heads and a
 * token that walks along an edge. Colours and sizes live in flow-graph.css; the page lays the nodes out.
 */
export class FlowGraphLayer {
  private readonly edgesG: G;
  private readonly labelsG: G;
  private readonly nodesG: G;
  private readonly tokenG: G;
  private readonly prefix = `flow${layerCount++}`;
  private boxes = new Map<string, Box>();
  private labels: Box[] = [];
  private tokenAt: [number, number] | null = null;

  constructor(
    parent: G,
    private readonly measure: TextMeasure,
  ) {
    this.defs(parent);
    this.edgesG = parent.append('g').attr('class', 'flow-edges');
    this.labelsG = parent.append('g').attr('class', 'flow-edge-labels');
    this.nodesG = parent.append('g').attr('class', 'flow-nodes');
    this.tokenG = parent.append('g').attr('class', 'flow-token-layer');
  }

  private defs(parent: G): void {
    const defs = parent.append('defs');
    for (const k of ['forward', 'back', 'outer', 'alarm']) {
      defs.append('marker')
        .attr('id', `${this.prefix}-${k}`)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        // fixed-size heads: the default marker units would scale them with the (path) stroke width
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', 11)
        .attr('markerHeight', 11)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('class', `flow-arrow arrow-${k}`)
        .attr('d', 'M0,0L10,5L0,10Z');
    }
  }

  draw(input: FlowGraphSpec, ms: number, fontPx: number): void {
    const fitted = input.nodes.map((n) => fitNode(n, this.measure, fontPx));
    const lineOf = new Map(input.nodes.map((n, i) => [n.id, fitted[i].lines]));
    const spec: FlowGraphSpec = { ...input, nodes: input.nodes.map((n, i) => ({ ...n, w: fitted[i].w, h: fitted[i].h })) };
    const byId = new Map(spec.nodes.map((n) => [n.id, n]));
    this.boxes = new Map(spec.nodes.map((n) => [n.id, boxOf(n)]));
    const path = new Set(spec.path ?? []);
    const dim = new Set(spec.dim ?? []);
    this.edgesG.selectAll('*').remove();
    this.labelsG.selectAll('*').remove();
    this.nodesG.selectAll('*').remove();

    const geos = new Map<string, EdgeGeometry>();
    const drawn: FlowEdge[] = [];
    for (const e of spec.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const geo = edgeGeometry(a, b, e.bend ?? 0);
      geos.set(e.id, geo);
      drawn.push(e);
      const marker = e.tone === 'alarm' ? 'alarm' : e.kind;
      this.edgesG.append('path')
        .attr('class', `flow-edge kind-${e.kind}${e.tone ? ` tone-${e.tone}` : ''}${path.has(e.id) ? ' is-path' : ''}`)
        .attr('data-edge', e.id)
        .attr('d', geo.d)
        .attr('marker-end', `url(#${this.prefix}-${marker})`);
    }

    for (const n of spec.nodes) this.drawNode(n, lineOf.get(n.id)!, spec.current === n.id, dim.has(n.id), fontPx);
    this.placeLabels(drawn, geos, spec.nodes, fontPx);
    this.drawToken(spec, byId, geos, ms);
  }

  private drawNode(n: FlowNode, lines: string[], current: boolean, dim: boolean, fontPx: number): void {
    const g = this.nodesG.append('g')
      .attr('class', `flow-node${current ? ' is-current' : ''}${dim ? ' is-dim' : ''}`)
      .attr('data-node', n.id)
      .attr('data-kind', n.kind)
      .attr('transform', translate([n.x, n.y]));
    if (n.kind === 'decision') {
      const hw = n.w / 2;
      const hh = n.h / 2;
      g.append('path').attr('class', 'flow-shape').attr('d', `M0,${-hh}L${hw},0L0,${hh}L${-hw},0Z`);
    } else {
      g.append('rect')
        .attr('class', 'flow-shape')
        .attr('x', -n.w / 2)
        .attr('y', -n.h / 2)
        .attr('width', n.w)
        .attr('height', n.h)
        .attr('rx', n.kind === 'end' ? n.h / 2 : 6);
    }
    const lh = fontPx * LINE_K;
    const text = g.append('text').attr('class', 'flow-label').attr('text-anchor', 'middle');
    lines.forEach((line, i) => {
      text.append('tspan')
        .attr('x', 0)
        .attr('y', r1((i - (lines.length - 1) / 2) * lh + fontPx * 0.35))
        .text(line);
    });
  }

  private placeLabels(edges: FlowEdge[], geos: Map<string, EdgeGeometry>, nodes: FlowNode[], fontPx: number): void {
    // labels keep a few px clear of every node border
    const taken: Box[] = nodes.map((n) => grow(boxOf(n), LABEL_CLEAR));
    const area = this.area(taken, 60);
    // and clear of the edge lines: points along every curve count as taken
    for (const e of edges) {
      const geo = geos.get(e.id)!;
      for (let t = 0; t <= 1.001; t += 0.1) {
        const [px, py] = geo.at(t);
        taken.push({ l: px - 3, t: py - 3, r: px + 3, b: py + 3 });
      }
    }
    const cands = offsets(3, 4, fontPx);
    this.labels = [];
    for (const e of edges) {
      if (!e.label) continue;
      const [x, y] = e.labelAt === undefined ? geos.get(e.id)!.mid : geos.get(e.id)!.at(e.labelAt);
      const before = taken.length;
      const o = chooseOffset({ x, y, chars: e.label.length, cands, fs: fontPx, taken, area });
      if (taken.length > before) this.labels.push(taken[taken.length - 1]);
      this.labelsG.append('text')
        .attr('class', `flow-edge-label${e.tone ? ` tone-${e.tone}` : ''}`)
        .attr('data-edge', e.id)
        .attr('x', r1(x + o.dx))
        .attr('y', r1(y + o.dy))
        .attr('text-anchor', o.anchor)
        .text(e.label);
    }
  }

  private area(boxes: Box[], m: number): Box {
    const pick = (f: (b: Box) => number, pickMin: boolean): number => (pickMin ? Math.min : Math.max)(...boxes.map(f));
    return {
      l: pick((b) => b.l, true) - m,
      t: pick((b) => b.t, true) - m,
      r: pick((b) => b.r, false) + m,
      b: pick((b) => b.b, false) + m,
    };
  }

  private drawToken(spec: FlowGraphSpec, byId: Map<string, FlowNode>, geos: Map<string, EdgeGeometry>, ms: number): void {
    const at = spec.token ? byId.get(spec.token.at) : undefined;
    if (!spec.token || !at) {
      this.tokenG.selectAll('*').remove();
      this.tokenAt = null;
      return;
    }
    const end = tokenPoint(at);
    let c = this.tokenG.select<SVGCircleElement>('circle.flow-token');
    if (c.empty()) {
      c = this.tokenG.append('circle').attr('class', 'flow-token').attr('r', TOKEN_R);
      c.attr('transform', translate(this.tokenAt ?? end));
    }
    const geo = spec.token.via ? geos.get(spec.token.via) : undefined;
    if (geo && ms > 0) {
      const walk = tr(c, 'flow-token', ms) as unknown as Transition<SVGCircleElement, unknown, null, undefined>;
      walk.attrTween('transform', () => (t: number) => translate(geo.at(t)));
      c.transition('flow-token-end').delay(ms).attr('transform', translate(end));
    } else {
      c.interrupt('flow-token').attr('transform', translate(end));
    }
    this.tokenAt = end;
  }

  /** Box of a node of the last draw (empty box at the origin if unknown). */
  nodeBox(id: string): Box {
    return this.boxes.get(id) ?? { l: 0, t: 0, r: 0, b: 0 };
  }

  /** Boxes of the edge labels of the last draw. */
  labelBoxes(): Box[] {
    return [...this.labels];
  }

  clear(): void {
    this.edgesG.selectAll('*').remove();
    this.labelsG.selectAll('*').remove();
    this.nodesG.selectAll('*').remove();
    this.tokenG.selectAll('*').remove();
    this.boxes = new Map();
    this.labels = [];
    this.tokenAt = null;
  }
}
