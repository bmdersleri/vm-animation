import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { MatrixLayer, matrixHeight } from '../dengesiz/matrix';
import { precisionAt } from './model';
import { mountSvg, PAD, type G, type ViewScene } from './scene-base';
import type { LeakView, PrView } from './view';

/** Recall at which each curve's name sits; the curves take different positions so the names stay apart. */
const PIN_AT: Record<string, number> = { leaky: 0.58, honest: 0.2, base: 0.3, smote: 0.5, weighted: 0.7 };

/** Recall at which the floor labels sit: far from the curves, which meet their floor only at recall 1. */
const BASE_AT = 0.12;

/** Width (px) under which a chart with three curves names them in a legend instead of beside the curves. */
const LEGEND_UNDER = 700;

/** Width (px) from which the step-8 panel sits beside the chart. */
const NARROW = 760;

/** Fixed axis titles of the PR plane. */
const X_TITLE = 'duyarlılık (recall)';
const Y_TITLE = 'kesinlik (precision)';

/** The chart spec of a PR view (curves, floors, name pins, the marker). */
export function prSpec(pr: PrView, legend = false): LineChartSpec {
  return {
    x: [0, 1],
    y: [0, 1],
    xTitle: X_TITLE,
    yTitle: Y_TITLE,
    series: pr.series.map((s) => ({ id: s.id, cls: s.selected ? `${s.cls} is-selected` : s.cls, pts: s.pts })),
    refs: pr.baselines.map((b) => ({ y: b.y, label: '', cls: b.cls })),
    pins: [
      ...(legend ? [] : pr.series).map((s) => {
        const x = PIN_AT[s.id] ?? 0.5;
        return { x, y: precisionAt(s.pts, x), label: s.pin, cls: s.cls };
      }),
      ...pr.baselines.map((b) => ({ x: BASE_AT, y: b.y, label: b.label, cls: b.cls.replace('baseline', '').trim() })),
    ],
    marker: pr.marker ? { ...pr.marker, cls: 'op-point' } : null,
  };
}

/** Link under the step-8 panel (the Bölüm 6 threshold page). */
const THRESHOLD_LINK = { href: '../roc-esik/', text: 'Eşik seçimi: roc-esik sayfası' };

/**
 * The PR area (steps 4, 5, 7, 8): the staircase curves, dashed floor lines at the positive rates, the curve
 * names, (step 5) the two scores in large type above the plot and (step 8) a side panel with the confusion
 * matrix at the chosen threshold.
 */
export class PrScene implements ViewScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private readonly bigG: G;
  private readonly legendG: G;
  private readonly panelG: G;
  private readonly matrix: MatrixLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const m = mountSvg(host, 'Kesinlik-duyarlılık eğrileri, kesikli taban çizgileri ve skorlar');
    this.svg = m.svg;
    this.measure = m.measure;
    this.chart = new LineChartLayer(this.svg.append('g').attr('class', 'pr-chart'), this.measure);
    this.bigG = this.svg.append('g').attr('class', 'pr-big');
    this.legendG = this.svg.append('g').attr('class', 'pr-legend');
    this.panelG = this.svg.append('g').attr('class', 'pr-panel');
    this.matrix = new MatrixLayer(this.panelG.append('g').attr('class', 'pr-matrix'), this.measure);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('line').interrupt('cellbg');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  update(v: LeakView, ms: number): void {
    const pr = v.pr;
    if (!pr) {
      return;
    }
    this.interrupt();
    const fonts = this.measure.fonts(this.mode);
    const band = this.drawBig(pr, fonts.tick, fonts.title);
    const legend = pr.series.length > 2 && this.w < LEGEND_UNDER;
    const spec = prSpec(pr, legend);
    // the step-8 panel sits beside the chart, or under it on a narrow screen
    const side = pr.panel !== null && this.w >= NARROW;
    const panelW = side ? Math.max(280, Math.min(420, this.w * 0.38)) : this.w;
    const chartW = side ? this.w - panelW : this.w;
    const panelH = pr.panel && !side ? this.panelHeight(fonts.tick, fonts.axis) : 0;
    const chartH = pr.panel && !side ? Math.max(260, Math.round(this.h * 0.58)) : this.h;
    this.svg.attr('width', this.w).attr('height', chartH + panelH);
    const rect = this.chart.plotRect(chartW, Math.max(120, chartH - band), spec);
    rect.top += band;
    this.chart.clear();
    this.chart.draw(spec, rect, ms);
    this.drawLegend(legend ? pr : null, rect, fonts.tick);
    this.drawPanel(pr, side ? { x: chartW, y: PAD, w: panelW - PAD } : { x: PAD, y: chartH, w: this.w - PAD * 2 }, fonts.tick, fonts.axis, ms);
  }

  /** Names the curves in the plot's empty upper right (a narrow chart has no room for names beside three crowded curves). */
  private drawLegend(pr: PrView | null, plot: { left: number; top: number; width: number }, tick: number): void {
    this.legendG.selectAll('*').remove();
    if (!pr) {
      return;
    }
    const lead = tick * 1.6;
    const swatch = tick * 2.2;
    const widest = this.measure.maxWidth(
      pr.series.map((s) => s.pin),
      'tick',
      tick,
    );
    const x0 = plot.left + plot.width - widest - swatch - tick * 1.2;
    pr.series.forEach((s, i) => {
      const y = plot.top + tick * 1.6 + lead * i;
      this.legendG
        .append('line')
        .attr('class', `legend-swatch ${s.cls}`)
        .attr('x1', r1(x0))
        .attr('x2', r1(x0 + swatch))
        .attr('y1', r1(y - tick * 0.3))
        .attr('y2', r1(y - tick * 0.3));
      this.legendG
        .append('text')
        .attr('class', `legend-label ${s.cls}`)
        .attr('x', r1(x0 + swatch + tick * 0.5))
        .attr('y', r1(y))
        .text(s.pin);
    });
  }

  /** Cell height of the panel matrix. */
  private cellH(tick: number): number {
    return tick * 3.3;
  }

  /** Height the panel needs under the chart: matrix, three lines of text, the link. */
  private panelHeight(tick: number, axis: number): number {
    return matrixHeight(tick, this.cellH(tick)) + axis + tick * 1.5 * 5 + PAD * 3;
  }

  /** The step-8 panel: matrix, the caught count, the unweighted comparison and the link. */
  private drawPanel(pr: PrView, at: { x: number; y: number; w: number }, tick: number, axis: number, ms: number): void {
    this.panelG.selectAll('text.panel-line, a.op-link').remove();
    this.panelG.attr('display', pr.panel ? null : 'none');
    if (!pr.panel) {
      return;
    }
    const mh = matrixHeight(tick, this.cellH(tick));
    this.matrix.draw(pr.panel.matrix, { rect: { x: at.x, y: at.y, w: at.w, h: mh }, tick, axis, focusPositive: true, ms });
    let y = at.y + mh + axis * 1.4;
    const lead = tick * 1.45;
    pr.panel.lines.forEach((line, i) => {
      for (const part of this.measure.wrap(line, at.w, 'tick', tick)) {
        this.panelG
          .append('text')
          .attr('class', i === 0 ? 'panel-line is-main' : 'panel-line')
          .attr('x', r1(at.x))
          .attr('y', r1(y))
          .text(part);
        y += lead;
      }
      y += tick * 0.3;
    });
    const link = this.panelG.append('a').attr('class', 'op-link').attr('href', THRESHOLD_LINK.href);
    link.append('text').attr('class', 'panel-link').attr('x', r1(at.x)).attr('y', r1(y + tick * 0.2)).text(THRESHOLD_LINK.text);
  }

  /** The two large scores (label small above, value large) in two columns; returns the band height (0 = none). */
  private drawBig(pr: PrView, tick: number, title: number): number {
    this.bigG.selectAll('*').remove();
    if (!pr.big) {
      return 0;
    }
    const colW = (this.w - PAD * 2) / pr.big.length;
    const labelY = PAD + tick;
    const valueY = labelY + tick * 0.5 + title;
    pr.big.forEach((b, i) => {
      const x = PAD + colW * (i + 0.5);
      this.bigG.append('text').attr('class', `score-name ${b.cls}`).attr('text-anchor', 'middle').attr('x', r1(x)).attr('y', r1(labelY)).text(b.label);
      this.bigG
        .append('text')
        .attr('class', `score-big prediction ${b.cls}`)
        .attr('text-anchor', 'middle')
        .attr('x', r1(x))
        .attr('y', r1(valueY))
        .text(b.value);
    });
    let band = valueY + tick * 0.6;
    if (pr.note) {
      band += tick * 1.1;
      this.bigG
        .append('text')
        .attr('class', 'score-book')
        .attr('text-anchor', 'middle')
        .attr('x', r1(this.w / 2))
        .attr('y', r1(band - tick * 0.2))
        .text(pr.note);
      band += tick * 0.3;
    }
    return band;
  }
}
