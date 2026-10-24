import type { Selection } from 'd3-selection';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { MatrixLayer } from '../dengesiz/matrix';
import type { ImbView, MetricRow } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Where the side panel is drawn and with which font sizes (px). */
export interface SidePanelOptions {
  rect: { x: number; y: number; w: number; h: number };
  tick: number;
  axis: number;
  ms: number;
}

/** Names of the metric row, in reading order. */
const METRIC_NAMES: readonly { key: keyof MetricRow; name: string }[] = [
  { key: 'accuracy', name: 'doğruluk' },
  { key: 'precision', name: 'kesinlik' },
  { key: 'recall', name: 'duyarlılık' },
  { key: 'f1', name: 'F1' },
];

/** The sections' heights for one view, so a narrow screen can size the panel before drawing it. */
interface Plan {
  titleH: number;
  barsH: number;
  headH: number;
  metricsH: number;
  metricCols: number;
  bookLines: string[];
  bookH: number;
  /** Everything except the matrix cells. */
  fixed: number;
  cellMin: number;
  cellMax: number;
}

/**
 * The side panel of the imbalanced-data page: the class count bars, optionally the 2x2 test matrix
 * with the metric row (an undefined ratio reads "— (tanımsız)") and the book's code line.
 */
export class SidePanel {
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly barsG: G;
  private readonly matrixG: G;
  private readonly metricsG: G;
  private readonly bookG: G;
  private readonly bars: HBarsLayer;
  private readonly matrix: MatrixLayer;

  constructor(
    g: G,
    private readonly measure: TextMeasure,
  ) {
    this.title = g.append('text').attr('class', 'sp-title axis-title');
    this.barsG = g.append('g').attr('class', 'sp-bars');
    this.matrixG = g.append('g').attr('class', 'sp-matrix');
    this.metricsG = g.append('g').attr('class', 'sp-metrics');
    this.bookG = g.append('g').attr('class', 'sp-book');
    this.bars = new HBarsLayer(this.barsG, measure);
    this.matrix = new MatrixLayer(this.matrixG, measure);
  }

  private plan(v: ImbView, w: number, tick: number, axis: number): Plan {
    const rowH = tick * 1.4;
    let metricCols = 1;
    let metricsH = 0;
    if (v.metrics) {
      const widest = Math.max(
        ...METRIC_NAMES.map((m) => this.measure.width(`${m.name} ${v.metrics![m.key]}`, 'tick', tick)),
      );
      metricCols = widest * 2 + tick * 2 <= w ? 2 : 1;
      metricsH = rowH * (4 / metricCols) + tick * 0.5;
    }
    const bookLines = v.book ? this.measure.wrap(v.book, w, 'book-code', tick) : [];
    const bookH = bookLines.length ? bookLines.length * tick * 1.35 + tick * 0.6 : 0;
    const titleH = axis * 1.6;
    const barsH = tick * 3.8;
    const headH = v.matrix ? tick * 3.1 : 0;
    return {
      titleH,
      barsH,
      headH,
      metricsH,
      metricCols,
      bookLines,
      bookH,
      fixed: titleH + barsH + metricsH + bookH + headH,
      cellMin: tick * 1.7,
      cellMax: tick * 2.6,
    };
  }

  /** Height (px) the panel wants at width `w` (cells at their tallest). */
  heightFor(v: ImbView, w: number, tick: number, axis: number): number {
    const p = this.plan(v, w, tick, axis);
    return p.fixed + (v.matrix ? 2 * p.cellMax : 0);
  }

  /** Draws `v` into `o.rect`: sections stack from the top; the matrix cells give way when the height is short. */
  draw(v: ImbView, o: SidePanelOptions): void {
    const { rect, tick, axis } = o;
    const p = this.plan(v, rect.w, tick, axis);
    let y = rect.y;

    this.title
      .attr('x', r1(rect.x + 4))
      .attr('y', r1(y + axis))
      .text(v.counts.title);
    y += p.titleH;

    const data: HBar[] = [
      { id: 'neg', row: 0, slot: 0, cls: 'neg', value: v.counts.neg, text: String(v.counts.neg), label: 'kalan' },
      { id: 'pos', row: 1, slot: 0, cls: 'pos', value: v.counts.pos, text: String(v.counts.pos), label: 'ayrılan' },
    ];
    this.bars.draw(data, {
      rect: { x: rect.x, y, w: rect.w, h: p.barsH },
      tick,
      rows: 2,
      slots: 1,
      max: Math.max(v.counts.neg, v.counts.pos, 1),
      itemCls: 'imb-bar',
      valueSample: '0000',
      ms: o.ms,
    });
    y += p.barsH;

    if (v.matrix) {
      const cell = Math.max(p.cellMin, Math.min(p.cellMax, (rect.h - p.fixed) / 2));
      this.matrixG.attr('display', null);
      this.matrix.draw(v.matrix, {
        rect: { x: rect.x, y, w: Math.min(rect.w, tick * 22), h: p.headH + 2 * cell },
        tick,
        axis,
        focusPositive: v.focusPositive,
        ms: o.ms,
      });
      y += p.headH + 2 * cell;
    } else {
      this.matrixG.attr('display', 'none');
    }

    this.drawMetrics(v.metrics, rect.x, y, rect.w, tick, p);
    y += p.metricsH;
    this.drawBook(p.bookLines, rect.x, y, tick);
  }

  private drawMetrics(row: MetricRow | null, x: number, y: number, w: number, tick: number, p: Plan): void {
    const data = row ? METRIC_NAMES : [];
    const colW = w / p.metricCols;
    const rowH = tick * 1.4;
    const sel = this.metricsG
      .selectAll<SVGGElement, (typeof METRIC_NAMES)[number]>('g.metric')
      .data(data, (d) => d.key)
      .join((enter) => {
        const g = enter.append('g');
        g.append('text').attr('class', 'metric-name');
        g.append('text').attr('class', 'metric-value');
        return g;
      })
      .attr('class', (d) => `metric ${d.key}`)
      .attr('data-metric', (d) => d.key);
    sel.each((d, i, nodes) => {
      const col = i % p.metricCols;
      const r = Math.floor(i / p.metricCols);
      const gx = x + 4 + col * colW;
      const gy = y + rowH * (r + 0.75);
      const g = nodes[i];
      const name = g.querySelector('text.metric-name')!;
      const value = g.querySelector('text.metric-value')!;
      name.setAttribute('x', String(r1(gx)));
      name.setAttribute('y', String(r1(gy)));
      name.textContent = d.name;
      value.setAttribute('x', String(r1(gx + this.measure.width(`${d.name} `, 'tick', tick))));
      value.setAttribute('y', String(r1(gy)));
      value.textContent = row ? row[d.key] : '';
    });
  }

  private drawBook(lines: string[], x: number, y: number, tick: number): void {
    this.bookG
      .selectAll<SVGTextElement, string>('text.book-line')
      .data(lines)
      .join('text')
      .attr('class', 'book-code book-line')
      .attr('x', r1(x + 4))
      .attr('y', (_, i) => r1(y + tick * 0.6 + tick * 1.35 * (i + 0.8)))
      .text((d) => d);
  }
}
