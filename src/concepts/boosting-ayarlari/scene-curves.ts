import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { dodge } from '../../core/plot/dodge';
import { LineChartLayer } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport, type Rect, type Scales } from '../../core/plot/viewport';
import type { GapPoint, TuneEndLabel, TuneView, VLine } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Curve scene of the boosting settings page (Ders steps 1-5): the AUC dot plot of step 1 and the
 * log-loss curves of steps 2-5 (`LineChartLayer`), plus what the chart layer does not draw: the
 * shaded train-validation gap, vertical tree-count lines, curve-end labels and a note.
 */
export class CurveScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly gapG: G;
  private readonly chart: LineChartLayer;
  private readonly vlinesG: G;
  private readonly labelsG: G;
  private readonly noteG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'tune-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Öğrenme oranı ve ağaç sayısına göre boosting eğrileri');
    // the gap goes under the chart so the axes and curves stay on top of it
    this.gapG = this.svg.append('g').attr('class', 'cv-gap');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.chart = new LineChartLayer(this.svg.append('g').attr('class', 'cv-lines'), this.measure);
    this.vlinesG = this.svg.append('g').attr('class', 'cv-vlines');
    this.labelsG = this.svg.append('g').attr('class', 'cv-labels');
    this.noteG = this.svg.append('g').attr('class', 'cv-notes');
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws `v`; `ms` > 0 animates axes and lines. */
  update(v: TuneView, ms: number): void {
    const spec = v.chart;
    if (!spec) {
      return;
    }
    this.interrupt();
    const tick = this.measure.fonts(this.mode).tick;
    const gap = Math.round(tick * 0.45);
    const plot = this.chart.plotRect(this.w, this.h, spec);
    // room at the right for the curve-end labels
    const labW = this.measure.maxWidth(v.endLabels.map((l) => l.text), 'tick', tick);
    if (v.endLabels.length > 0) {
      plot.width = Math.max(60, plot.width - Math.max(0, labW + gap - tick * 0.5));
    }
    const sc = fitViewport({ x: spec.x, y: spec.y }, plot, false);
    this.chart.draw(spec, plot, ms);
    this.drawGap(v.gap, sc);
    this.drawVLines(v.vlines, sc, plot, tick, gap);
    this.drawEndLabels(v.endLabels, v, sc, plot, tick, gap);
    this.drawNote(v.note, plot, tick);
  }

  /** The shaded area between two curves, one closed path. */
  private drawGap(points: GapPoint[] | null, sc: Scales): void {
    const data = points && points.length > 1 ? [points] : [];
    this.gapG
      .selectAll<SVGPathElement, GapPoint[]>('path.gap')
      .data(data)
      .join('path')
      .attr('class', 'gap')
      .attr('d', (d) => {
        const top = d.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(sc.x(p.x))},${r1(sc.y(p.hi))}`);
        const bottom = [...d].reverse().map((p) => `L${r1(sc.x(p.x))},${r1(sc.y(p.lo))}`);
        return `${top.join('')}${bottom.join('')}Z`;
      });
  }

  /** Vertical lines with a label beside each; the label sits on the side the line leaves room for. */
  private drawVLines(lines: VLine[], sc: Scales, plot: Rect, tick: number, gap: number): void {
    const bottom = plot.top + plot.height;
    this.vlinesG
      .selectAll<SVGLineElement, VLine>('line.cv-vline')
      .data(lines)
      .join('line')
      .attr('class', (d) => `cv-vline ${d.cls}`)
      .attr('x1', (d) => r1(sc.x(d.x)))
      .attr('x2', (d) => r1(sc.x(d.x)))
      .attr('y1', plot.top)
      .attr('y2', bottom);
    this.vlinesG
      .selectAll<SVGTextElement, VLine>('text.cv-vlabel')
      .data(lines.filter((d) => d.label !== ''))
      .join('text')
      .attr('class', (d) => `cv-vlabel ${d.cls}`)
      .attr('text-anchor', (d) => d.anchor)
      .attr('x', (d) => r1(sc.x(d.x) + (d.anchor === 'start' ? gap : -gap)))
      .attr('y', (d) => r1(plot.top + tick * (1.3 + d.row * 1.3)))
      .text((d) => d.label);
  }

  /** Labels at the curve ends, kept apart by `dodge`. */
  private drawEndLabels(labels: TuneEndLabel[], v: TuneView, sc: Scales, plot: Rect, tick: number, gap: number): void {
    const ys = dodge(
      labels.map((l) => sc.y(l.y)),
      tick * 1.25,
      plot.top + tick * 0.5,
      plot.top + plot.height - tick * 0.3,
    );
    const cls = (id: string): string => v.chart!.series.find((s) => s.id === id)?.cls ?? '';
    this.labelsG
      .selectAll<SVGTextElement, TuneEndLabel>('text.end-label')
      .data(labels, (d) => d.id)
      .join('text')
      .attr('class', (d) => `end-label ${cls(d.id)}`)
      .attr('x', (d) => r1(sc.x(d.x) + gap))
      .attr('y', (_, i) => r1(ys[i] + tick * 0.35))
      .text((d) => d.text);
  }

  private drawNote(text: string | null, plot: Rect, tick: number): void {
    this.noteG
      .selectAll<SVGTextElement, string>('text.cv-note')
      .data(text ? [text] : [])
      .join('text')
      .attr('class', 'cv-note')
      .attr('text-anchor', 'end')
      .attr('x', r1(plot.left + plot.width - 8))
      .attr('y', r1(plot.top + plot.height - tick * 0.8))
      .text((d) => d);
  }
}
