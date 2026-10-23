import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { LineChartLayer } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import type { RfView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

const PAD = 12;

/**
 * Curve scene (steps 7-8): the OOB score beside the 5-fold CV mean as two bars (the folds as small dots on the
 * CV bar, the training-time sentence below), then the OOB - tree count line chart with the first value pinned.
 */
export class CurvesScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly compareG: G;
  private readonly dotsG: G;
  private readonly noteG: G;
  private readonly chartG: G;
  private readonly measure: TextMeasure;
  private readonly bars: HBarsLayer;
  private readonly chart: LineChartLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'rf-plot')
      .attr('role', 'img')
      .attr('aria-label', 'OOB skoru ve çapraz doğrulama, OOB skorunun ağaç sayısıyla değişimi');
    this.compareG = this.svg.append('g').attr('class', 'compare-layer');
    this.dotsG = this.svg.append('g').attr('class', 'dots-layer');
    this.noteG = this.svg.append('g').attr('class', 'note-layer');
    this.chartG = this.svg.append('g').attr('class', 'chart-layer');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.bars = new HBarsLayer(this.compareG, this.measure);
    this.chart = new LineChartLayer(this.chartG, this.measure);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the bars or the chart of `v.curves` (`ms` > 0 animates). */
  update(v: RfView, ms: number): void {
    const c = v.curves;
    if (!c) return;
    this.interrupt();
    const compare = c.kind === 'compare' && c.compare !== null;
    this.compareG.attr('display', compare ? null : 'none');
    this.dotsG.attr('display', compare ? null : 'none');
    this.noteG.attr('display', compare ? null : 'none');
    this.chartG.attr('display', compare ? 'none' : null);
    if (compare) this.drawCompare(c.compare!, ms);
    else if (c.chart) {
      const plot = this.chart.plotRect(this.w, this.h, c.chart);
      this.chart.draw(c.chart, plot, ms);
    }
  }

  private drawCompare(cmp: NonNullable<NonNullable<RfView['curves']>['compare']>, ms: number): void {
    const f = this.measure.fonts(this.mode);
    const noteLines = this.measure.wrap(cmp.sentence, this.w - 2 * PAD, 'axis-title', f.axis);
    const noteH = noteLines.length * f.axis * 1.4 + f.tick * 1.6 + 2 * PAD;
    const barsH = Math.max(80, Math.min(this.h - noteH, 260));
    const data: HBar[] = cmp.bars.map((b, row) => ({
      id: b.id,
      row,
      slot: 0,
      cls: b.id,
      value: b.value,
      text: b.text,
      label: b.label,
      attrs: { value: b.value },
    }));
    const geo = this.bars.draw(data, {
      rect: { x: 0, y: 0, w: this.w, h: barsH },
      tick: f.tick,
      rows: 2,
      slots: 1,
      max: 1,
      itemCls: 'curve-bar',
      valueSample: '0,000',
      barK: 2.4,
      ms,
    });
    // the CV folds sit in a thin row just under the CV bar, on the bar's value scale
    const cvRow = cmp.bars.findIndex((b) => b.id === 'cv');
    const r = Math.max(3.5, f.tick * 0.3);
    const cy = geo.yOf(cvRow, 0) + geo.barH + r + 4;
    this.dotsG
      .selectAll<SVGCircleElement, number>('circle.fold-dot')
      .data(cmp.folds)
      .join('circle')
      .attr('class', 'fold-dot')
      .attr('r', r)
      .attr('cx', (d) => r1(geo.xOf(d)))
      .attr('cy', r1(cy));
    const dotNote = `noktalar: ${cmp.folds.length} katın ayrı skorları`;
    this.noteG
      .selectAll<SVGTextElement, string[]>('text.time-note')
      .data([noteLines])
      .join('text')
      .attr('class', 'time-note axis-title')
      .each(function (lines) {
        select(this)
          .selectAll('tspan')
          .data(lines)
          .join('tspan')
          .attr('x', PAD)
          .attr('y', (_, i) => r1(barsH + PAD + f.axis + i * f.axis * 1.4))
          .text((d) => d);
      });
    this.noteG
      .selectAll<SVGTextElement, string>('text.dots-note')
      .data([dotNote])
      .join('text')
      .attr('class', 'dots-note tick')
      .attr('x', PAD)
      .attr('y', r1(barsH + PAD + f.axis + noteLines.length * f.axis * 1.4 + f.tick * 0.6))
      .text((d) => d);
  }
}
