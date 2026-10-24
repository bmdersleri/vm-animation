import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { formatNumber as f } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { heatColor, type HeatCell, type SearchView, type TuneView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Outer padding (px). */
const PAD = 8;
/** Width the vertical scrollbar of a too-tall host takes. */
const SCROLLBAR = 16;
/** Opacity of the full surface under the trial cells. */
const SURFACE_OPACITY = 0.4;
const COLS = 9;
const ROWS = 6;

export interface HeatBox {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HeatLayout {
  cells: HeatBox[];
  left: number;
  top: number;
  cw: number;
  ch: number;
  /** Right edge (text-anchor end) of the row labels. */
  rowLabelX: number;
  /** Column labels stand in one row, or alternate between two when the cells are narrow. */
  colLabelRows: 1 | 2;
  lineH: number;
  bestY: number;
  legendY: number;
  noteY: number;
  /** Total height: the cells plus the best line, the legend and the note. */
  height: number;
}

/**
 * Geometry of the 6 x 9 heatmap in a `w` x `h` area. The cells share the width equally (their height
 * follows the free height, at least a text line and at most 1,1 x the width); the column labels
 * alternate between two rows when one cell is narrower than a label. Everything stays inside [0, w].
 */
export function layoutHeat(o: { w: number; h: number; tick: number; axis: number; rowLabelW: number; colLabelW: number }): HeatLayout {
  const { w, h, tick, axis } = o;
  const gap = Math.round(tick * 0.45);
  const left = PAD + axis * 1.2 + gap + o.rowLabelW + gap;
  const cw = Math.max(1, (w - left - PAD) / COLS);
  const colLabelRows = cw >= o.colLabelW + 4 ? 1 : 2;
  const lineH = tick * 1.5;
  const top = PAD + axis * 1.2 + gap + colLabelRows * tick * 1.25 + gap / 2;
  const below = gap + lineH + lineH * 1.3 + lineH + PAD;
  const ch = Math.max(tick * 1.9, Math.min(cw * 1.1, (h - top - below) / ROWS));
  const cells: HeatBox[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push({ row, col, x: left + col * cw, y: top + row * ch, w: cw, h: ch });
    }
  }
  const gridBottom = top + ROWS * ch;
  const bestY = gridBottom + gap + tick;
  const legendY = bestY + lineH * 0.5;
  const noteY = legendY + lineH * 1.3 + tick * 0.6;
  return {
    cells,
    left,
    top,
    cw,
    ch,
    rowLabelX: left - gap,
    colLabelRows,
    lineH,
    bestY,
    legendY,
    noteY,
    height: Math.max(h, noteY + PAD),
  };
}

let uid = 0;

/**
 * Search scene of the boosting settings page (Ders steps 9-10): the 6 x 9 depth-by-rate heatmap.
 * Untried cells are grey; tried cells carry the AUC tone and their trial number; the best tried cell
 * is framed; the full surface fades in under them when the view asks for it. Links (step 10) sit
 * under the drawing as plain HTML.
 */
export class SearchScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly baseG: G;
  private readonly surfG: G;
  private readonly triedG: G;
  private readonly numG: G;
  private readonly frameG: G;
  private readonly labelG: G;
  private readonly legendG: G;
  private readonly links: HTMLDivElement;
  private readonly measure: TextMeasure;
  private readonly gradId = `hm-grad-${uid++}`;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(private readonly host: HTMLElement) {
    const doc = host.ownerDocument;
    const root = doc.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'tune-plot search-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Derinlik ve öğrenme oranına göre çapraz doğrulama AUC ısı haritası');
    this.baseG = this.svg.append('g').attr('class', 'hm-bases');
    this.surfG = this.svg.append('g').attr('class', 'hm-surfaces');
    this.triedG = this.svg.append('g').attr('class', 'hm-trials');
    this.numG = this.svg.append('g').attr('class', 'hm-nums');
    this.frameG = this.svg.append('g').attr('class', 'hm-frames');
    this.labelG = this.svg.append('g').attr('class', 'hm-labels');
    this.legendG = this.svg.append('g').attr('class', 'hm-legend');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.links = doc.createElement('div');
    this.links.className = 'tune-links';
    host.append(this.links);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('surf');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
    this.links.remove();
  }

  /** Draws `v.search`; `ms` > 0 fades the surface in or out. */
  update(v: TuneView, ms: number): void {
    const s = v.search;
    if (!s) {
      return;
    }
    this.interrupt();
    const { tick, axis } = this.measure.fonts(this.mode);
    const lineH = tick * 1.5;
    // the links stay under the drawing: two wrapped lines at most
    const linksH = s.links.length > 0 ? Math.ceil(lineH * 2 + 8) : 0;
    this.links.style.minHeight = `${linksH}px`;
    const rowLabelW = this.measure.maxWidth(s.rowLabels, 'tick', tick);
    const colLabelW = this.measure.maxWidth(s.colLabels, 'tick', tick);
    const avail = Math.max(1, this.h - linksH);
    let width = this.w;
    let lay = layoutHeat({ w: width, h: avail, tick, axis, rowLabelW, colLabelW });
    if (lay.height + linksH > this.h) {
      // the host will scroll: leave room for its scrollbar
      width = Math.max(1, this.w - SCROLLBAR);
      lay = layoutHeat({ w: width, h: avail, tick, axis, rowLabelW, colLabelW });
    }
    this.svg.attr('width', width).attr('height', Math.ceil(lay.height));
    this.drawCells(s, lay, tick, ms);
    this.drawLabels(s, lay, tick, axis);
    this.drawLegend(s, lay, tick, width);
    this.drawLinks(s);
  }

  private drawCells(s: SearchView, lay: HeatLayout, tick: number, ms: number): void {
    const box = (c: HeatCell): HeatBox => lay.cells[c.cell];
    const place = <E extends SVGElement>(sel: Selection<E, HeatCell, SVGGElement, unknown>): Selection<E, HeatCell, SVGGElement, unknown> =>
      sel
        .attr('data-cell', (c) => c.cell)
        .attr('x', (c) => r1(box(c).x))
        .attr('y', (c) => r1(box(c).y))
        .attr('width', (c) => r1(box(c).w))
        .attr('height', (c) => r1(box(c).h));
    place(
      this.baseG
        .selectAll<SVGRectElement, HeatCell>('rect.hm-base')
        .data(s.cells, (c) => c.cell)
        .join('rect')
        .attr('class', 'hm-base'),
    );
    const surf = place(
      this.surfG
        .selectAll<SVGRectElement, HeatCell>('rect.hm-surface')
        .data(s.cells, (c) => c.cell)
        .join((enter) => enter.append('rect').attr('opacity', 0))
        .attr('class', 'hm-surface')
        .attr('fill', (c) => c.fill),
    );
    tr(surf, 'surf', ms).attr('opacity', s.showSurface ? SURFACE_OPACITY : 0);

    const tried = s.cells.filter((c) => c.order !== null).sort((a, b) => a.order! - b.order!);
    place(
      this.triedG
        .selectAll<SVGRectElement, HeatCell>('rect.hm-tried')
        .data(tried, (c) => c.cell)
        .join('rect')
        .attr('class', 'hm-tried')
        .attr('fill', (c) => c.fill),
    ).order();

    // trial number in the middle; the AUC under it when the cell is big enough
    const showAuc = lay.cw >= tick * 3.6 && lay.ch >= tick * 3.4;
    const nums = this.numG
      .selectAll<SVGTextElement, HeatCell>('text.hm-order')
      .data(tried, (c) => c.cell)
      .join('text')
      .attr('class', (c) => `hm-order${c.dark ? ' on-dark' : ''}`)
      .attr('data-cell', (c) => c.cell)
      .attr('text-anchor', 'middle')
      .attr('x', (c) => r1(box(c).x + box(c).w / 2))
      .attr('y', (c) => r1(box(c).y + box(c).h / 2 + (showAuc ? -tick * 0.15 : tick * 0.35)))
      .text((c) => String(c.order));
    nums.order();
    this.numG
      .selectAll<SVGTextElement, HeatCell>('text.hm-auc')
      .data(showAuc ? tried : [], (c) => c.cell)
      .join('text')
      .attr('class', (c) => `hm-auc${c.dark ? ' on-dark' : ''}`)
      .attr('text-anchor', 'middle')
      .attr('x', (c) => r1(box(c).x + box(c).w / 2))
      .attr('y', (c) => r1(box(c).y + box(c).h / 2 + tick * 1.15))
      .text((c) => f(c.auc, 3));

    place(
      this.frameG
        .selectAll<SVGRectElement, HeatCell>('rect.hm-best')
        .data(tried.filter((c) => c.best), (c) => c.cell)
        .join('rect')
        .attr('class', 'hm-best'),
    );
  }

  private drawLabels(s: SearchView, lay: HeatLayout, tick: number, axis: number): void {
    const gap = Math.round(tick * 0.45);
    const gridW = lay.cw * COLS;
    const rows = this.labelG
      .selectAll<SVGGElement, null>('g.hm-rows')
      .data([null])
      .join('g')
      .attr('class', 'hm-rows');
    rows
      .selectAll<SVGTextElement, string>('text')
      .data(s.rowLabels)
      .join('text')
      .attr('text-anchor', 'end')
      .attr('x', r1(lay.rowLabelX))
      .attr('y', (_, i) => r1(lay.top + (i + 0.5) * lay.ch + tick * 0.35))
      .text((d) => d);
    const cols = this.labelG
      .selectAll<SVGGElement, null>('g.hm-cols')
      .data([null])
      .join('g')
      .attr('class', 'hm-cols');
    cols
      .selectAll<SVGTextElement, string>('text')
      .data(s.colLabels)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('x', (_, i) => r1(lay.left + (i + 0.5) * lay.cw))
      .attr('y', (_, i) => {
        const row = lay.colLabelRows === 2 ? i % 2 : 0;
        return r1(lay.top - gap / 2 - gap * 0.5 - (lay.colLabelRows - 1 - row) * tick * 1.25);
      })
      .text((d) => d);
    const titles: { cls: string; text: string; x: number; y: number; rot: boolean }[] = [
      { cls: 'hm-title x', text: 'öğrenme oranı ν', x: lay.left + gridW / 2, y: PAD + axis * 0.95, rot: false },
      { cls: 'hm-title y', text: 'derinlik', x: PAD + axis * 0.8, y: lay.top + (lay.ch * ROWS) / 2, rot: true },
    ];
    this.labelG
      .selectAll<SVGTextElement, (typeof titles)[number]>('text.axis-title')
      .data(titles)
      .join('text')
      .attr('class', (t) => `axis-title ${t.cls}`)
      .attr('text-anchor', 'middle')
      .attr('transform', (t) => (t.rot ? `translate(${r1(t.x)},${r1(t.y)}) rotate(-90)` : null))
      .attr('x', (t) => (t.rot ? null : r1(t.x)))
      .attr('y', (t) => (t.rot ? null : r1(t.y)))
      .text((t) => t.text);
  }

  private drawLegend(s: SearchView, lay: HeatLayout, tick: number, width: number): void {
    const gap = Math.round(tick * 0.45);
    this.legendG
      .selectAll<SVGTextElement, string>('text.hm-best-text')
      .data([s.bestText])
      .join('text')
      .attr('class', 'hm-best-text')
      .attr('x', r1(lay.left))
      .attr('y', r1(lay.bestY))
      .text((d) => d);
    const minT = `AUC ${f(s.aucMin, 3)}`;
    const maxT = f(s.aucMax, 3);
    const minW = this.measure.width(minT, 'tick', tick);
    const maxW = this.measure.width(maxT, 'tick', tick);
    const room = width - PAD - lay.left - minW - maxW - gap * 2;
    const barW = Math.max(30, Math.min(150, room));
    const barH = tick * 0.9;
    const barY = lay.legendY + tick * 0.2;
    const defs = this.legendG
      .selectAll<SVGDefsElement, null>('defs')
      .data([null])
      .join('defs');
    const grad = defs
      .selectAll<SVGLinearGradientElement, null>('linearGradient')
      .data([null])
      .join('linearGradient')
      .attr('id', this.gradId);
    grad
      .selectAll<SVGStopElement, number>('stop')
      .data([0, 0.5, 1])
      .join('stop')
      .attr('offset', (t) => `${t * 100}%`)
      .attr('stop-color', (t) => heatColor(t));
    this.legendG
      .selectAll<SVGRectElement, null>('rect.hm-legend-bar')
      .data([null])
      .join('rect')
      .attr('class', 'hm-legend-bar')
      .attr('x', r1(lay.left + minW + gap))
      .attr('y', r1(barY))
      .attr('width', r1(barW))
      .attr('height', r1(barH))
      .attr('fill', `url(#${this.gradId})`);
    const ends = [
      { cls: 'hm-legend-min', text: minT, x: lay.left, anchor: 'start' },
      { cls: 'hm-legend-max', text: maxT, x: lay.left + minW + gap + barW + gap, anchor: 'start' },
    ];
    this.legendG
      .selectAll<SVGTextElement, (typeof ends)[number]>('text.hm-legend-end')
      .data(ends)
      .join('text')
      .attr('class', (d) => `hm-legend-end ${d.cls}`)
      .attr('text-anchor', (d) => d.anchor)
      .attr('x', (d) => r1(d.x))
      .attr('y', r1(barY + barH - tick * 0.05))
      .text((d) => d.text);
    this.legendG
      .selectAll<SVGTextElement, string>('text.hm-note')
      .data(s.showSurface ? ['soluk hücreler: sonradan ölçülen yüzey'] : [])
      .join('text')
      .attr('class', 'hm-note')
      .attr('x', r1(lay.left))
      .attr('y', r1(lay.noteY))
      .text((d) => d);
  }

  private drawLinks(s: SearchView): void {
    const doc = this.host.ownerDocument;
    this.links.replaceChildren(
      ...s.links.map((l) => {
        const a = doc.createElement('a');
        a.setAttribute('href', l.href);
        a.textContent = l.text;
        return a;
      }),
    );
    this.links.hidden = s.links.length === 0;
  }
}
