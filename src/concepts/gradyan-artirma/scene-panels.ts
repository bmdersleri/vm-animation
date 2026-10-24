import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { formatNumber as f } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { stepPath } from '../../core/plot/step-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { X_DOMAIN, type BookRow, type GbPoint, type PanelView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<E extends Element, D> = Selection<E, D, SVGGElement, unknown>;

/** Outer padding (px) around the drawing. */
const PAD = 8;
/** Below this width the threshold labels alternate between two rows and the table flows under the panels. */
const NARROW = 700;

/**
 * The two stacked panels of the gradient boosting page (Ders steps 1-6): the top panel holds the
 * training points, the faint sin curve and the total prediction F; the bottom panel holds the
 * zero line, the residuals, the tree's correction h with its threshold labels. Both share the
 * x axis (0-10); the book's error table sits beside the panels, or under them on a narrow screen.
 */
export class PanelScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly topG: G;
  private readonly botG: G;
  private readonly tableG: G;
  private readonly topAxes: AxesLayer;
  private readonly botAxes: AxesLayer;
  private readonly topData: G;
  private readonly botData: G;
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
      .attr('aria-label', 'Eğitim noktaları, toplam tahmin F, artıklar ve ağacın düzeltmesi h');
    this.topG = this.svg.append('g').attr('class', 'panel top no-x');
    this.botG = this.svg.append('g').attr('class', 'panel bottom');
    this.topAxes = new AxesLayer(this.topG.append('g').attr('class', 'gb-axes'));
    this.botAxes = new AxesLayer(this.botG.append('g').attr('class', 'gb-axes'));
    this.topData = this.topG.append('g').attr('class', 'gb-data');
    this.botData = this.botG.append('g').attr('class', 'gb-data');
    this.tableG = this.svg.append('g').attr('class', 'book-table');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('line').interrupt('res');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws `p`; `ms` > 0 animates axes, step lines and residual lines. */
  update(p: PanelView, ms: number): void {
    this.interrupt();
    const fonts = this.measure.fonts(this.mode);
    const tick = fonts.tick;
    const axis = fonts.axis;
    const gap = Math.round(tick * 0.45);
    const narrow = this.w < NARROW;

    // the book table: a column beside the panels, or rows under them on a narrow screen
    const rows = p.table ?? [];
    const rowH = tick * 1.5;
    const colW = rows.length ? this.measure.maxWidth(rows.map((r) => r.text), 'tick', tick) + PAD * 2 : 0;
    const head = 'Eğitim hatası';
    let sideW = 0;
    let lane = 0;
    let cols = 1;
    if (rows.length) {
      if (narrow) {
        cols = Math.max(1, Math.floor((this.w - PAD * 2) / colW));
        lane = rowH * (Math.ceil(rows.length / cols) + 1) + PAD;
      } else {
        sideW = Math.max(colW, this.measure.width(head, 'axis-title', axis) + PAD * 2) + PAD;
      }
    }

    // plot rectangles: two panels share the left and right edges
    const tops = fonts.tick;
    const yTickW = this.measure.maxWidth(['−1,5', '−1,0', '0,5'], 'tick', tick);
    const left = PAD + axis * 1.2 + gap + yTickW + gap;
    const right = this.w - PAD - tick - sideW;
    const below = gap + tick * 1.2 + gap + axis * 1.25 + PAD;
    const usable = Math.max(120, this.h - lane - tops - below - tick * 1.4);
    const topH = Math.max(50, Math.round(usable * 0.52));
    const botH = Math.max(50, usable - topH);
    const topRect: Rect = { left, top: tops, width: Math.max(60, right - left), height: topH };
    const botRect: Rect = { left, top: tops + topH + tick * 1.4, width: topRect.width, height: botH };
    const sxTop = fitViewport({ x: X_DOMAIN, y: p.yTop }, topRect, false);
    const sxBot = fitViewport({ x: X_DOMAIN, y: p.yBottom }, botRect, false);
    const xTicks = [0, 2, 4, 6, 8, 10];
    const axesFor = (rect: Rect, title: string, withX: boolean, yTicks: number[]) => ({
      xTickCount: 6,
      yTickCount: 4,
      xTicks,
      yTicks,
      xTickY: rect.top + rect.height + gap + tick * 0.9,
      yTickX: rect.left - gap,
      xTitle: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height + gap + tick * 1.2 + gap + axis * 0.95,
        text: withX ? 'x' : '',
      },
      yTitle: { x: rect.left - gap - yTickW - gap - axis * 0.3, y: rect.top + rect.height / 2, lines: [title] },
    });
    const ticksOf = (d: [number, number]): number[] => {
      const out: number[] = [];
      for (let v = Math.ceil(d[0]); v <= d[1]; v += 1) out.push(v);
      return out;
    };
    this.topAxes.draw(sxTop, topRect, axesFor(topRect, 'y', false, ticksOf(p.yTop)), ms, 'top');
    this.botAxes.draw(sxBot, botRect, axesFor(botRect, 'artık r', true, ticksOf(p.yBottom)), ms, 'bot');

    this.drawTop(p, sxTop, ms, tick);
    this.drawBottom(p, sxBot, botRect, ms, tick, narrow);
    this.drawTable(p.table, head, narrow ? { x: PAD, y: this.h - lane + PAD, cols, colW } : { x: right + tick * 1.2 + PAD, y: tops + tick, cols: 1, colW }, rowH, axis);
  }

  private drawTop(
    p: PanelView,
    sc: ReturnType<typeof fitViewport>,
    ms: number,
    tick: number,
  ): void {
    const g = this.topData;
    const r = Math.max(3.5, tick * 0.3);
    const pathOn = (cls: string, data: unknown[], d: string): void => {
      const sel = g.selectAll<SVGPathElement, unknown>(`path.${cls}`).data(data).join('path').attr('class', cls).attr('fill', 'none');
      tr(sel, 'line', ms).attr('d', d);
    };
    pathOn('sin-ref', [0], p.sin.map((q, i) => `${i === 0 ? 'M' : 'L'}${r1(sc.x(q.x))},${r1(sc.y(q.y))}`).join(''));
    pathOn('f-prev', p.fPrev ? [0] : [], p.fPrev ? stepPath(p.fPrev, sc.x, sc.y) : '');
    const dots = (cls: string, data: GbPoint[]): Sel<SVGCircleElement, GbPoint> =>
      g
        .selectAll<SVGCircleElement, GbPoint>(`circle.${cls}`)
        .data(data)
        .join('circle')
        .attr('class', cls)
        .attr('r', r)
        .attr('cx', (d) => r1(sc.x(d.x)))
        .attr('cy', (d) => r1(sc.y(d.y)));
    dots('pt', p.points);
    dots('pt-val', p.valPoints);
    pathOn('f-line', p.f ? [0] : [], p.f ? stepPath(p.f, sc.x, sc.y) : '');
  }

  private drawBottom(
    p: PanelView,
    sc: ReturnType<typeof fitViewport>,
    rect: Rect,
    ms: number,
    tick: number,
    narrow: boolean,
  ): void {
    const g = this.botData;
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const zero = r1(sc.y(0));
    g.selectAll('line.zero-line')
      .data([0])
      .join('line')
      .attr('class', 'zero-line')
      .attr('x1', rect.left)
      .attr('x2', right)
      .attr('y1', zero)
      .attr('y2', zero);

    // threshold lines first so the residuals draw over them
    const thr = g
      .selectAll<SVGLineElement, number>('line.thr-line')
      .data(p.thresholds)
      .join('line')
      .attr('class', 'thr-line')
      .attr('y1', rect.top)
      .attr('y2', r1(bottom));
    thr.attr('x1', (d) => r1(sc.x(d))).attr('x2', (d) => r1(sc.x(d)));

    const res = g
      .selectAll<SVGLineElement, { x: number; r: number }>('line.res-line')
      .data(p.residuals)
      .join((enter) => enter.append('line').attr('y2', zero))
      .attr('class', 'res-line')
      .attr('x1', (d) => r1(sc.x(d.x)))
      .attr('x2', (d) => r1(sc.x(d.x)))
      .attr('y1', zero);
    tr(res, 'res', ms).attr('y2', (d) => r1(sc.y(d.r)));
    g.selectAll<SVGCircleElement, { x: number; r: number }>('circle.res-dot')
      .data(p.residuals)
      .join('circle')
      .attr('class', 'res-dot')
      .attr('r', Math.max(3.5, tick * 0.3))
      .attr('cx', (d) => r1(sc.x(d.x)))
      .attr('cy', (d) => r1(sc.y(d.r)));

    const hd = g.selectAll<SVGPathElement, unknown>('path.h-line').data(p.h ? [0] : []).join('path').attr('class', 'h-line').attr('fill', 'none');
    tr(hd, 'line', ms).attr('d', p.h ? stepPath(p.h, sc.x, sc.y) : '');

    // "x ≤ 2,651" beside each threshold; on a narrow screen the labels alternate between two rows
    const labels = g
      .selectAll<SVGTextElement, number>('text.thr-label')
      .data(p.thresholds)
      .join('text')
      .attr('class', 'thr-label')
      .attr('text-anchor', 'start')
      .text((d) => `x ≤ ${f(d, 3)}`);
    labels
      .attr('x', (d) => r1(Math.min(sc.x(d) + 4, right - this.measure.width(`x ≤ ${f(d, 3)}`, 'tick', tick) - 2)))
      .attr('y', (_, i) => r1(rect.top + tick * 1.05 + (narrow ? (i % 2) * tick * 1.25 : 0)));
  }

  private drawTable(
    rows: BookRow[] | null,
    head: string,
    at: { x: number; y: number; cols: number; colW: number },
    rowH: number,
    axis: number,
  ): void {
    const data = rows ?? [];
    this.tableG.selectAll('text.book-head').data(data.length ? [head] : []).join('text')
      .attr('class', 'book-head')
      .attr('x', at.x)
      .attr('y', r1(at.y))
      .text((d) => d);
    const per = Math.ceil(data.length / at.cols);
    this.tableG
      .selectAll<SVGGElement, BookRow>('g.book-row')
      .data(data, (d) => d.k)
      .join((enter) => {
        const g = enter.append('g');
        g.append('text');
        return g;
      })
      .attr('class', (d) => `book-row${d.filled ? ' filled' : ''}`)
      .each(function (d, i) {
        const col = Math.floor(i / per);
        const row = i % per;
        select(this)
          .select('text')
          .attr('x', r1(at.x + col * at.colW))
          .attr('y', r1(at.y + axis * 0.4 + rowH * (row + 1)))
          .text(d.text);
      });
  }
}
