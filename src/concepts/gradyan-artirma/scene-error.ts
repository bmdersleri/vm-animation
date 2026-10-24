import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { dodge } from '../../core/plot/dodge';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import { stepPath, type StepSegment } from '../../core/plot/step-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { X_DOMAIN, type EndLabel, type ErrorView, type GbPoint, type TopView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Outer padding (px) around the drawing. */
const PAD = 8;
/** Share of the height the top panel takes on step 9. */
const TOP_SHARE = 0.55;

/**
 * Error scene of the gradient boosting page (Ders steps 7-9): the log error chart with
 * training / validation curves, dip pins, end labels and the sweep marker (`LineChartLayer`).
 * Step 9 adds the top panel: the points and two F lines (the dip's tree count and M trees);
 * the chart then shrinks into the lower part. In the Lab the chosen ν's curve is emphasised.
 */
export class ErrorScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly topAxesG: G;
  private readonly topG: G;
  private readonly legendG: G;
  private readonly wrapG: G;
  private readonly topAxes: AxesLayer;
  private readonly chart: LineChartLayer;
  private readonly labelsG: G;
  private readonly noDipG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'gb-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Eğitim ve doğrulama hatasının ağaç sayısına göre değişimi');
    this.topAxesG = this.svg.append('g').attr('class', 'err-top-axes');
    this.topAxes = new AxesLayer(this.topAxesG);
    this.topG = this.svg.append('g').attr('class', 'err-top');
    this.legendG = this.svg.append('g').attr('class', 'err-legend');
    this.wrapG = this.svg.append('g').attr('class', 'err-chart');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.chart = new LineChartLayer(this.wrapG.append('g').attr('class', 'err-lines'), this.measure);
    this.labelsG = this.wrapG.append('g').attr('class', 'err-labels');
    this.noDipG = this.wrapG.append('g').attr('class', 'err-nodip');
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
  update(v: ErrorView, ms: number): void {
    this.interrupt();
    const lab = this.mode === 'lab';
    const fonts = this.measure.fonts(this.mode);
    const tick = fonts.tick;
    const gap = Math.round(tick * 0.45);
    const topH = v.top ? Math.round(this.h * TOP_SHARE) : 0;
    const spec = this.specFor(v, lab);

    const area = Math.max(80, this.h - topH);
    const plot = this.chart.plotRect(this.w, area, spec);
    // room at the right for the curve-end labels
    const labW = this.measure.maxWidth(v.endLabels.map((l) => l.text), 'tick', tick);
    plot.width = Math.max(60, plot.width - Math.max(0, labW + gap - tick * 0.5));
    this.wrapG.attr('transform', `translate(0,${topH})`);
    this.chart.draw(spec, plot, ms);
    this.drawEndLabels(v.endLabels, spec, plot, tick, gap);
    this.drawNoDip(v.noDip, plot, tick);
    this.drawTop(v.top, plot, topH, tick, gap, ms);
  }

  /** The chart spec for this mode: Lab-only marker rules and the emphasised / muted curves. */
  private specFor(v: ErrorView, lab: boolean): LineChartSpec {
    const c = v.chart;
    // step 9 shrinks the chart: a short y title, and the legend already names M, so the marker has no label
    const small = v.top !== null;
    return {
      ...c,
      yTitle: small ? 'hata (log)' : c.yTitle,
      marker: v.labMarker && !lab ? null : small && c.marker ? { ...c.marker, label: '' } : c.marker,
      series: c.series.map((s) =>
        lab && v.selectedId ? { ...s, cls: `${s.cls} ${s.id === v.selectedId ? 'emph' : 'muted'}` } : s,
      ),
    };
  }

  private drawEndLabels(labels: EndLabel[], spec: LineChartSpec, plot: Rect, tick: number, gap: number): void {
    const sc = fitViewport({ x: spec.x, y: spec.y }, plot, false);
    const ys = dodge(
      labels.map((l) => sc.y(l.y)),
      tick * 1.4,
      plot.top + tick * 0.5,
      plot.top + plot.height - tick * 0.8,
    );
    const cls = (id: string): string => spec.series.find((s) => s.id === id)?.cls ?? '';
    this.labelsG
      .selectAll<SVGTextElement, EndLabel>('text.end-label')
      .data(labels, (d) => d.id)
      .join('text')
      .attr('class', (d) => `end-label ${cls(d.id)}`)
      .attr('x', r1(plot.left + plot.width + gap))
      .attr('y', (_, i) => r1(ys[i] + tick * 0.35))
      .text((d) => d.text);
  }

  private drawNoDip(text: string | null, plot: Rect, tick: number): void {
    this.noDipG
      .selectAll<SVGTextElement, string>('text.no-dip')
      .data(text ? [text] : [])
      .join('text')
      .attr('class', 'no-dip')
      .attr('text-anchor', 'end')
      .attr('x', r1(plot.left + plot.width - 8))
      .attr('y', r1(plot.top + tick * 1.5))
      .text((d) => d);
  }

  /** Step 9's top panel and its legend; nothing on other steps. */
  private drawTop(top: TopView | null, plot: Rect, topH: number, tick: number, gap: number, ms: number): void {
    const dataG = this.topG;
    this.topAxesG.attr('display', top ? null : 'none');
    if (!top) {
      dataG.selectAll('*').remove();
      this.legendG.selectAll('*').remove();
      return;
    }
    const axis = this.measure.fonts(this.mode).axis;
    const items = this.legendItems(top);
    const rowH = tick * 1.5;
    // legend items flow into rows across the width
    const widths = items.map((it) => 26 + 6 + this.measure.width(it.text, 'tick', tick) + 18);
    const placed: { x: number; row: number }[] = [];
    let x = PAD;
    let row = 0;
    widths.forEach((wd) => {
      if (x > PAD && x + wd > this.w - PAD) {
        x = PAD;
        row += 1;
      }
      placed.push({ x, row });
      x += wd;
    });
    const legendH = (row + 1) * rowH + gap;
    this.drawLegend(items, placed, rowH, tick);

    const below = gap + tick * 1.2 + tick * 0.6;
    const rect: Rect = {
      left: plot.left,
      top: legendH + tick * 0.4,
      width: plot.width,
      height: Math.max(50, topH - legendH - tick * 0.4 - below),
    };
    const sc = fitViewport({ x: X_DOMAIN, y: top.y }, rect, false);
    const ticks: number[] = [];
    for (let t = Math.ceil(top.y[0]); t <= top.y[1]; t += 1) ticks.push(t);
    const yTickW = this.measure.maxWidth(['−1,5', '−1,0', '0,5'], 'tick', tick);
    this.topAxes.draw(
      sc,
      rect,
      {
        xTickCount: 6,
        yTickCount: 4,
        xTicks: [0, 2, 4, 6, 8, 10],
        yTicks: ticks,
        xTickY: rect.top + rect.height + gap + tick * 0.9,
        yTickX: rect.left - gap,
        xTitle: { x: rect.left + rect.width / 2, y: rect.top + rect.height + gap + tick * 1.2 + axis * 0.9, text: '' },
        yTitle: { x: rect.left - gap - yTickW - gap - axis * 0.3, y: rect.top + rect.height / 2, lines: ['y'] },
      },
      ms,
      'err-top',
    );

    const r = Math.max(3.5, tick * 0.3);
    // the soft F first and the zigzag over it; the points on top so the zigzag is seen passing through them
    const lines: { cls: string; segs: StepSegment[] }[] = [
      { cls: 'f-line soft', segs: top.soft },
      { cls: 'f-line zig', segs: top.zig },
    ];
    dataG
      .selectAll<SVGPathElement, (typeof lines)[number]>('path.f-line')
      .data(lines, (d) => d.cls)
      .join('path')
      .attr('class', (d) => d.cls)
      .attr('fill', 'none')
      .attr('d', (d) => stepPath(d.segs, sc.x, sc.y))
      .order();
    const dots = (cls: string, data: GbPoint[]): void => {
      dataG
        .selectAll<SVGCircleElement, GbPoint>(`circle.${cls}`)
        .data(data)
        .join('circle')
        .attr('class', cls)
        .attr('r', r)
        .attr('cx', (d) => r1(sc.x(d.x)))
        .attr('cy', (d) => r1(sc.y(d.y)))
        .raise();
    };
    dots('pt', top.points);
    dots('pt-val', top.valPoints);
  }

  private legendItems(top: TopView): { cls: string; text: string }[] {
    const items = [
      { cls: 'leg-soft', text: `${top.softTrees} ağaç (dip)` },
      { cls: 'leg-zig', text: `${top.zigTrees} ağaç` },
    ];
    if (top.valPoints.length) items.push({ cls: 'leg-val', text: 'doğrulama' });
    return items;
  }

  private drawLegend(items: { cls: string; text: string }[], at: { x: number; row: number }[], rowH: number, tick: number): void {
    const item = this.legendG
      .selectAll<SVGGElement, { cls: string; text: string }>('g.leg-item')
      .data(items, (d) => d.cls)
      .join((enter) => {
        const g = enter.append('g');
        g.append('line');
        g.append('circle');
        g.append('text').attr('class', 'leg-label');
        return g;
      })
      .attr('class', (d) => `leg-item ${d.cls}`);
    item.each(function (d, i) {
      const g = select(this);
      const y = r1(PAD + tick * 0.6 + at[i].row * rowH);
      const x = at[i].x;
      const dot = d.cls === 'leg-val';
      g.select('line')
        .attr('display', dot ? 'none' : null)
        .attr('x1', r1(x))
        .attr('x2', r1(x + 26))
        .attr('y1', y)
        .attr('y2', y);
      g.select('circle')
        .attr('display', dot ? null : 'none')
        .attr('cx', r1(x + 13))
        .attr('cy', y)
        .attr('r', Math.max(3.5, tick * 0.3));
      g.select('text')
        .attr('x', r1(x + 32))
        .attr('y', r1(y + tick * 0.35))
        .text(d.text);
    });
  }
}
