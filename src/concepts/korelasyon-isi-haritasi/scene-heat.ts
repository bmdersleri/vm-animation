import { scaleSequential } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import type { HeatView } from './view';

/** Base duration of the heat colours' change, before `durationScale`. */
export const MS_HEAT = 400;
const TN = 'kor-heat';
/** The spec's symmetric red–white–blue scale: −1 blue, 0 white, +1 red. */
const BLUE = '#2166ac';
const MID = '#f7f7f7';
const RED = '#b2182b';
const INK = '#14365c';
const PAPER = '#ffffff';

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;
type Rgb = [number, number, number];

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const B = hex(BLUE);
const W = hex(MID);
const R = hex(RED);

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const css = (c: Rgb): string => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
/** The sequential interpolator: blue → white → red over [0, 1]. */
function ramp(t: number): string {
  return css(t < 0.5 ? mixRgb(B, W, t * 2) : mixRgb(W, R, (t - 0.5) * 2));
}
/** The plain colour of one correlation, clamped to the −1…+1 scale. */
function rgbOf(value: number): Rgb {
  const t = (Math.max(-1, Math.min(1, value)) + 1) / 2;
  return t < 0.5 ? mixRgb(B, W, t * 2) : mixRgb(W, R, (t - 0.5) * 2);
}
/** Dark cells get white text, light cells the navy ink: the number is the first channel, not the colour. */
function inkFor(value: number): string {
  const c = rgbOf(value);
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return lum < 0.62 ? PAPER : INK;
}

const heatColor = scaleSequential(ramp).domain([-1, 1]);
/** Monotonic ids so two mounted scenes never share a gradient. */
let uid = 0;

interface Lay {
  w: number; h: number;
  tick: number;
  size: number;
  left: number; top: number;
  gridW: number; gridH: number;
  legendX: number;
}

interface CellD { row: number; col: number; text: string; value: number; }
interface LabelD { index: number; text: string; }

/**
 * The heat matrix of the `korelasyon-isi-haritasi` page: square cells on the
 * spec's −1…+1 blue–white–red scale, the value inside every cell (three
 * decimals, Turkish comma) and a row / column label per variable. The diagonal
 * cells carry `diag`, so their frame is stronger than the rest: 1,000 is not a
 * finding. Every cell keeps its `(row, col)` key, so adding the `churn` column
 * keeps the existing cells and adds the fifth row and column.
 */
export class HeatLayer {
  private readonly root: G;
  private readonly gCells: G;
  private readonly gRows: G;
  private readonly gCols: G;
  private readonly gLegend: G;
  private readonly legendRect: El<SVGRectElement>;
  private readonly measure: TextMeasure;
  private view: HeatView | null = null;

  constructor(svgEl: SVGSVGElement) {
    const svg = select(svgEl);
    this.root = svg.append('g').attr('class', 'kor-heat');
    const gid = `kor-heat-grad-${++uid}`;
    const grad = this.root.append('defs').append('linearGradient')
      .attr('id', gid).attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0');
    for (const v of [-1, 0, 1]) {
      grad.append('stop')
        .attr('offset', `${(v + 1) * 50}%`)
        .attr('stop-color', heatColor(v));
    }
    this.gCells = this.root.append('g').attr('class', 'cell-grid');
    this.gRows = this.root.append('g').attr('class', 'row-labels');
    this.gCols = this.root.append('g').attr('class', 'col-labels');
    this.gLegend = this.root.append('g').attr('class', 'legend');
    this.legendRect = this.gLegend.append('rect').attr('class', 'legend-strip')
      .attr('fill', `url(#${gid})`);
    this.gLegend.selectAll<SVGTextElement, number>('text.legend-label')
      .data([1, 0, -1])
      .join('text')
      .attr('class', 'legend-label');
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  update(w: number, h: number, mode: Mode, view: HeatView | null, ms: number): void {
    this.view = view;
    this.cancel();
    if (!view || view.cells.length === 0) {
      this.root.style('display', 'none');
      this.clear();
      return;
    }
    this.root.style('display', '');
    this.draw(w, h, mode, view, ms);
  }

  /** Cancels running transitions so the next draw starts from the settled state. */
  interrupt(): void {
    this.cancel();
  }

  destroy(): void {
    this.cancel();
    this.root.remove();
  }

  private cancel(): void {
    this.root.selectAll('*').interrupt(TN);
  }

  /** Drops every cell and label (a step without the matrix must not leave stale nodes). */
  private clear(): void {
    for (const g of [this.gCells, this.gRows, this.gCols]) g.selectAll('*').interrupt(TN).remove();
  }

  private layout(w: number, h: number, mode: Mode, view: HeatView): Lay {
    const f = this.measure.fonts(mode);
    const tick = f.tick;
    const gap = Math.max(6, Math.round(tick * 0.4));
    const n = view.variables.length;
    const rowW = Math.max(
      ...view.variables.map((v) => this.measure.width(v, 'row-label', tick)),
      tick * 4,
    );
    const topH = Math.round(
      Math.max(...view.variables.map((v) => this.measure.width(v, 'col-label', tick))) * 0.72 + tick * 0.9,
    );
    const legendW = Math.round(tick * 2.6);
    const margin = Math.max(10, Math.round(tick * 0.5));
    const availW = Math.max(tick * 8, w - 2 * margin - rowW - gap - legendW);
    const availH = Math.max(tick * 8, h - 2 * margin - topH);
    const size = Math.max(18, Math.floor(Math.min(availW / n, availH / n)));
    const gridW = size * n;
    const gridH = size * n;
    const left = margin + rowW + gap + Math.max(0, (availW - gridW) / 2);
    const top = margin + topH + Math.max(0, (availH - gridH) / 2);
    return { w, h, tick, size, left, top, gridW, gridH, legendX: left + gridW + Math.round(tick * 0.9) };
  }

  private draw(w: number, h: number, mode: Mode, view: HeatView, ms: number): void {
    const L = this.layout(w, h, mode, view);
    const cells = view.cells;

    // ---- cells: one square per correlation, its value inside
    const rect = this.gCells.selectAll<SVGRectElement, CellD>('rect.cell')
      .data(cells, (d) => `${d.row}:${d.col}`)
      .join(
        (enter) => enter.append('rect')
          .attr('class', (d) => (d.row === d.col ? 'cell diag' : 'cell'))
          .attr('data-row', (d) => d.row)
          .attr('data-col', (d) => d.col)
          .attr('opacity', 0),
        (update) => update.attr('class', (d) => (d.row === d.col ? 'cell diag' : 'cell')),
        (exit) => { tr(exit as AnySel, TN, ms).attr('opacity', 0).remove(); },
      );
    rect
      .attr('x', (d) => r1(L.left + d.col * L.size))
      .attr('y', (d) => r1(L.top + d.row * L.size))
      .attr('width', r1(L.size - 1))
      .attr('height', r1(L.size - 1))
      .style('fill', (d) => heatColor(d.value));
    if (ms > 0) tr(rect as AnySel, TN, ms).attr('opacity', 1);
    else rect.attr('opacity', 1);

    const txt = this.gCells.selectAll<SVGTextElement, CellD>('text.cell-text')
      .data(cells, (d) => `${d.row}:${d.col}`)
      .join(
        (enter) => enter.append('text')
          .attr('class', 'cell-text')
          .attr('data-row', (d) => d.row)
          .attr('data-col', (d) => d.col)
          .attr('text-anchor', 'middle')
          .attr('opacity', 0),
        (update) => update,
        (exit) => { tr(exit as AnySel, TN, ms).attr('opacity', 0).remove(); },
      );
    txt
      .attr('x', (d) => r1(L.left + (d.col + 0.5) * L.size))
      .attr('y', (d) => r1(L.top + (d.row + 0.5) * L.size + L.tick * 0.35))
      .style('fill', (d) => inkFor(d.value))
      .text((d) => d.text);
    if (ms > 0) tr(txt as AnySel, TN, ms).attr('opacity', 1);
    else txt.attr('opacity', 1);

    // ---- labels: one per variable on each axis; the churn column/row is just another variable
    const labels: LabelD[] = view.variables.map((t, index) => ({ index, text: t }));
    this.gRows.selectAll<SVGTextElement, LabelD>('text.row-label')
      .data(labels, (d) => d.text)
      .join(
        (enter) => enter.append('text').attr('class', 'row-label').attr('text-anchor', 'end'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('data-var', (d) => d.text)
      .attr('x', r1(L.left - Math.round(L.tick * 0.4)))
      .attr('y', (d) => r1(L.top + (d.index + 0.5) * L.size + L.tick * 0.35))
      .text((d) => d.text);

    const colY = L.top - Math.round(L.tick * 0.3);
    this.gCols.selectAll<SVGTextElement, LabelD>('text.col-label')
      .data(labels, (d) => d.text)
      .join(
        (enter) => enter.append('text').attr('class', 'col-label').attr('text-anchor', 'start'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('data-var', (d) => d.text)
      .attr('x', (d) => r1(L.left + (d.index + 0.5) * L.size))
      .attr('y', r1(colY))
      .attr('transform', (d) => {
        const x = r1(L.left + (d.index + 0.5) * L.size);
        return `rotate(-45 ${x},${r1(colY)})`;
      })
      .text((d) => d.text);

    // ---- the scale legend: a vertical strip from +1 at the top to −1 at the bottom
    const lw = Math.max(8, Math.round(L.tick * 0.55));
    const lx = Math.min(w - lw - 4, L.legendX);
    this.legendRect.attr('x', r1(lx)).attr('y', r1(L.top)).attr('width', r1(lw)).attr('height', r1(L.gridH));
    const ly = (v: number): number => L.top + ((1 - v) / 2) * L.gridH;
    this.gLegend.selectAll<SVGTextElement, number>('text.legend-label')
      .attr('x', r1(lx + lw + 4))
      .attr('y', (v) => r1(ly(v) + L.tick * 0.35))
      .text((v) => (v > 0 ? '+1' : v < 0 ? '−1' : '0'));
  }
}
