import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { formatNumber as f } from '../../core/plot/format';
import { NAVY, r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport } from '../../core/plot/viewport';
import { narrowTableHeight, PatternTable } from './pattern-table';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { KernelView, LimeView } from './view';

/** Vertical room (px) kept by the kernel scene: root padding, gap to the stacked table, the smallest curve plot. */
export const KERNEL_PAD_V = 16;
export const KERNEL_PAD_V_NARROW = 8;
export const KERNEL_GAP = 8;
export const KERNEL_MIN_PLOT = 150;

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Step 5: the kernel weight curve on `AxesLayer` (distance d on x, weight on y, both from the data: d from 0 to
 * the largest distance rounded up, the weight from 0 to 1), the four distances as `.kernel-point`s with their
 * weights in `.kernel-weight`, and the pattern table with the weight column beside it (under it in one column).
 * A width that kills a weight shows 0,000, never NaN.
 */
export class KernelScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly curveG: G;
  private readonly pointG: G;
  private readonly table: PatternTable;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'kernel-scene');
    const wrap = el(doc, 'div', 'kernel-wrap');
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root).attr('class', 'kernel-plot').attr('role', 'img').attr('aria-label', 'Çekirdek eğrisi: uzaklığa göre örnek ağırlığı');
    this.axes = new AxesLayer(this.svg.append('g').attr('class', 'kernel-axes'));
    this.curveG = this.svg.append('g').attr('class', 'kernel-curves');
    this.pointG = this.svg.append('g').attr('class', 'kernel-points');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    wrap.append(root);
    this.table = new PatternTable(doc);
    this.root.append(wrap, this.table.root);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.table.destroy();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    if (!v.kernel) {
      return;
    }
    this.table.update(v.kernel.rows);
    this.draw(v.kernel, ms);
  }

  private draw(k: KernelView, ms: number): void {
    const narrow = this.w < NARROW;
    const fonts = this.measure.fonts(this.mode);
    const fs = fonts.tick;
    const afs = fonts.axis;
    const width = Math.max(240, narrow ? this.w - 8 : Math.floor(this.w * 0.5) - 12);
    // narrow: the table sits under the curve, so the curve takes what the stage has left
    const tableH = narrow ? narrowTableHeight(this.measure.fontPx('pattern-cell', 12)) : 0;
    const padV = narrow ? KERNEL_PAD_V_NARROW : KERNEL_PAD_V;
    const room = Math.floor(this.h - padV - (tableH > 0 ? tableH + KERNEL_GAP : 0));
    const height = Math.round(Math.max(KERNEL_MIN_PLOT, Math.min(width * 0.7, 360, room)));
    this.root.dataset.used = String(Math.ceil(height + padV + (tableH > 0 ? tableH + KERNEL_GAP : 0)));
    const left = Math.ceil(this.measure.width('0,00', 'tick', fs) + afs * 1.8 + 10);
    const top = fs * 0.8;
    // under the axis: tick line (d), weight line, then the axis title
    const bottom = fs * 1.3 + fs * 1.25 + afs * 1.65 + 4;
    const plot = { left, top, width: width - left - 14, height: height - top - bottom };
    this.svg.attr('width', width).attr('height', height);
    // weights lie between 0 and 1; the distance axis ends at the data-given upper end
    const sc = fitViewport({ x: k.domainD, y: [0, 1] }, plot, false);
    const labels = new Map(k.points.map((p) => [Math.round(p.d * p.d), p.dText]));
    const yTicks = plot.height < fs * 9 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    this.axes.draw(
      sc,
      plot,
      {
        xTickCount: 4,
        yTickCount: 5,
        xTickY: plot.top + plot.height + fs * 1.3,
        yTickX: plot.left - 6,
        xTicks: k.points.map((p) => p.d),
        yTicks,
        xFormat: (d) => labels.get(Math.round(d * d)) ?? f(d, 2),
        yFormat: (y) => f(y, 2),
        xTitle: { x: plot.left + plot.width / 2, y: plot.top + plot.height + fs * 2.55 + afs * 1.35, text: 'uzaklık d' },
        yTitle: { x: afs * 0.95, y: plot.top + plot.height / 2, lines: ['ağırlık'] },
      },
      ms,
      'kernel',
    );

    // the curve and its four points with drop lines and weights
    const path = k.curve.map((q, i) => `${i === 0 ? 'M' : 'L'}${r1(sc.x(q.d))},${r1(sc.y(q.w))}`).join('');
    this.curveG.selectAll<SVGPathElement, string>('path.kernel-curve').data([path]).join('path').attr('class', 'kernel-curve').attr('d', (d) => d);
    const r = fs * 0.4;
    const pts = this.pointG
      .selectAll<SVGGElement, KernelView['points'][number]>('g.kernel-point')
      .data(k.points, (d) => d.dText)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'kernel-point');
        g.append('line').attr('class', 'kernel-drop');
        g.append('circle').attr('fill', NAVY);
        g.append('text').attr('class', 'kernel-weight');
        return g;
      })
      .attr('data-d', (d) => r1(d.d * 1000) / 1000)
      .attr('data-w', (d) => (Number.isFinite(d.w) ? Math.round(d.w * 1e6) / 1e6 : 0));
    pts
      .select('line')
      .attr('x1', (d) => r1(sc.x(d.d)))
      .attr('x2', (d) => r1(sc.x(d.d)))
      .attr('y1', (d) => r1(sc.y(d.w)))
      .attr('y2', r1(plot.top + plot.height));
    pts
      .select('circle')
      .attr('cx', (d) => r1(sc.x(d.d)))
      .attr('cy', (d) => r1(sc.y(d.w)))
      .attr('r', r1(r));
    // the weights are written under their distance on the axis: no label meets the curve, a point or a tick
    const baseY = plot.top + plot.height + fs * 2.55;
    pts.select<SVGTextElement>('text').each((d, i, nodes) => {
      const half = this.measure.width(d.wText, 'tick', fs) / 2 + 2;
      const x = Math.min(width - half, Math.max(half, sc.x(d.d)));
      select(nodes[i])
        .attr('text-anchor', 'middle')
        .attr('x', r1(x))
        .attr('y', r1(baseY))
        .text(d.wText);
    });
  }
}
