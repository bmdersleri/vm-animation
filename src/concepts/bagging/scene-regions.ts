import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { GridLayer, type GridSize } from '../../core/plot/grid-layer';
import { MARK, NAVY, TEXT, WHITE, r1, trianglePath } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport, type Rect, type Scales } from '../../core/plot/viewport';
import { DOMAIN } from '../karar-agaci/data';
import { BOOTS, CUSTOMERS, SINGLE, type Tree } from '../topluluk/data';
import { predictTree } from '../topluluk/tree';
import { votes, voteFill } from '../topluluk/vote';
import type { BaggingView, RegionsView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Region tint opacity per mode (a projector washes light tints out, so Ders is stronger). */
const REGION_ALPHA: Record<Mode, number> = { lab: 0.12, ders: 0.22 };
/** The vote map needs a stronger tint: its middle shades are neutral. */
const VOTE_ALPHA: Record<Mode, number> = { lab: 0.4, ders: 0.55 };
/** Region and boundary cells are this many CSS px wide (GridLayer's default). */
const CELL_PX = 6;
const X_TICKS = [0, 20, 40, 60];
const Y_TICKS = [0, 1, 2, 3, 4, 5];

/** Mixes two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number): number => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const hex = (i: number): string =>
    Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(0)}${hex(1)}${hex(2)}`;
}

/** The 11 vote shades: Kaldı teal (0 votes), neutral (half), Ayrıldı orange (all votes). */
export const VOTE_COLORS: readonly string[] = Array.from({ length: 11 }, (_, i) =>
  i <= 5 ? mix(MARK[0], '#E6EAEE', i / 5) : mix('#E6EAEE', MARK[1], (i - 5) / 5),
);

/**
 * GridLayer fill for one tree's regions: each cell gets the tree's class at its
 * centre (x over the scale's x domain, row 0 = the top of the plot).
 */
export function treeFill(tree: Tree, sc: Scales): (g: GridSize, out: Uint8Array) => void {
  const [x0, x1] = sc.x.domain();
  const [y0, y1] = sc.y.domain();
  return (g, out) => {
    const at: [number, number] = [0, 0];
    let i = 0;
    for (let r = 0; r < g.rows; r++) {
      at[1] = y1 - ((r + 0.5) / g.rows) * (y1 - y0);
      for (let c = 0; c < g.cols; c++) {
        at[0] = x0 + ((c + 0.5) / g.cols) * (x1 - x0);
        out[i] = predictTree(tree, at);
        i++;
      }
    }
  };
}

/**
 * The majority boundary of the first `m` trees as one SVG path: the cell edges
 * of a `cols` × `rows` grid over `plot` where the majority class changes
 * (a tie goes to Kaldı). Runs of edges are merged into single segments.
 */
export function voteBoundary(m: number, sc: Scales, plot: Rect, cols: number, rows: number): string {
  const [x0, x1] = sc.x.domain();
  const [y0, y1] = sc.y.domain();
  const maj = new Uint8Array(cols * rows);
  const at: [number, number] = [0, 0];
  for (let r = 0; r < rows; r++) {
    at[1] = y1 - ((r + 0.5) / rows) * (y1 - y0);
    for (let c = 0; c < cols; c++) {
      at[0] = x0 + ((c + 0.5) / cols) * (x1 - x0);
      maj[r * cols + c] = votes(at, m) * 2 > m ? 1 : 0;
    }
  }
  const cw = plot.width / cols;
  const ch = plot.height / rows;
  let d = '';
  // vertical edges between column c - 1 and c, merged over consecutive rows
  for (let c = 1; c < cols; c++) {
    let start = -1;
    for (let r = 0; r <= rows; r++) {
      const edge = r < rows && maj[r * cols + c] !== maj[r * cols + c - 1];
      if (edge && start < 0) start = r;
      if (!edge && start >= 0) {
        d += `M${r1(plot.left + c * cw)},${r1(plot.top + start * ch)}V${r1(plot.top + r * ch)}`;
        start = -1;
      }
    }
  }
  // horizontal edges between row r - 1 and r, merged over consecutive columns
  for (let r = 1; r < rows; r++) {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const edge = c < cols && maj[r * cols + c] !== maj[(r - 1) * cols + c];
      if (edge && start < 0) start = c;
      if (!edge && start >= 0) {
        d += `M${r1(plot.left + start * cw)},${r1(plot.top + r * ch)}H${r1(plot.left + c * cw)}`;
        start = -1;
      }
    }
  }
  return d;
}

/** Where the plots, titles and axis labels sit for one size, panel count and mode. */
export interface RegionGeometry {
  plots: Rect[];
  /** Height of the legend row at the top. */
  topRow: number;
  /** Baseline of the shared x axis title and the x of the shared y axis title. */
  xTitleY: number;
  yTitleX: number;
  xTickY: number;
  yTickX: number;
  gap: number;
  /** Baselines of the panel title lines (panels only). */
  titleY: number;
  lineH: number;
}

/**
 * Plot rectangles for `count` panels side by side (equal widths; only the first
 * has the y tick labels to its left) under a legend row and `titleLines` lines
 * of panel title; the axis titles are shared below and left.
 */
export function regionGeometry(
  w: number,
  h: number,
  count: number,
  f: { tick: number; axis: number },
  titleLines: number,
): RegionGeometry {
  const pad = 8;
  const gap = Math.max(5, Math.round(f.tick * 0.45));
  const gapP = Math.max(8, Math.round(f.tick * 0.8));
  const left = pad + f.axis * 1.3 + gap + f.tick * 0.8 + gap;
  const right = pad + f.tick * 0.8;
  const lineH = f.tick * 1.45;
  const topRow = f.tick * 1.7;
  const titleBlock = count > 1 ? titleLines * lineH + 6 : 0;
  const top = topRow + titleBlock;
  const bottom = gap + f.tick * 1.2 + gap + f.axis * 1.25 + pad;
  const height = Math.max(40, h - top - bottom);
  const width = Math.max(30, (w - left - right - (count - 1) * gapP) / count);
  const plots: Rect[] = Array.from({ length: count }, (_, i) => ({
    left: left + i * (width + gapP),
    top,
    width,
    height,
  }));
  const plotBottom = top + height;
  const xTickY = plotBottom + gap + f.tick * 0.9;
  return {
    plots,
    topRow,
    xTitleY: xTickY + f.tick * 0.3 + gap + f.axis * 0.95,
    yTitleX: pad + f.axis * 0.7,
    xTickY,
    yTickX: left - gap,
    gap,
    titleY: topRow + lineH * 0.8,
    lineH,
  };
}

/** What one panel draws. */
interface PanelSpec {
  /** Tree whose regions tint the panel; null for the vote map. */
  tree: Tree | null;
  key: string;
  /** Draw counts of the customers (bootstrap panels); null = every customer once. */
  counts: readonly number[] | null;
  title: string[];
}

interface Panel {
  g: G;
  axes: AxesLayer;
  pts: G;
  overlay: G;
  boundary: Selection<SVGPathElement, unknown, null, undefined>;
}

/** Marker path of a customer: circle for Kaldı, triangle for Ayrıldı. */
function markPath(y: 0 | 1, r: number): string {
  if (y === 1) return trianglePath(r);
  return `M${r1(-r)},0a${r1(r)},${r1(r)} 0 1,0 ${r1(2 * r)},0a${r1(r)},${r1(r)} 0 1,0 ${r1(-2 * r)},0`;
}

/**
 * Region scene (steps 5-7): the Chapter 5 scatter with a tree's decision
 * regions (a canvas GridLayer under the SVG). One panel for the single tree
 * and for the vote map, three small panels for three bootstrap trees. Bootstrap
 * panels size each customer by its draw count and draw undrawn (OOB)
 * customers hollow and dashed. The vote map tints each cell by the Ayrıldı vote
 * share of the first M trees, draws the majority boundary and marks one customer.
 */
export class RegionScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly panelsG: G;
  private readonly panels: Panel[] = [];
  private readonly grids: GridLayer[] = [];
  private readonly voteGrid: GridLayer;
  private readonly canvases: HTMLCanvasElement[] = [];
  private readonly measure: TextMeasure;
  private readonly legend: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly head: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly ramp: G;
  private readonly xTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly yTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  /** Plot size each canvas was last sized to (index = canvas). */
  private readonly canvasSize: string[] = ['', '', '', ''];

  constructor(private readonly host: HTMLElement) {
    const doc = host.ownerDocument;
    const mk = (): HTMLCanvasElement => {
      const c = doc.createElement('canvas');
      c.className = 'bagging-regions-canvas';
      c.style.position = 'absolute';
      host.append(c);
      this.canvases.push(c);
      return c;
    };
    for (let i = 0; i < 3; i++) {
      this.grids.push(new GridLayer(mk(), MARK, REGION_ALPHA[this.mode], { cellPx: CELL_PX, measure: 'bagging-regions' }));
    }
    this.voteGrid = new GridLayer(mk(), VOTE_COLORS, VOTE_ALPHA[this.mode], { cellPx: CELL_PX, measure: 'bagging-votes' });
    const root = doc.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'bagging-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Müşteri dağılım grafiği: ağaç bölgeleri ve oy haritası');
    this.panelsG = this.svg.append('g').attr('class', 'panels');
    for (let i = 0; i < 3; i++) {
      const g = select(doc.createElementNS(NS, 'g') as SVGGElement).attr('class', 'panel');
      const axes = new AxesLayer(g.append('g').attr('class', 'panel-axes'));
      const boundary = g.append('path').attr('class', 'vote-boundary').attr('fill', 'none').attr('stroke', NAVY);
      const pts = g.append('g').attr('class', 'pts');
      const overlay = g.append('g').attr('class', 'overlay');
      this.panels.push({ g, axes, boundary, pts, overlay });
    }
    this.head = this.svg.append('text').attr('class', 'region-title axis-title');
    this.legend = this.svg.append('text').attr('class', 'region-legend').attr('text-anchor', 'end');
    this.ramp = this.svg.append('g').attr('class', 'vote-ramp');
    this.xTitle = this.svg.append('text').attr('class', 'axis-title shared-x').attr('text-anchor', 'middle');
    this.yTitle = this.svg.append('text').attr('class', 'axis-title shared-y').attr('text-anchor', 'middle');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    if (mode !== this.mode) {
      this.mode = mode;
      for (const g of this.grids) g.setAlpha(REGION_ALPHA[mode]);
      this.voteGrid.setAlpha(VOTE_ALPHA[mode]);
    }
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
    for (const c of this.canvases) c.remove();
  }

  /** Draws the single tree, the three bootstrap panels or the vote map for `v.regions`. */
  update(v: BaggingView, ms: number): void {
    const r = v.regions;
    if (!r) return;
    this.interrupt();
    const specs = this.specs(r);
    const f = this.measure.fonts(this.mode);
    const count = specs.length;
    // panel titles wrap to the panel width, so the title block's height depends on the widths
    const widthOnly = regionGeometry(this.w, this.h, count, f, 0).plots[0].width;
    const wrapped = specs.map((s) => this.wrapTitle(s.title, widthOnly + 6, f.tick));
    const lines = Math.max(0, ...wrapped.map((t) => t.length));
    const geo = regionGeometry(this.w, this.h, count, f, lines);

    this.panelsG.node()!.replaceChildren(...this.panels.slice(0, count).map((p) => p.g.node()!));
    this.drawShared(r, geo, f);
    specs.forEach((spec, i) => this.drawPanel(i, spec, r, geo, wrapped[i], f, ms));
    // unused canvases are cleared
    for (let i = r.layout === 'panels' ? 3 : 1; i < 3; i++) {
      this.grids[i].update(null, geo.plots[0], () => {});
    }
    if (r.layout === 'vote') this.grids[0].update(null, geo.plots[0], () => {});
    else this.voteGrid.update(null, geo.plots[0], () => {});
  }

  private specs(r: RegionsView): PanelSpec[] {
    if (r.layout === 'single') return [{ tree: SINGLE, key: 'single', counts: null, title: [] }];
    if (r.layout === 'vote') return [{ tree: null, key: `vote${r.m}`, counts: null, title: [] }];
    return r.trees.map((k, i) => ({
      tree: BOOTS[k].tree,
      key: `boot${k}`,
      counts: BOOTS[k].counts,
      title: [`Bootstrap ${k + 1}`, r.titles[i]],
    }));
  }

  /** Title lines: the first as is, the rest wrapped to `maxW`. */
  private wrapTitle(title: string[], maxW: number, tick: number): string[] {
    if (title.length === 0) return [];
    const rest = title.slice(1).flatMap((t) => this.measure.wrap(t, maxW, 'tick', tick));
    return [title[0], ...rest];
  }

  private drawShared(r: RegionsView, geo: RegionGeometry, f: { tick: number; axis: number }): void {
    const first = geo.plots[0];
    const last = geo.plots[geo.plots.length - 1];
    this.xTitle
      .attr('x', r1((first.left + last.left + last.width) / 2))
      .attr('y', r1(geo.xTitleY))
      .text('Sözleşme süresi (ay)');
    this.yTitle
      .attr('transform', `translate(${r1(geo.yTitleX)},${r1(first.top + first.height / 2)}) rotate(-90)`)
      .text('Şikâyet sayısı');

    const vote = r.layout === 'vote';
    const panels = r.layout === 'panels';
    const y0 = geo.topRow * 0.78;
    this.head
      .attr('x', r1(first.left))
      .attr('y', r1(y0))
      .attr('display', panels ? 'none' : null)
      .text(vote ? `Oy haritası: ${r.m} ağaç` : 'Tek ağaç: bölgeler');
    const items: [string, string][] = [
      ['● Kaldı', TEXT[0]],
      ['▲ Ayrıldı', TEXT[1]],
    ];
    if (panels) items.push(['○ OOB', NAVY]);
    this.legend.attr('x', r1(last.left + last.width)).attr('y', r1(y0));
    this.legend
      .selectAll<SVGTSpanElement, [string, string]>('tspan')
      .data(items)
      .join('tspan')
      .attr('fill', (d) => d[1])
      .attr('dx', (_, i) => (i ? '0.9em' : null))
      .text((d) => d[0]);

    // the vote shade key sits right of the heading when there is room before the legend
    const sw = Math.max(10, Math.round(f.tick * 0.9));
    const headW = this.measure.width(this.head.text(), 'axis-title', f.axis);
    const legendW = this.measure.width(items.map((d) => d[0]).join('  '), 'tick', f.tick);
    const rampX = first.left + headW + 18;
    const fits = vote && rampX + sw * 11 + 8 < last.left + last.width - legendW - 12;
    this.ramp.attr('display', fits ? null : 'none');
    this.ramp
      .selectAll<SVGRectElement, string>('rect')
      .data(vote ? VOTE_COLORS : [])
      .join('rect')
      .attr('x', (_, i) => r1(rampX + i * sw))
      .attr('y', r1(y0 - sw * 0.85))
      .attr('width', sw)
      .attr('height', sw)
      .attr('fill', (d) => d)
      .attr('fill-opacity', VOTE_ALPHA[this.mode] + 0.2);
  }

  private drawPanel(
    i: number,
    spec: PanelSpec,
    r: RegionsView,
    geo: RegionGeometry,
    title: string[],
    f: { tick: number; axis: number },
    ms: number,
  ): void {
    const plot = geo.plots[i];
    const panel = this.panels[i];
    const sc = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] }, plot, false);
    panel.g.classed('no-y', i > 0);
    panel.axes.draw(
      sc,
      plot,
      {
        xTickCount: 4,
        yTickCount: 6,
        // the right-hand 60 of a panel would run into the next panel's 0
        xTicks: i < geo.plots.length - 1 ? X_TICKS.slice(0, -1) : X_TICKS,
        yTicks: Y_TICKS,
        xTickY: geo.xTickY,
        yTickX: geo.yTickX,
        xTitle: { x: 0, y: 0, text: '' },
        yTitle: { x: 0, y: 0, lines: [''] },
      },
      ms,
      'churn',
    );

    // canvas under the SVG, sized to the plot
    const idx = spec.tree ? i : 3;
    const canvas = this.canvases[idx];
    const grid = spec.tree ? this.grids[i] : this.voteGrid;
    canvas.style.left = `${r1(plot.left)}px`;
    canvas.style.top = `${r1(plot.top)}px`;
    const size = `${Math.round(plot.width)}x${Math.round(plot.height)}`;
    if (this.canvasSize[idx] !== size) {
      grid.resize(plot.width, plot.height);
      this.canvasSize[idx] = size;
    }
    const local: Rect = { left: 0, top: 0, width: plot.width, height: plot.height };
    const scLocal = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] }, local, false);
    grid.update(spec.key, local, spec.tree ? treeFill(spec.tree, scLocal) : voteFill(r.m, scLocal));

    // majority boundary of the vote map
    if (spec.tree) {
      panel.boundary.attr('display', 'none');
    } else {
      const cols = Math.max(1, Math.round(plot.width / CELL_PX));
      const rows = Math.max(1, Math.round(plot.height / CELL_PX));
      panel.boundary
        .attr('display', null)
        .attr('stroke-width', this.mode === 'ders' ? 3 : 2.5)
        .attr('d', voteBoundary(r.m, sc, plot, cols, rows));
    }

    this.drawTitle(panel, title, plot, geo);
    this.drawPoints(panel, spec, sc, plot, f.tick, i);
    this.drawPick(panel, spec, r, sc, plot, f.tick);
  }

  private drawTitle(panel: Panel, title: string[], plot: Rect, geo: RegionGeometry): void {
    const t = panel.g
      .selectAll<SVGTextElement, string[]>('text.panel-title')
      .data(title.length ? [title] : [])
      .join('text')
      .attr('class', 'panel-title')
      .attr('x', r1(plot.left))
      .attr('y', r1(geo.topRow + geo.lineH * 0.8));
    t.selectAll<SVGTSpanElement, string>('tspan')
      .data((d) => d)
      .join('tspan')
      .attr('class', (_, k) => (k === 0 ? 'panel-name' : 'panel-root'))
      .attr('x', r1(plot.left))
      .attr('dy', (_, k) => (k === 0 ? null : r1(geo.lineH)))
      .text((d, k, all) => (k < all.length - 1 ? `${d} ` : d));
  }

  private drawPoints(panel: Panel, spec: PanelSpec, sc: Scales, plot: Rect, tick: number, panelIndex: number): void {
    const small = spec.counts !== null;
    const base = Math.min(small ? Math.max(3, tick * 0.32) : Math.max(5, Math.min(9, tick * 0.5)), plot.width / 30);
    const data = CUSTOMERS.map((c, i) => {
      const count = spec.counts ? spec.counts[i] : 1;
      return { c, i, count, r: count === 0 ? base : base * Math.sqrt(count) };
    });
    panel.pts
      .selectAll<SVGPathElement, (typeof data)[number]>('path.pt')
      .data(data, (d) => d.i)
      .join('path')
      .attr('class', (d) => `pt ${d.c.y === 1 ? 'ayrildi' : 'kaldi'}${d.count === 0 ? ' oob' : ''}`)
      .attr('data-i', (d) => d.i)
      .attr('data-count', (d) => d.count)
      .attr('data-r', (d) => r1(d.r))
      .attr('data-panel', panelIndex)
      .attr('transform', (d) => `translate(${r1(sc.x(d.c.t))},${r1(sc.y(d.c.c + d.c.jy))})`)
      .attr('d', (d) => markPath(d.c.y, d.r))
      .attr('fill', (d) => (d.count === 0 ? 'none' : MARK[d.c.y]))
      .attr('stroke', (d) => (d.count === 0 ? TEXT[d.c.y] : spec.tree ? WHITE : NAVY))
      .attr('stroke-width', (d) => (d.count === 0 ? 2 : 1.2))
      .attr('stroke-dasharray', (d) => (d.count === 0 ? '3 2' : null));
  }

  /** The marked customer of the vote map: a ring and the vote text beside it. */
  private drawPick(panel: Panel, spec: PanelSpec, r: RegionsView, sc: Scales, plot: Rect, tick: number): void {
    const pick = spec.tree || r.layout !== 'vote' ? null : r.pick;
    const c = pick ? CUSTOMERS[pick.index] : null;
    const px = c ? sc.x(c.t) : 0;
    const py = c ? sc.y(c.c + c.jy) : 0;
    const ring = Math.max(5, Math.min(9, tick * 0.5)) + 6;
    panel.overlay
      .selectAll<SVGCircleElement, unknown>('circle.pick-ring')
      .data(pick ? [pick] : [])
      .join('circle')
      .attr('class', 'pick-ring')
      .attr('fill', 'none')
      .attr('stroke', NAVY)
      .attr('stroke-width', 3)
      .attr('r', r1(ring))
      .attr('cx', r1(px))
      .attr('cy', r1(py));
    const label = pick
      ? `${pick.m} ağaç: ${pick.ayrildi} Ayrıldı oyu → ${pick.verdict === 'berabere' ? 'berabere → Kaldı' : pick.verdict}`
      : '';
    const w = pick ? this.measure.width(label, 'tick', tick) : 0;
    const right = plot.left + plot.width - 4;
    const startFits = px + ring + 8 + w <= right;
    const above = py - ring - 6 >= plot.top + tick;
    overlayText(panel.overlay, pick ? label : null)
      .attr('text-anchor', startFits ? 'start' : 'end')
      .attr('x', r1(startFits ? px + ring + 8 : px - ring - 8))
      .attr('y', r1(above ? py - ring * 0.4 : py + ring + tick));
  }
}

/** The vote callout text (one element, removed when there is no label). */
function overlayText(g: G, label: string | null): Selection<SVGTextElement, string, SVGGElement, unknown> {
  return g
    .selectAll<SVGTextElement, string>('text.vote-callout')
    .data(label === null ? [] : [label])
    .join('text')
    .attr('class', 'vote-callout tick')
    .text((d) => d);
}
