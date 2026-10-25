import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { NAVY, r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport } from '../../core/plot/viewport';
import { narrowTableHeight, PatternTable } from './pattern-table';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { CloudDot, CloudView, LimeView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Dots of step 3 (neutral) and the two ends of the step-4 colour ramp (light to dark navy: never orange or blue). */
export const NEUTRAL_DOT = '#8E9BAA';
const LOW_RGB = [191, 208, 228] as const;
const HIGH_RGB = [20, 54, 92] as const;

/** Colour of a model probability p in 0..1 on the navy ramp. */
export function dotColor(p: number): string {
  const t = Math.max(0, Math.min(1, p));
  const c = LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i] - lo) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Vertical room (px) the scene keeps: the root's top and bottom padding, the gap between stacked parts, the minimum plot. */
export const CLOUD_PAD_V = 16;
export const CLOUD_PAD_V_NARROW = 8;
export const CLOUD_GAP = 8;
export const CLOUD_MIN_PLOT = 150;
/** Legend height in tick-font heights, and the line height of the note. */
export const LEGEND_K = 1.7;
export const NOTE_LINE = 1.3;

/** Points of a five-pointed star of outer radius `r` around the origin. */
export function starPoints(r: number): string {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 === 0 ? r : r * 0.42;
    return `${r1(rad * Math.cos(a))},${r1(rad * Math.sin(a))}`;
  }).join(' ');
}

/**
 * Steps 3-4: the neighbourhood cloud on `AxesLayer` (tenure x MonthlyCharges), the quartile grid (`.bin-grid`,
 * the customer's cell shaded), `.cloud-dot`s (neutral in step 3, coloured by the model's p in step 4) and the
 * customer star `.cloud-star`. From step 4 the pattern table sits beside the plot (under it in one column).
 */
export class CloudScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly plotWrap: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly cellG: G;
  private readonly gridG: G;
  private readonly dotG: G;
  private readonly starG: G;
  private readonly legend: HTMLDivElement;
  private readonly note: HTMLParagraphElement;
  private readonly table: PatternTable;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'cloud-scene');
    this.plotWrap = el(doc, 'div', 'cloud-wrap');
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root).attr('class', 'cloud-plot').attr('role', 'img').attr('aria-label', 'Komşuluk bulutu: tenure ve MonthlyCharges');
    this.axes = new AxesLayer(this.svg.append('g').attr('class', 'cloud-axes'));
    this.cellG = this.svg.append('g').attr('class', 'cloud-cell');
    this.gridG = this.svg.append('g').attr('class', 'cloud-grid');
    this.dotG = this.svg.append('g').attr('class', 'cloud-dots');
    this.starG = this.svg.append('g').attr('class', 'cloud-stars');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.legend = el(doc, 'div', 'cloud-legend');
    const bar = el(doc, 'span', 'legend-bar');
    bar.style.background = `linear-gradient(to right, ${dotColor(0)}, ${dotColor(1)})`;
    this.legend.append(el(doc, 'span', 'legend-end', 'p düşük'), bar, el(doc, 'span', 'legend-end', 'p yüksek'));
    this.note = el(doc, 'p', 'cloud-note', 'TotalCharges çizilmedi; desen üç özelliği birlikte kullanır.');
    this.plotWrap.append(root, this.legend, this.note);
    this.table = new PatternTable(doc);
    this.root.append(this.plotWrap, this.table.root);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
    this.dotG.selectAll('*').interrupt('cloud');
  }

  destroy(): void {
    this.interrupt();
    this.table.destroy();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    const c = v.cloud;
    if (!c) {
      return;
    }
    this.root.dataset.part = c.part;
    const withTable = c.rows !== null;
    this.table.root.hidden = !withTable;
    if (c.rows) {
      this.table.update(c.rows);
    }
    this.draw(c, ms);
  }

  private draw(c: CloudView, ms: number): void {
    const narrow = this.w < NARROW;
    const fonts = this.measure.fonts(this.mode);
    const fs = fonts.tick;
    const afs = fonts.axis;
    const withTable = c.rows !== null;
    const width = Math.max(240, narrow ? this.w - 8 : withTable ? Math.floor(this.w * 0.5) - 12 : this.w - 24);
    // what sits around the plot: legend (step 4), note (not beside a narrow table) and, narrow, the table itself
    // a narrow stage drops the colour legend (the strip names the colour) to give the plot and table room
    const legendH = c.part === 'color' && !narrow ? Math.ceil(fs * LEGEND_K) : 0;
    this.legend.hidden = c.part !== 'color' || narrow;
    this.legend.style.height = legendH > 0 ? `${legendH}px` : '';
    const showNote = !(narrow && withTable);
    this.note.hidden = !showNote;
    this.note.style.lineHeight = String(NOTE_LINE);
    const noteLines = showNote ? this.measure.wrap(this.note.textContent ?? '', width - 4, 'tick', fs).length : 0;
    const noteH = Math.ceil(noteLines * fs * NOTE_LINE);
    const cellFs = this.measure.fontPx('pattern-cell', 12);
    const tableH = narrow && withTable ? narrowTableHeight(cellFs) : 0;
    const parts = [legendH, noteH].filter((h) => h > 0).length;
    const around = (narrow ? CLOUD_PAD_V_NARROW : CLOUD_PAD_V) + legendH + noteH + parts * CLOUD_GAP + (tableH > 0 ? tableH + CLOUD_GAP : 0);
    const room = Math.floor(this.h - around);
    const cap = narrow ? width * 0.95 : width * 0.8;
    const height = Math.round(Math.max(CLOUD_MIN_PLOT, Math.min(cap, room)));
    this.root.dataset.used = String(Math.ceil(height + around));
    // the y title runs along the left edge; two lines when the name is longer than the plot
    const yName = 'MonthlyCharges';
    const bottom = fs * 1.4 + afs * 1.6 + 6;
    const plotH0 = height - 8 - bottom;
    const split = this.measure.width(yName, 'axis-title', afs) > plotH0 - 8;
    const yLines = split ? ['Monthly', 'Charges'] : [yName];
    const left = Math.ceil(this.measure.width('000', 'tick', fs) + afs * (split ? 2.8 : 1.8) + 8);
    const top = 8;
    const plot = { left, top, width: width - left - 10, height: height - top - bottom };
    this.svg.attr('width', width).attr('height', height);
    const sc = fitViewport({ x: c.domainX, y: c.domainY }, plot, false);
    this.axes.draw(
      sc,
      plot,
      {
        xTickCount: Math.max(2, Math.floor(plot.width / (fs * 5))),
        yTickCount: Math.max(2, Math.floor(plot.height / (fs * 2.4))),
        xTickY: plot.top + plot.height + fs * 1.3,
        yTickX: plot.left - 6,
        xTitle: { x: plot.left + plot.width / 2, y: plot.top + plot.height + fs * 1.3 + afs * 1.35, text: 'tenure' },
        yTitle: { x: split ? afs * 1.3 : afs * 0.95, y: plot.top + plot.height / 2, lines: yLines },
      },
      ms,
      'cloud',
    );

    // the customer's cell and the quartile grid
    this.cellG
      .selectAll<SVGRectElement, CloudView['cell']>('rect.bin-cell')
      .data([c.cell])
      .join('rect')
      .attr('class', 'bin-cell')
      .attr('x', (d) => r1(sc.x(d[0])))
      .attr('y', (d) => r1(sc.y(d[3])))
      .attr('width', (d) => r1(sc.x(d[1]) - sc.x(d[0])))
      .attr('height', (d) => r1(sc.y(d[2]) - sc.y(d[3])));
    const lines = [
      ...c.gridX.map((value) => ({ axis: 'x', value })),
      ...c.gridY.map((value) => ({ axis: 'y', value })),
    ];
    this.gridG
      .selectAll<SVGLineElement, { axis: string; value: number }>('line.bin-grid')
      .data(lines, (d) => `${d.axis}${d.value}`)
      .join('line')
      .attr('class', 'bin-grid')
      .attr('data-axis', (d) => d.axis)
      .attr('x1', (d) => r1(d.axis === 'x' ? sc.x(d.value) : plot.left))
      .attr('x2', (d) => r1(d.axis === 'x' ? sc.x(d.value) : plot.left + plot.width))
      .attr('y1', (d) => r1(d.axis === 'x' ? plot.top : sc.y(d.value)))
      .attr('y2', (d) => r1(d.axis === 'x' ? plot.top + plot.height : sc.y(d.value)));

    // dots: the first `shown` of the run; later groups fade in
    const r = Math.max(2.5, fs * 0.17);
    const shown: (CloudDot & { i: number })[] = c.dots.slice(0, c.shown).map((d, i) => ({ ...d, i }));
    const dotSel = this.dotG
      .selectAll<SVGCircleElement, CloudDot & { i: number }>('circle.cloud-dot')
      .data(shown, (d) => d.i)
      .join(
        (enter) => enter.append('circle').attr('opacity', 0),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', 'cloud-dot')
      .attr('data-p', (d) => Math.round(d.p * 1000) / 1000)
      .attr('cx', (d) => r1(sc.x(d.x)))
      .attr('cy', (d) => r1(sc.y(d.y)))
      .attr('r', r1(r))
      .attr('fill', (d) => (c.part === 'color' ? dotColor(d.p) : NEUTRAL_DOT));
    tr(dotSel, 'cloud', ms).attr('opacity', 0.78);

    // the customer
    const star = starPoints(fs * 0.95);
    this.starG
      .selectAll<SVGPolygonElement, CloudView['star']>('polygon.cloud-star')
      .data([c.star])
      .join('polygon')
      .attr('class', 'cloud-star')
      .attr('points', star)
      .attr('transform', (d) => `translate(${r1(sc.x(d.x))},${r1(sc.y(d.y))})`)
      .attr('fill', '#ffffff')
      .attr('stroke', NAVY);
  }
}
