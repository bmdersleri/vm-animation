import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { r1 } from '../../core/plot/marks';
import { stepPath } from '../../core/plot/step-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import type { GrowView, TreeNodeView, TuneView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Outer padding (px). */
const PAD = 8;
/** From this width on the tree and the scatter stand side by side. */
const WIDE = 700;
/** Width the vertical scrollbar of a too-tall host takes. */
const SCROLLBAR = 16;
/** The x range of the data (the scatter's x axis). */
const X_DOMAIN: [number, number] = [0, 10];

/** One box of the tree diagram. */
export interface TreeBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Centre x (used by the edges). */
  cx: number;
}

export interface TreeLayout {
  boxes: TreeBox[];
  /** Total height: the lowest row's bottom plus the padding. */
  height: number;
}

/** Space kept between two boxes, sideways and downwards (px). */
const BOX_GAP = 4;

/**
 * Positions of a tree diagram `width` px wide: one row per depth (`rowH` apart), leaves in equal
 * slots from left to right, every parent centred over its two children. A box is as wide as its
 * text needs (`boxW`), kept inside [0, width]. When neighbours in a row would touch (a narrow
 * screen, a deep leaf-wise tree) the later box moves down to the next free place, below its parent
 * and clear of every other box, so labels always keep their full width.
 */
export function layoutTree(
  nodes: readonly TreeNodeView[],
  width: number,
  opts: { rowH: number; boxH: number; boxW: (node: TreeNodeView) => number },
): TreeLayout {
  const slots: number[] = Array(nodes.length).fill(0);
  const parent: number[] = Array(nodes.length).fill(-1);
  let next = 0;
  const place = (id: number): number => {
    const n = nodes[id];
    if (n.l === -1) {
      slots[id] = next++;
    } else {
      parent[n.l] = id;
      parent[n.r] = id;
      slots[id] = (place(n.l) + place(n.r)) / 2;
    }
    return slots[id];
  };
  place(0);
  const slotW = (width - PAD * 2) / Math.max(1, next);
  const byId = new Map<number, TreeBox>();
  const boxes: TreeBox[] = [];
  const order = [...nodes].sort((a, b) => a.depth - b.depth || slots[a.id] - slots[b.id]);
  for (const n of order) {
    const w = Math.max(1, Math.min(width, opts.boxW(n)));
    const x = Math.max(0, Math.min(width - w, PAD + (slots[n.id] + 0.5) * slotW - w / 2));
    const up = parent[n.id] >= 0 ? byId.get(parent[n.id])! : null;
    let y = Math.max(PAD + n.depth * opts.rowH, up ? up.y + opts.rowH : 0);
    for (;;) {
      const hit = boxes.filter(
        (o) => x < o.x + o.w + BOX_GAP && o.x < x + w + BOX_GAP && y < o.y + o.h + BOX_GAP && o.y < y + opts.boxH + BOX_GAP,
      );
      if (hit.length === 0) {
        break;
      }
      y = Math.max(...hit.map((o) => o.y + o.h)) + BOX_GAP;
    }
    const box: TreeBox = { id: n.id, x, y, w, h: opts.boxH, cx: x + w / 2 };
    byId.set(n.id, box);
    boxes.push(box);
  }
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { boxes: nodes.map((n) => byId.get(n.id)!), height: bottom + PAD };
}

/** Pixel geometry shared by `plan` and `draw`. */
interface Plan {
  width: number;
  height: number;
  wide: boolean;
  treeW: number;
  headY: number;
  tree: TreeLayout;
  treeTop: number;
  splitsY: number;
  captionY: number;
  captionLines: string[];
  plot: Rect;
  badgeR: number;
  badgeRows: number;
}

/**
 * Growth scene of the boosting settings page (Ders steps 6-7): the tree diagram on the left (nodes
 * by depth, split numbers, leaf values, one line per split under it) and the first residuals on the
 * right with the tree's steps and its thresholds as dashed lines. Narrow screens stack the two.
 */
export class GrowScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly headG: G;
  private readonly treeG: G;
  private readonly listG: G;
  private readonly plotG: G;
  private readonly axes: AxesLayer;
  private readonly dataG: G;
  private readonly cutG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(private readonly host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'tune-plot grow-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Regresyon ağacı ve ilk artıklar');
    this.headG = this.svg.append('g').attr('class', 'tg-heads');
    this.treeG = this.svg.append('g').attr('class', 'tg-tree');
    this.listG = this.svg.append('g').attr('class', 'tg-list');
    this.plotG = this.svg.append('g').attr('class', 'tg-plot');
    this.axes = new AxesLayer(this.plotG.append('g').attr('class', 'tg-axes'));
    this.dataG = this.plotG.append('g').attr('class', 'tg-data');
    this.cutG = this.plotG.append('g').attr('class', 'tg-cuts');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Geometry for `view` in a drawing `width` px wide and (at least) `minH` px tall. */
  private plan(g: GrowView, width: number, minH: number): Plan {
    const { tick, axis } = this.measure.fonts(this.mode);
    const gap = Math.round(tick * 0.45);
    const wide = width >= WIDE;
    // eight leaves need their room: the tree takes more of a wide stage than a small one
    const leaves = g.nodes.filter((n) => n.l === -1).length;
    const treeW = wide ? Math.floor(width * (leaves > 4 ? 0.56 : 0.46)) : width;
    const lineH = tick * 1.45;
    const headY = PAD + tick;
    const treeTop = PAD + lineH * g.head.length + gap;
    const boxH = tick * 2;
    const rows = Math.max(...g.nodes.map((n) => n.depth)) + 1;
    const below = lineH * (g.splits.length + 3) + PAD;
    const rowH = wide
      ? Math.max(boxH * 1.25, Math.min(boxH * 1.7, (minH - treeTop - below) / rows))
      : boxH * 1.5;
    // a box holds its label on one line: the bold text plus 6 px each side
    const boxW = (n: TreeNodeView): number => Math.ceil(this.measure.width(n.label, 'tick', tick) * 1.1) + 12;
    const tree = layoutTree(g.nodes, treeW, { rowH, boxH, boxW });
    const splitsY = treeTop + tree.height + tick;
    const captionLines = this.measure.wrap(g.caption, treeW - PAD * 2, 'tick', tick);
    const captionY = splitsY + lineH * g.splits.length + tick * 0.3;
    const treeBottom = captionY + lineH * captionLines.length + PAD;

    const yTickW = this.measure.maxWidth(g.yTicks.map(String), 'tick', tick);
    const badgeR = tick * 0.62;
    const badgeRows = 2;
    const plotLeft = (wide ? treeW + PAD : 0) + PAD + axis * 1.2 + gap + yTickW + gap;
    const plotTop = (wide ? 0 : treeBottom) + PAD + badgeR * 2 * badgeRows + gap;
    const below2 = gap + tick * 1.2 + gap + axis * 1.25 + PAD;
    const plotW = Math.max(60, width - plotLeft - PAD - tick);
    const plotH = wide
      ? Math.max(120, minH - plotTop - below2)
      : Math.max(160, Math.min(width * 0.6, 320));
    const plot: Rect = { left: plotLeft, top: plotTop, width: plotW, height: plotH };
    const plotBottom = plotTop + plotH + below2;
    const height = Math.max(minH, wide ? Math.max(treeBottom, plotBottom) : plotBottom);
    return { width, height, wide, treeW, headY, tree, treeTop, splitsY, captionY, captionLines, plot, badgeR, badgeRows };
  }

  /** Draws `v.grow`; `ms` > 0 animates the step line. */
  update(v: TuneView, ms: number): void {
    const g = v.grow;
    if (!g) {
      return;
    }
    this.interrupt();
    let width = this.w;
    let p = this.plan(g, width, this.h);
    if (p.height > this.h) {
      // the host will scroll: leave room for its scrollbar
      width = Math.max(1, this.w - SCROLLBAR);
      p = this.plan(g, width, this.h);
    }
    this.svg.attr('width', p.width).attr('height', p.height);
    const { tick, axis } = this.measure.fonts(this.mode);
    const gap = Math.round(tick * 0.45);
    const lineH = tick * 1.45;

    this.drawHead(g, p, lineH);
    this.drawTree(g, p, tick);
    this.drawList(g, p, lineH);
    this.drawScatter(g, p, tick, axis, gap, ms);
  }

  private drawHead(g: GrowView, p: Plan, lineH: number): void {
    this.headG
      .selectAll<SVGTextElement, string>('text.tg-head')
      .data(g.head)
      .join('text')
      .attr('class', (_, i) => `tg-head${i === 0 ? ' first' : ''}`)
      .attr('x', PAD)
      .attr('y', (_, i) => r1(p.headY + i * lineH))
      .text((d) => d);
  }

  private drawTree(g: GrowView, p: Plan, tick: number): void {
    const top = p.treeTop;
    const byId = new Map(p.tree.boxes.map((b) => [b.id, b]));
    const edges: { from: TreeBox; to: TreeBox }[] = [];
    for (const n of g.nodes) {
      if (n.l !== -1) {
        edges.push({ from: byId.get(n.id)!, to: byId.get(n.l)! }, { from: byId.get(n.id)!, to: byId.get(n.r)! });
      }
    }
    this.treeG
      .selectAll<SVGPathElement, (typeof edges)[number]>('path.tg-edge')
      .data(edges)
      .join('path')
      .attr('class', 'tg-edge')
      .attr('d', (e) => `M${r1(e.from.cx)},${r1(top + e.from.y + e.from.h)}L${r1(e.to.cx)},${r1(top + e.to.y)}`);

    const nodes = this.treeG
      .selectAll<SVGGElement, TreeNodeView>('g.tg-node')
      .data(g.nodes, (d) => d.id)
      .join((enter) => {
        const n = enter.append('g');
        n.append('rect').attr('class', 'tg-box').attr('rx', 6);
        n.append('text').attr('class', 'tg-label').attr('text-anchor', 'middle');
        return n;
      })
      .attr('class', (d) => `tg-node ${d.leaf ? 'leaf' : 'internal'}`)
      .attr('data-depth', (d) => d.depth);
    nodes.each((d, i, els) => {
      const b = byId.get(d.id)!;
      const el = select(els[i]);
      el.select('rect')
        .attr('x', r1(b.x))
        .attr('y', r1(top + b.y))
        .attr('width', r1(b.w))
        .attr('height', r1(b.h));
      const t = el.select<SVGTextElement>('text.tg-label').attr('x', r1(b.cx));
      const midY = top + b.y + b.h / 2;
      t.selectAll('tspan')
        .data([d.label])
        .join('tspan')
        .attr('x', r1(b.cx))
        .attr('y', r1(midY + tick * 0.35))
        .text((s) => s);
    });

    // split number badges on the top-left corner of the internal nodes
    const badges = g.nodes.filter((n) => !n.leaf);
    const badgeSel = this.treeG
      .selectAll<SVGGElement, TreeNodeView>('g.tg-order')
      .data(badges, (d) => d.id)
      .join((enter) => {
        const o = enter.append('g').attr('class', 'tg-order');
        o.append('circle');
        o.append('text').attr('text-anchor', 'middle');
        return o;
      });
    badgeSel.each((d, i, els) => {
      const b = byId.get(d.id)!;
      const cx = b.x + p.badgeR + 1;
      const cy = top + b.y;
      const el = select(els[i]);
      el.select('circle').attr('cx', r1(cx)).attr('cy', r1(cy)).attr('r', r1(p.badgeR));
      el.select('text').attr('x', r1(cx)).attr('y', r1(cy + tick * 0.35)).text(String(d.order));
    });
  }

  private drawList(g: GrowView, p: Plan, lineH: number): void {
    this.listG
      .selectAll<SVGTextElement, string>('text.tg-split')
      .data(g.splits)
      .join('text')
      .attr('class', 'tg-split')
      .attr('x', PAD)
      .attr('y', (_, i) => r1(p.splitsY + i * lineH))
      .text((d) => d);
    this.listG
      .selectAll<SVGTextElement, string>('text.tg-caption')
      .data(p.captionLines)
      .join('text')
      .attr('class', 'tg-caption')
      .attr('x', PAD)
      .attr('y', (_, i) => r1(p.captionY + (i + 1) * lineH))
      .text((d) => d);
  }

  private drawScatter(g: GrowView, p: Plan, tick: number, axis: number, gap: number, ms: number): void {
    const plot = p.plot;
    const sc = fitViewport({ x: X_DOMAIN, y: g.y }, plot, false);
    const bottom = plot.top + plot.height;
    const yTickW = this.measure.maxWidth(g.yTicks.map(String), 'tick', tick);
    this.axes.draw(
      sc,
      plot,
      {
        xTickCount: 6,
        yTickCount: 4,
        xTicks: [0, 2, 4, 6, 8, 10],
        yTicks: g.yTicks,
        xTickY: bottom + gap + tick * 0.9,
        yTickX: plot.left - gap,
        xTitle: { x: plot.left + plot.width / 2, y: bottom + gap + tick * 1.2 + gap + axis * 0.95, text: 'x' },
        yTitle: { x: plot.left - gap - yTickW - gap - axis * 0.3, y: plot.top + plot.height / 2, lines: ['ilk artık'] },
      },
      0,
      'grow',
    );
    const r = Math.max(3, tick * 0.28);
    this.dataG
      .selectAll<SVGCircleElement, [number, number]>('circle.tg-pt')
      .data(g.points)
      .join('circle')
      .attr('class', 'tg-pt')
      .attr('r', r)
      .attr('cx', (d) => r1(sc.x(d[0])))
      .attr('cy', (d) => r1(sc.y(d[1])));
    const d = stepPath(g.steps, sc.x, sc.y);
    const step = this.dataG
      .selectAll<SVGPathElement, string>('path.tg-step')
      .data([d])
      .join('path')
      .attr('class', 'tg-step');
    tr(step, 'line', ms).attr('d', (s) => s);

    // thresholds: dashed lines with their split number on a badge above the frame; neighbours alternate rows
    const cuts = [...g.cuts].sort((a, b) => a.t - b.t);
    const rowOf: number[] = [];
    const lastX = [-Infinity, -Infinity];
    cuts.forEach((c, i) => {
      const x = sc.x(c.t);
      let row = 0;
      while (row < p.badgeRows - 1 && x - lastX[row] < p.badgeR * 2.3) {
        row++;
      }
      lastX[row] = x;
      rowOf[i] = row;
    });
    this.cutG
      .selectAll<SVGLineElement, (typeof cuts)[number]>('line.tg-cut')
      .data(cuts)
      .join('line')
      .attr('class', 'tg-cut')
      .attr('x1', (c) => r1(sc.x(c.t)))
      .attr('x2', (c) => r1(sc.x(c.t)))
      .attr('y1', (_, i) => r1(plot.top - p.badgeR * (2 * (p.badgeRows - 1 - rowOf[i]))))
      .attr('y2', r1(bottom));
    const badge = this.cutG
      .selectAll<SVGGElement, (typeof cuts)[number]>('g.tg-cut-badge')
      .data(cuts)
      .join((enter) => {
        const o = enter.append('g').attr('class', 'tg-cut-badge');
        o.append('circle');
        o.append('text').attr('text-anchor', 'middle');
        return o;
      });
    badge.each((c, i, els) => {
      const cx = sc.x(c.t);
      const cy = plot.top - p.badgeR * (1 + 2 * (p.badgeRows - 1 - rowOf[i]));
      const el = select(els[i]);
      el.select('circle').attr('cx', r1(cx)).attr('cy', r1(cy)).attr('r', r1(p.badgeR));
      el.select('text').attr('x', r1(cx)).attr('y', r1(cy + tick * 0.35)).text(String(c.order));
    });
  }
}
