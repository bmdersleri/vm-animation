import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import { OrdersTable } from './scene-orders';
import type { LatticeEdge, LatticeNode, LatticeView, ShapView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Layer of the lattice (number of features in the coalition) to the masks drawn in it, left to right. */
const LAYERS: number[][] = [[0], [1, 2, 4], [3, 5, 6], [7]];

/** `.lattice-scene` vertical padding (10 + 10) and row gap (12), kept in step with the CSS. */
const SCENE_PAD_V = 20;
const ROW_GAP = 12;

/** Where a node sits (px, top-left corner and size). */
interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The coalition lattice (steps 3-5): eight `.lattice-node[data-mask]` in four layers (the empty set on top, all
 * features at the bottom) with the full feature names and v(S) to three decimals, and the twelve
 * `.lattice-edge[data-from][data-to]` (one feature joins). In step 4 the ordering path is `.is-path` with its
 * marginal contributions in `.edge-label`; in step 5 the ordering table sits beside the lattice (under it in
 * one column). A lattice or table wider than the stage scrolls inside its own wrapper, never the page.
 */
export class LatticeScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly wrap: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly edgeG: G;
  private readonly nodeG: G;
  private readonly labelG: G;
  private readonly orders: OrdersTable;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'lattice-scene');
    this.wrap = el(doc, 'div', 'lattice-wrap');
    const root = doc.createElementNS(NS, 'svg');
    this.wrap.append(root);
    this.svg = select(root).attr('class', 'lattice-plot').attr('role', 'img').attr('aria-label', 'Özellik koalisyonlarının kafesi');
    this.edgeG = this.svg.append('g').attr('class', 'lattice-edges');
    this.nodeG = this.svg.append('g').attr('class', 'lattice-nodes');
    this.labelG = this.svg.append('g').attr('class', 'lattice-labels');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.orders = new OrdersTable(doc);
    this.root.append(this.wrap, this.orders.root);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('lat');
  }

  destroy(): void {
    this.interrupt();
    this.orders.destroy();
    this.root.remove();
  }

  update(v: ShapView, ms: number): void {
    const view = v.lattice;
    if (!view) {
      return;
    }
    this.root.dataset.part = view.part;
    this.orders.root.hidden = view.part !== 'orders';
    if (view.part === 'orders') {
      this.orders.update(view);
    }
    // a narrow stage stacks the ordering table under the lattice: the lattice gets the height the table leaves
    const stacked = view.part === 'orders' && this.w < NARROW;
    const below = stacked ? Math.ceil(this.orders.root.getBoundingClientRect().height) + ROW_GAP : 0;
    this.draw(view, ms, below);
  }

  private draw(view: LatticeView, ms: number, below: number): void {
    const narrow = this.w < NARROW;
    const fs = this.measure.fontPx('node-name', this.measure.fonts(this.mode).tick);
    const avail = Math.max(120, view.part === 'orders' && !narrow ? Math.floor(this.w * 0.54) - 12 : this.w - (narrow ? 8 : 24));
    const names = view.nodes.flatMap((n) => (n.names.length > 0 ? n.names : ['∅']));
    const nameW = this.measure.maxWidth(names, 'node-name', fs);
    const valueW = this.measure.maxWidth(
      view.nodes.map((n) => n.v),
      'node-v',
      fs,
    );
    const padX = narrow ? 12 : 24;
    const gapX = narrow ? 4 : 8;
    // room for the node and path strokes at the left and right edge
    const margin = 8;
    const measured = Math.ceil(Math.max(nameW, valueW)) + padX;
    // a narrow stage fits three nodes exactly; a wide one keeps the measured width and scrolls if it must
    const nodeW = narrow ? Math.min(measured, Math.floor((avail - 2 * gapX - 2 * margin) / 3)) : measured;
    const width = narrow ? avail : Math.max(avail, 3 * nodeW + 2 * gapX + 8);
    const inner = nodeW - padX;
    const pieces = (name: string): string[] => {
      if (this.measure.width(name, 'node-name', fs) <= inner) {
        return [name];
      }
      // break a camel-case name at its capital: "MonthlyCharges" -> "Monthly" / "Charges"
      const parts = name.split(/(?<=[a-z])(?=[A-Z])/);
      return parts.length > 1 ? parts : [name];
    };
    const wrapped = new Map<number, string[][]>(
      view.nodes.map((n) => [n.mask, (n.names.length > 0 ? n.names : ['∅']).map(pieces)]),
    );
    const lineCount = (mask: number): number => wrapped.get(mask)!.reduce((sum, ps) => sum + ps.length, 0) + 1;
    const lines = (layer: number): number => Math.max(...LAYERS[layer].map(lineCount));
    // the tier gap shrinks first, then the line height, until the four tiers fit the stage height (below 1.3 the
    // line boxes of a node's names touch, so that is the last resort of a very short stage)
    const tiers = [
      { lh: 1.3, gap: 2 },
      { lh: 1.3, gap: 1.5 },
      { lh: 1.3, gap: 1.1 },
      { lh: 1.3, gap: 0.8 },
      { lh: 1.2, gap: 1.6 },
      { lh: 1.1, gap: 1.3 },
      { lh: 1.05, gap: 1.1 },
    ];
    const need = (t: { lh: number; gap: number }): number => {
      const lh = fs * t.lh;
      return [0, 1, 2, 3].reduce((sum, l) => sum + lines(l) * lh + 10, 0) + 3 * lh * t.gap + 8;
    };
    const pick = tiers.find((t) => need(t) <= this.h - SCENE_PAD_V - below) ?? tiers[tiers.length - 1];
    const lh = fs * pick.lh;
    const gapY = lh * pick.gap;
    const places = new Map<number, Place>();
    let y = 4;
    LAYERS.forEach((masks, layer) => {
      const h = lines(layer) * lh + 10;
      masks.forEach((mask, i) => {
        const cx = ((i + 0.5) * width) / masks.length;
        places.set(mask, { x: cx - nodeW / 2, y, w: nodeW, h });
      });
      y += h + gapY;
    });
    const height = Math.ceil(y - gapY + 4);
    this.svg.attr('width', r1(width)).attr('height', height);

    // edges: a line from the bottom of the smaller coalition to the top of the larger one
    const edges = view.edges.filter((e) => e.visible);
    const edgeKey = (e: LatticeEdge): string => `${e.from}-${e.to}`;
    const line = (e: LatticeEdge) => {
      const a = places.get(e.from)!;
      const b = places.get(e.to)!;
      return { x1: a.x + a.w / 2, y1: a.y + a.h, x2: b.x + b.w / 2, y2: b.y };
    };
    const edgeSel = this.edgeG
      .selectAll<SVGLineElement, LatticeEdge>('line.lattice-edge')
      .data(edges, edgeKey)
      .join(
        (enter) => enter.append('line').attr('opacity', 0),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', (e) => `lattice-edge${e.path ? ' is-path' : ''}`)
      .attr('data-from', (e) => e.from)
      .attr('data-to', (e) => e.to)
      .attr('data-feature', (e) => e.feature)
      .attr('x1', (e) => r1(line(e).x1))
      .attr('y1', (e) => r1(line(e).y1))
      .attr('x2', (e) => r1(line(e).x2))
      .attr('y2', (e) => r1(line(e).y2));
    tr(edgeSel, 'lat', ms).attr('opacity', 1);
    edgeSel.filter((e) => e.path).raise();

    // nodes
    const onPath = new Set(view.path ?? []);
    const nodeSel = this.nodeG
      .selectAll<SVGGElement, LatticeNode>('g.lattice-node')
      .data(view.nodes, (n) => n.mask)
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('class', 'node-box').attr('rx', 8);
        g.append('text').attr('class', 'node-v');
        return g;
      })
      .attr('class', (n) => `lattice-node${n.filled ? '' : ' is-empty'}${onPath.has(n.mask) ? ' is-path' : ''}`)
      .attr('data-mask', (n) => n.mask)
      .attr('data-layer', (n) => n.layer);
    nodeSel
      .select('rect.node-box')
      .attr('x', (n) => r1(places.get(n.mask)!.x))
      .attr('y', (n) => r1(places.get(n.mask)!.y))
      .attr('width', (n) => r1(places.get(n.mask)!.w))
      .attr('height', (n) => r1(places.get(n.mask)!.h));
    nodeSel
      .selectAll<SVGTextElement, string>('text.node-name')
      .data(
        (n) => (n.names.length > 0 ? n.names : ['∅']),
        (name) => name,
      )
      .join('text')
      .attr('class', 'node-name')
      .attr('text-anchor', 'middle');
    nodeSel.each(function (n) {
      const p = places.get(n.mask)!;
      const g = select(this);
      const cx = r1(p.x + p.w / 2);
      let line = 0;
      const starts = wrapped.get(n.mask)!.map((ps) => {
        const at = line;
        line += ps.length;
        return at;
      });
      g.selectAll<SVGTextElement, string>('text.node-name').each(function (_, i) {
        const ps = wrapped.get(n.mask)![i];
        select(this)
          .selectAll<SVGTSpanElement, string>('tspan')
          .data(ps)
          .join('tspan')
          .attr('x', cx)
          .attr('y', (_p, k) => r1(p.y + 5 + lh * (starts[i] + k + 0.5)))
          .attr('dy', '0.35em')
          .text((piece) => piece);
      });
      g.select('text.node-v')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('x', cx)
        .attr('y', r1(p.y + 5 + lh * (lineCount(n.mask) - 1 + 0.5)))
        .text(n.filled ? n.v : '');
    });
    tr(nodeSel, 'lat', ms).attr('opacity', (n) => (n.filled ? 1 : 0.4));

    // marginal contributions on the path edges
    const labelEdges = edges.filter((e) => e.path && e.delta !== null);
    this.labelG
      .selectAll<SVGTextElement, LatticeEdge>('text.edge-label')
      .data(labelEdges, edgeKey)
      .join('text')
      .attr('class', 'edge-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('x', (e) => r1((line(e).x1 + line(e).x2) / 2))
      .attr('y', (e) => r1((line(e).y1 + line(e).y2) / 2))
      .text((e) => e.delta ?? '');
  }
}
