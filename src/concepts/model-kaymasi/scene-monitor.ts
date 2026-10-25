import { scaleLinear } from 'd3-scale';
import type { Mode } from '../../core/mode';
import { formatNumber as f, formatPercent, formatTrim } from '../../core/plot/format';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import { NEGATIVE, NAVY, r1, trianglePath } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport } from '../../core/plot/viewport';
import { META } from './data';
import { cap, thresholdText } from './scenario';
import { el, makeSvg, type G, type Svg, type ViewScene } from './scene-base';
import type { KaymaView, MonitorSeries, MonitorView, ThresholdTable } from './view';


/** From this width (px) on, the table / readout sits beside the charts; narrower, under them. */
const SIDE_MIN = 640;
/** Two charts stand side by side from this width (px) of the charts' column on; narrower, one above the other. */
const PAIR_MIN = 640;
/** The month axis runs past month 24 by this much: the threshold's label sits in that gutter, clear of the last marks. */
const GUTTER = 3;
const GAP = 12;
/** Smallest chart (px, without the accuracy strip) in one chart / two charts, and in a tall stage. */
const MIN_ONE = 300;
const MIN_TWO = 190;
const TALL_ONE = 300;

const metricName = (m: MonitorView['metric']): string => (m === 'mean' ? 'ortalama farkı' : 'PSI');

/** One chart block: the metric line over the months with its threshold, bands and marks, and (one series) the accuracy strip. */
class Block {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private readonly bandG: G;
  private readonly stripG: G;
  private readonly markG: G;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'section', 'monitor');
    this.title = el(doc, 'h3', 'monitor-title');
    const { svg, measure } = makeSvg(doc, 'monitor-plot', 'İzleme grafiği: aylık metrik, eşik ve doğruluk');
    this.svg = svg;
    this.measure = measure;
    this.bandG = svg.append('g').attr('class', 'monitor-bands');
    this.chart = new LineChartLayer(svg.append('g').attr('class', 'monitor-chart'), measure);
    this.stripG = svg.append('g').attr('class', 'acc-strip');
    this.markG = svg.append('g').attr('class', 'monitor-marks');
    this.root.append(this.title, svg.node()!);
    host.append(this.root);
  }

  fontPx(mode: Mode): number {
    return this.measure.fonts(mode).tick;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
    this.svg.selectAll('*').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: KaymaView, m: MonitorView, s: MonitorSeries, yMax: number, w: number, h: number, mode: Mode, ms: number): void {
    const fs = this.measure.fonts(mode).tick;
    const strip = m.series.length === 1;
    // the strip: a title row, the dots, a row for "etiket bekleniyor"
    const stripH = strip ? Math.round(fs * 6.4 + 8) : 0;
    const chartH = h - stripH;
    this.root.dataset.scenario = s.scenario;
    this.title.textContent = `${cap(s.name)} · ${metricName(m.metric)}`;
    this.svg.attr('width', w).attr('height', h);

    const spec: LineChartSpec = {
      x: [0.5, META.months + GUTTER],
      y: [0, yMax],
      xTitle: 'ay (gölgeli alan: referans)',
      yTicks: scaleLinear().domain([0, yMax]).ticks(Math.max(2, Math.min(5, Math.round((chartH - fs * 7) / (fs * 2.4))))),
      yTitle: metricName(m.metric),
      xTicks: [1, 6, 12, 18, 24],
      series: [{ id: 'metric', cls: 'monitor-line', pts: s.values.slice(0, s.shown).map((val, i) => [i + 1, val] as [number, number]) }],
      refs: [{ y: m.threshold, label: thresholdText(m.metric, m.threshold), cls: 'threshold-line' }],
    };
    const plot = this.chart.plotRect(w, chartH, spec);
    const sc = fitViewport({ x: spec.x, y: spec.y }, plot, false);
    const bottom = plot.top + plot.height;

    // reference months shaded behind the axes
    this.bandG.selectAll('*').remove();
    this.bandG.append('rect')
      .attr('class', 'ref-band')
      .attr('x', r1(sc.x(0.5)))
      .attr('y', r1(plot.top))
      .attr('width', r1(sc.x(META.refMonths + 0.5) - sc.x(0.5)))
      .attr('height', r1(plot.height));
    this.chart.draw(spec, plot, ms);

    this.markG.selectAll('*').remove();
    const r = Math.max(5, fs * 0.42);
    const firstAlarm = s.alarms[0];
    for (let month = META.refMonths + 1; month <= s.shown; month += 1) {
      const x = sc.x(month);
      const y = sc.y(s.values[month - 1]);
      if (s.alarms.includes(month)) {
        const g = this.markG.append('g')
          .attr('class', 'alarm-mark')
          .attr('data-month', month)
          .attr('transform', `translate(${r1(x)},${r1(y)})`);
        g.append('path').attr('d', trianglePath(r * 1.35)).attr('fill', NEGATIVE);
      } else {
        this.markG.append('circle')
          .attr('class', 'ok-mark')
          .attr('data-month', month)
          .attr('cx', r1(x))
          .attr('cy', r1(y))
          .attr('r', r1(r * 0.8));
      }
    }
    if (firstAlarm !== undefined) {
      const x = sc.x(firstAlarm);
      const y = sc.y(s.values[firstAlarm - 1]);
      const above = y - r * 2.2 - 4 > plot.top + fs;
      const nearEnd = x > plot.left + plot.width - fs * 4;
      // above the marker when there is room; else below and to its right, where the line (which rose to the marker from the left) is not
      const anchor = above ? (nearEnd ? 'end' : 'middle') : 'start';
      this.markG.append('text')
        .attr('class', 'alarm-label tick')
        .attr('text-anchor', anchor)
        .attr('x', r1(above ? x : x + r * 1.6))
        .attr('y', r1(above ? y - r * 1.9 - 4 : y + r * 1.6 + fs))
        .text('UYARI');
    }
    if (v.stepId === 'aylik-izleme' && !v.lab) {
      const x = sc.x(m.today);
      this.markG.append('line')
        .attr('class', 'today-line')
        .attr('x1', r1(x)).attr('x2', r1(x))
        .attr('y1', r1(plot.top)).attr('y2', r1(bottom));
      const nearEnd = x > plot.left + plot.width - fs * 4;
      this.markG.append('text')
        .attr('class', 'today-label tick')
        .attr('text-anchor', nearEnd ? 'end' : 'start')
        .attr('x', r1(x + (nearEnd ? -5 : 5)))
        .attr('y', r1(plot.top + fs * 2.3))
        .text(`bugün: ay ${m.today}`);
    }

    this.stripG.selectAll('*').remove();
    if (strip) {
      this.drawStrip(m, s, plot.left, plot.width, chartH, fs, sc.x);
    }
  }

  private drawStrip(
    m: MonitorView,
    s: MonitorSeries,
    left: number,
    width: number,
    top: number,
    fs: number,
    xOf: (month: number) => number,
  ): void {
    const titleY = top + fs * 1.1;
    const dotsTop = top + fs * 1.5;
    const dotsH = fs * 3.2;
    const dotsBottom = dotsTop + dotsH;
    const accs = s.accuracy.map((a) => a.value);
    const lo = Math.min(...accs, m.accThreshold) - 0.02;
    const hi = Math.max(...accs, m.refAccuracy) + 0.02;
    const y = scaleLinear().domain([lo, hi]).range([dotsBottom, dotsTop]);
    this.stripG.append('text')
      .attr('class', 'strip-title tick')
      .attr('x', r1(left))
      .attr('y', r1(titleY))
      .text(`doğruluk (taban ${formatPercent(m.accThreshold, 1)})`);
    this.stripG.append('rect')
      .attr('class', 'acc-frame')
      .attr('x', r1(left)).attr('y', r1(dotsTop))
      .attr('width', r1(width)).attr('height', r1(dotsH));
    this.stripG.append('line')
      .attr('class', 'acc-floor')
      .attr('x1', r1(left)).attr('x2', r1(left + width))
      .attr('y1', r1(y(m.accThreshold))).attr('y2', r1(y(m.accThreshold)));
    // the two ticks are the series' own highest and lowest accuracy, written where those points are
    for (const v of [Math.max(...accs), Math.min(...accs)]) {
      this.stripG.append('text')
        .attr('class', 'strip-tick tick')
        .attr('text-anchor', 'end')
        .attr('x', r1(left - 5))
        .attr('y', r1(y(v)))
        .attr('dy', '0.35em')
        .text(formatPercent(v, 1));
    }
    const pending = s.accuracy.filter((a) => a.month <= s.shown && !a.known);
    if (pending.length > 0) {
      const a = xOf(pending[0].month - 0.5);
      const b = xOf(pending[pending.length - 1].month + 0.5);
      this.stripG.append('rect')
        .attr('class', 'acc-pending')
        .attr('x', r1(a)).attr('y', r1(dotsTop + 1))
        .attr('width', r1(b - a)).attr('height', r1(dotsH - 2))
        .attr('rx', 4);
      const text = 'etiket bekleniyor';
      const tw = this.measure.width(text, 'tick', fs);
      this.stripG.append('text')
        .attr('class', 'acc-pending-label tick')
        .attr('x', r1(Math.max(left, Math.min(b - tw, left + width - tw))))
        .attr('y', r1(dotsBottom + fs * 1.35))
        .text(text);
    }
    const r = Math.max(3.5, fs * 0.3);
    for (const a of s.accuracy) {
      if (!a.known || a.month > s.shown) {
        continue;
      }
      const low = a.value < m.accThreshold;
      const cx = xOf(a.month);
      const cy = y(a.value);
      if (low) {
        this.stripG.append('path')
          .attr('class', 'acc-dot is-low')
          .attr('data-month', a.month)
          .attr('data-value', a.value)
          .attr('d', trianglePath(r * 1.5))
          .attr('transform', `translate(${r1(cx)},${r1(cy)})`)
          .attr('fill', NEGATIVE);
      } else {
        this.stripG.append('circle')
          .attr('class', 'acc-dot')
          .attr('data-month', a.month)
          .attr('data-value', a.value)
          .attr('cx', r1(cx)).attr('cy', r1(cy))
          .attr('r', r1(r))
          .attr('fill', NAVY);
      }
    }
  }
}

/** Thresholds as the table writes them: "4", "0,1", "0,25". */
const cellText = (t: number): string => formatTrim(t, 2);

/**
 * Steps 5-6. One chart block per series (`.monitor[data-scenario]`): the metric line, the dashed threshold, the
 * reference months, triangle marks with UYARI for alarms and hollow marks for quiet months, the "bugün" cursor of the
 * Ders sweep and, under a single series, the accuracy strip. Beside the charts (narrow: under them) sit the
 * threshold table (`.threshold-table`), the note on the reference fluctuation and the Lab readout (`.readout`).
 */
export class MonitorScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly charts: HTMLDivElement;
  private readonly side: HTMLElement;
  private readonly blocks: Block[] = [];
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  private tall = false;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'monitor-scene');
    this.charts = el(doc, 'div', 'monitor-charts');
    this.side = el(doc, 'aside', 'monitor-side');
    this.root.append(this.charts, this.side);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.tall = tall;
  }

  interrupt(): void {
    this.blocks.forEach((b) => b.interrupt());
  }

  destroy(): void {
    this.blocks.forEach((b) => b.destroy());
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    const m = v.monitor;
    if (!m) {
      return;
    }
    while (this.blocks.length < m.series.length) {
      this.blocks.push(new Block(this.charts));
    }
    while (this.blocks.length > m.series.length) {
      this.blocks.pop()!.destroy();
    }
    this.fillSide(v, m);
    const hasSide = this.side.childElementCount > 0;
    const beside = hasSide && this.w >= SIDE_MIN;
    const sideW = beside ? Math.min(360, Math.floor(this.w * 0.34)) : 0;
    this.root.toggleAttribute('data-stack', !beside);
    this.root.style.setProperty('--side-w', `${sideW}px`);
    const colW = beside ? this.w - sideW - GAP : this.w;
    const fs = this.blocks[0].fontPx(this.mode);
    const n = m.series.length;
    // two charts side by side when the column is wide enough: each keeps the area's whole height
    const cols = n > 1 && colW >= PAIR_MIN ? n : 1;
    const cw = Math.floor((colW - (cols - 1) * GAP) / cols);
    this.charts.style.setProperty('--cols', String(cols));
    const titleH = fs * 1.9;
    const stripH = n === 1 ? Math.round(fs * 6.4 + 8) : 0;
    let ch: number;
    if (this.tall) {
      ch = (n === 1 ? TALL_ONE : TALL_ONE - 40) + stripH;
    } else {
      const rowsN = Math.ceil(n / cols);
      const block = (this.h - (rowsN - 1) * GAP) / rowsN;
      ch = Math.max((rowsN === 1 ? MIN_ONE : MIN_TWO) + stripH, Math.floor(block - titleH));
    }
    const yMax = this.yMax(m);
    m.series.forEach((s, i) => this.blocks[i].update(v, m, s, yMax, cw, ch, this.mode, ms));
  }

  /** One value axis for every series of the view, so two charts compare. */
  private yMax(m: MonitorView): number {
    const top = Math.max(m.threshold, ...m.series.flatMap((s) => s.values));
    return scaleLinear().domain([0, top * 1.08]).nice(5).domain()[1];
  }

  private fillSide(v: KaymaView, m: MonitorView): void {
    const doc = this.root.ownerDocument;
    const parts: HTMLElement[] = [];
    if (v.table) {
      parts.push(this.table(doc, v.table, m));
    }
    if (v.stepId === 'esik-secimi') {
      const hi = m.refBand.hi;
      parts.push(el(doc, 'p', 'fluct-note', `Referans aylarının kendi aylık dalgalanmasının en büyüğü: ${f(hi, m.metric === 'mean' ? 2 : 3)}.`));
    }
    if (m.readout) {
      parts.push(this.readout(doc, m));
    }
    if (v.note) {
      parts.push(el(doc, 'p', 'monitor-note', v.note));
    }
    this.side.replaceChildren(...parts);
  }

  private table(doc: Document, t: ThresholdTable, m: MonitorView): HTMLElement {
    const table = el(doc, 'table', 'threshold-table');
    const head = doc.createElement('tr');
    t.heads.forEach((h) => head.append(el(doc, 'th', 'cell-head', h)));
    const thead = doc.createElement('thead');
    thead.append(head);
    const body = doc.createElement('tbody');
    for (const r of t.rows) {
      const tr = el(doc, 'tr', r.current ? 'is-current' : '');
      tr.dataset.threshold = String(r.threshold);
      for (const text of [cellText(r.threshold), String(r.falseAlarms), r.delay]) {
        tr.append(el(doc, 'td', 'cell', text));
      }
      body.append(tr);
    }
    table.append(thead, body);
    table.setAttribute('aria-label', `Eşik tablosu: ${metricName(m.metric)}`);
    return table;
  }

  private readout(doc: Document, m: MonitorView): HTMLElement {
    const r = m.readout!;
    const box = el(doc, 'dl', 'readout');
    const rows: [string, string, string][] = [
      ['alarms', 'Alarm ayları', r.alarms.length === 0 ? 'yok' : `ay ${r.alarms.join(', ')}`],
      ['false', 'Yanlış alarm', String(r.falseAlarms)],
      ['delay', 'Gecikme', r.delayText],
      ['acc', 'Başarım alarmı', r.acc ? `${r.accuracy.month} · bilindiği: ${r.accuracy.known}` : r.accuracy.month],
    ];
    for (const [key, label, value] of rows) {
      const item = el(doc, 'div', 'read-box');
      item.dataset.read = key;
      item.append(el(doc, 'dt', 'read-label', label), el(doc, 'dd', 'read-value', value));
      box.append(item);
    }
    return box;
  }
}
