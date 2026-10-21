import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import { scaleLinear } from 'd3-scale';
import type { Mode } from '../../core/mode';
import { FRAME, GRID, NAVY, r1 } from '../../core/plot/marks';
import { staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { ScreeView } from './view';

/** Durations before `durationScale`. */
const GROW_MS = 600;
const LINE_DELAY_MS = 300;
const LINE_MS = 600;
const NAMES = ['pca-scree', 'pca-scree-line'];
const Y_TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
/** Distance in px between a bar top and its label baseline. */
const LABEL_LIFT = 12;

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

interface Lay { rect: Rect; fonts: { tick: number; axis: number }; gap: number }
interface Plot { left: number; top: number; width: number; height: number }

/**
 * The explained-variance page of `pca`: twelve bars (the first `k` filled), the
 * cumulative curve with its points, and the dashed threshold line. Bars grow and
 * the curve is drawn only when the page first appears (fixed duration × `ds`,
 * `ms > 0` is just the animate flag); a threshold change is instant.
 */
export class ScreeLayer {
  private readonly root: G;
  private readonly measure: TextMeasure;
  private readonly frame: El<SVGRectElement>;
  private readonly gx: G;
  private readonly gy: G;
  private readonly xTitle: El<SVGTextElement>;
  private readonly yTitle: El<SVGTextElement>;
  private readonly barsG: G;
  private readonly labelsG: G;
  private readonly line: El<SVGPathElement>;
  private readonly ptsG: G;
  private readonly threshold: El<SVGLineElement>;
  private readonly thLabel: El<SVGTextElement>;
  private readonly cumLabel: El<SVGTextElement>;

  private lay: Lay | null = null;
  private view: ScreeView | null = null;

  constructor(svgEl: SVGSVGElement, private readonly ds: number) {
    this.root = select(svgEl).append('g').attr('class', 'scree');
    this.frame = this.root.append('rect').attr('class', 'scree-frame').attr('fill', 'none').attr('stroke', FRAME);
    this.gx = this.root.append('g').attr('class', 'scree-axis x-axis');
    this.gy = this.root.append('g').attr('class', 'scree-axis y-axis');
    this.xTitle = this.root.append('text').attr('class', 'axis-title scree-title x').attr('text-anchor', 'middle');
    this.yTitle = this.root.append('text').attr('class', 'axis-title scree-title y').attr('text-anchor', 'middle');
    this.barsG = this.root.append('g').attr('class', 'bars');
    this.line = this.root.append('path').attr('class', 'cum-line').attr('fill', 'none').attr('stroke', NAVY);
    this.ptsG = this.root.append('g').attr('class', 'cum-pts');
    this.threshold = this.root.append('line').attr('class', 'threshold').attr('stroke-dasharray', '10 6');
    this.labelsG = this.root.append('g').attr('class', 'labels');
    this.thLabel = this.root.append('text').attr('class', 'threshold-label').attr('text-anchor', 'end');
    this.cumLabel = this.root.append('text').attr('class', 'cum-label').attr('text-anchor', 'end');
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.xTitle.text('Bileşen');
    this.yTitle.text('Açıklanan varyans oranı');
  }

  layout(rect: Rect, mode: Mode): void {
    const fonts = this.measure.fonts(mode);
    this.lay = { rect, fonts, gap: Math.round(fonts.tick * 0.45) };
    if (this.view) {
      this.cancel();
      this.draw(this.view, false, this.view);
    }
  }

  update(v: ScreeView | null, ms: number): void {
    this.cancel();
    const prev = this.view;
    this.view = v;
    if (!v) {
      this.root.style('display', 'none');
      return;
    }
    if (!this.lay) return;
    this.draw(v, ms > 0 && this.ds > 0, prev);
  }

  /** Cancels running transitions and snaps every element to its final state. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, false, this.view);
  }

  destroy(): void {
    this.cancel();
    this.root.remove();
  }

  private cancel(): void {
    for (const n of NAMES) this.root.selectAll('*').interrupt(n);
    for (const n of NAMES) this.root.interrupt(n);
  }

  // ------------------------------------------------------------- draw
  private draw(v: ScreeView, animate: boolean, prev: ScreeView | null): void {
    const { rect, fonts, gap } = this.lay!;
    const lh = fonts.tick * 1.2;
    this.root.style('display', '');

    // ---- layout
    const yTickW = this.measure.maxWidth(Y_TICKS.map(pct), 'tick', fonts.tick);
    const left = Math.round(rect.left + fonts.axis * 1.3 + 2 * gap + yTickW);
    const top = Math.round(rect.top + 3.6 * lh); // room above the plot for the stacked labels
    const plot: Plot = {
      left,
      top,
      width: Math.max(40, rect.left + rect.width - gap - fonts.tick - left),
      height: Math.max(40, rect.top + rect.height - (fonts.tick * 1.5 + 2 * gap + fonts.axis * 1.5) - top),
    };
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    const idx = v.evr.map((_, i) => i);
    const band = plot.width / idx.length;
    const barW = Math.round(band * 0.64);
    const cx = (i: number): number => plot.left + (i + 0.5) * band;
    const sy = scaleLinear().domain([0, 1]).range([bottom, plot.top]);

    // ---- axes
    this.frame.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    const xs = this.gx.selectAll<SVGGElement, number>('g.tick').data(idx, (d) => d).join((enter) => {
      const g = enter.append('g').attr('class', 'tick');
      g.append('text').attr('text-anchor', 'middle');
      return g;
    });
    xs.attr('transform', (d) => `translate(${r1(cx(d))},0)`);
    xs.select<SVGTextElement>('text').attr('y', r1(bottom + gap + fonts.tick * 0.9)).text((d) => String(d + 1));
    const ys = this.gy.selectAll<SVGGElement, number>('g.tick').data(Y_TICKS, (d) => d).join((enter) => {
      const g = enter.append('g').attr('class', 'tick');
      g.append('line').attr('stroke', GRID);
      g.append('text').attr('text-anchor', 'end').attr('dy', '0.35em');
      return g;
    });
    ys.attr('transform', (d) => `translate(0,${r1(sy(d))})`);
    ys.select('line').attr('x1', plot.left).attr('x2', right);
    ys.select<SVGTextElement>('text').attr('x', r1(plot.left - gap)).text(pct);
    this.xTitle.attr('x', r1(plot.left + plot.width / 2)).attr('y', r1(bottom + 2 * gap + fonts.tick * 0.9 + fonts.axis * 1.1));
    this.yTitle.attr('transform', `translate(${r1(rect.left + fonts.axis * 0.8)},${r1(plot.top + plot.height / 2)}) rotate(-90)`);

    // ---- bars grow from the baseline when the page first appears
    const k = v.k ?? 0;
    const growMs = animate && prev === null ? GROW_MS * this.ds : 0;
    const bars = this.barsG.selectAll<SVGRectElement, number>('rect.bar').data(idx, (d) => d).join((enter) =>
      enter.append('rect').attr('data-i', (d) => d).attr('y', bottom).attr('height', 0));
    bars.attr('class', (d) => (d < k ? 'bar kept' : 'bar'))
      .attr('x', (d) => r1(cx(d) - barW / 2)).attr('width', barW);
    tr(bars, 'pca-scree', growMs)
      .attr('y', (d) => r1(sy(v.evr[d]))).attr('height', (d) => r1(bottom - sy(v.evr[d])));
    this.root.attr('data-k', v.k ?? '');

    // ---- cumulative curve (drawn in after the bars), points, threshold
    const cum = v.cum;
    const pts: [number, number][] = cum ? cum.map((c, i) => [cx(i), sy(c)]) : [];
    const drawIn = growMs > 0 && cum !== null;
    this.line.attr('display', cum ? null : 'none');
    if (drawIn) {
      const paint = (frac: number): void => { this.line.attr('d', polyline(pts, frac)); };
      paint(0);
      this.root.transition('pca-scree-line').delay(LINE_DELAY_MS * this.ds).duration(LINE_MS * this.ds)
        .ease(easeCubicInOut).tween('draw', () => paint);
    } else {
      this.line.attr('d', polyline(pts, 1));
    }
    const dots = this.ptsG.selectAll<SVGCircleElement, [number, number]>('circle.cum-pt').data(pts).join('circle')
      .attr('class', 'cum-pt').attr('cx', (d) => r1(d[0])).attr('cy', (d) => r1(d[1])).attr('r', 6)
      .attr('opacity', drawIn ? 0 : 1);
    if (drawIn) tr(dots, 'pca-scree-line', LINE_MS * this.ds, () => LINE_DELAY_MS * this.ds).attr('opacity', 1);
    const th = v.threshold;
    const ty = th ? r1(sy(th.t / 100)) : 0;
    this.threshold.attr('display', th ? null : 'none').attr('data-t', th?.t ?? '')
      .attr('x1', plot.left).attr('x2', right).attr('y1', ty).attr('y2', ty);

    // ---- labels: bar labels, the cumulative label and the threshold label share rows
    const lab = this.labelsG.selectAll<SVGTextElement, number>('text.bar-label').data(idx, (d) => d)
      .join('text').attr('class', 'bar-label').attr('text-anchor', 'middle')
      .text((d) => v.labels[d]);
    const items: { el: El<SVGTextElement>; x: number; y: number; cls: string; end: boolean }[] = [];
    lab.each((d, i, nodes) => {
      items.push({ el: select(nodes[i]) as unknown as El<SVGTextElement>, x: cx(d), y: sy(v.evr[d]) - LABEL_LIFT, cls: 'bar-label', end: false });
    });
    const hasCum = cum !== null && k > 0;
    this.cumLabel.text(v.cumLabel ?? '').attr('display', hasCum ? null : 'none');
    this.thLabel.text(th?.label ?? '').attr('display', th ? null : 'none');
    if (hasCum) items.push({ el: this.cumLabel, x: cx(k - 1) - gap * 1.5, y: sy(cum[k - 1]) - gap, cls: 'cum-label', end: true });
    if (th) items.push({ el: this.thLabel, x: right, y: ty - gap, cls: 'threshold-label', end: true });
    const boxes = items.map((it) => {
      const w = this.measure.width(it.el.text(), it.cls, fonts.tick);
      return { x: it.end ? it.x - w / 2 : it.x, w };
    });
    const rows = staggerRows(boxes, 8);
    items.forEach((it, i) => { it.el.attr('x', r1(it.x)).attr('y', r1(it.y - rows[i] * lh)); });
    lab.attr('opacity', growMs > 0 ? 0 : 1);
    tr(lab, 'pca-scree', growMs).attr('opacity', 1);
  }
}

const pct = (ratio: number): string => `%${Math.round(ratio * 100)}`;

/** Path through the first `frac` (0..1) of the polyline `pts`. */
function polyline(pts: [number, number][], frac: number): string {
  if (pts.length === 0) return '';
  const span = (pts.length - 1) * Math.min(1, Math.max(0, frac));
  const whole = Math.floor(span);
  let d = '';
  for (let i = 0; i <= whole; i++) d += `${i === 0 ? 'M' : 'L'}${r1(pts[i][0])},${r1(pts[i][1])}`;
  if (whole < pts.length - 1 && span > whole) {
    const t = span - whole;
    const [ax, ay] = pts[whole];
    const [bx, by] = pts[whole + 1];
    d += `L${r1(ax + (bx - ax) * t)},${r1(ay + (by - ay) * t)}`;
  }
  return d;
}
