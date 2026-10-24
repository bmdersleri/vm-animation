import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { precisionAt } from './model';
import { mountSvg, PAD, type G, type ViewScene } from './scene-base';
import type { LeakView, PrView } from './view';

/** Recall at which the curve names sit; each curve takes the next position so the names stay apart. */
const PIN_AT = [0.3, 0.5, 0.7];

/** Recall at which the floor labels sit: far from the curves, which meet their floor only at recall 1. */
const BASE_AT = 0.12;

/** Fixed axis titles of the PR plane. */
const X_TITLE = 'duyarlılık (recall)';
const Y_TITLE = 'kesinlik (precision)';

/** The chart spec of a PR view (curves, floors, name pins, the marker). */
export function prSpec(pr: PrView): LineChartSpec {
  return {
    x: [0, 1],
    y: [0, 1],
    xTitle: X_TITLE,
    yTitle: Y_TITLE,
    series: pr.series.map((s) => ({ id: s.id, cls: s.selected ? `${s.cls} is-selected` : s.cls, pts: s.pts })),
    refs: pr.baselines.map((b) => ({ y: b.y, label: '', cls: b.cls })),
    pins: [
      ...pr.series.map((s, i) => {
        const x = PIN_AT[i % PIN_AT.length];
        return { x, y: precisionAt(s.pts, x), label: s.pin, cls: s.cls };
      }),
      ...pr.baselines.map((b) => ({ x: BASE_AT, y: b.y, label: b.label, cls: b.cls.replace('baseline', '').trim() })),
    ],
    marker: pr.marker,
  };
}

/**
 * The PR area (steps 4, 5, 7, 8): the staircase curves, dashed floor lines at the positive rates, the curve
 * names, and (step 5) the two scores in large type above the plot.
 */
export class PrScene implements ViewScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private readonly bigG: G;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const m = mountSvg(host, 'Kesinlik-duyarlılık eğrileri, kesikli taban çizgileri ve skorlar');
    this.svg = m.svg;
    this.measure = m.measure;
    this.chart = new LineChartLayer(this.svg.append('g').attr('class', 'pr-chart'), this.measure);
    this.bigG = this.svg.append('g').attr('class', 'pr-big');
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('line');
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
    this.svg.attr('width', this.w).attr('height', this.h);
    const band = this.drawBig(pr, fonts.tick, fonts.title);
    const spec = prSpec(pr);
    const rect = this.chart.plotRect(this.w, Math.max(120, this.h - band), spec);
    rect.top += band;
    this.chart.clear();
    this.chart.draw(spec, rect, ms);
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
