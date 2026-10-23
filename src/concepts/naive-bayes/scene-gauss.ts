import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import type { Mode } from '../../core/mode';
import { AxesLayer, type AxesSpec } from '../../core/plot/axes';
import { curvePath, curvePathV } from '../../core/plot/density';
import { GridLayer, type GridSize } from '../../core/plot/grid-layer';
import { MARK, NAVY, TEXT, WHITE, r1, trianglePath } from '../../core/plot/marks';
import { BODY_FALLBACK, TextMeasure, type Fonts } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { fitViewport, type Rect, type Scales } from '../../core/plot/viewport';
import { DOMAIN, FEATURES, gauss } from './data';
import { logPdf, pdf, type GaussModel } from './gaussian';
import { BarLayer } from './scene-bar';
import type { NbView } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Transition name of everything this layer animates in its SVG (interrupted on every update). */
const GAUSS_T = 'gauss';
/** Tint opacity per mode: a projector washes light tints out, so Ders is stronger (as k-NN). */
const REGION_ALPHA: Record<Mode, number> = { lab: 0.12, ders: 0.22 };
/** The new customer's draggable range: contract 1-59 months, 0-5 complaints (continuous). */
const T_RANGE = [1, 59] as const;
const C_RANGE = [0, 5] as const;
/** Samples per bell curve. */
const CURVE_N = 121;
const CLS = ['kaldi', 'ayrildi'] as const;
/** Ayrıldı curves are dashed: the two classes differ without hue. */
const DASH = [null, '9 6'] as const;
/** Stroke width of a height mark; a feature's two class marks stand side by side. */
const MARK_W = 6;

export type PointerKind = 'down' | 'move' | 'up';
/** A drag of the new customer: contract `t` and complaints `c`, already clamped. */
export type QueryPointer = (q: { t: number; c: number }, kind: PointerKind) => void;

type Sel<E extends Element> = Selection<E, unknown, null, undefined>;
interface Pt { i: number; t: number; c: number; jy: number }

interface Layout extends AxesSpec {
  fonts: Fonts;
  plot: Rect;
  /** Height of the contract curves' band above the plot, width of the complaint curves' band right of it. */
  topH: number;
  rightW: number;
  ptR: number;
  querySide: number;
  queryLabelW: number;
  /** Class key in the free corner above the complaint curves: line sample, then text. */
  legend: { x: number; y: [number, number]; sample: number };
  /** The posterior bar's band under the x axis title. */
  bar: { top: number; h: number };
}

/**
 * Ders 1280 × 720: the contract curves above the scatter, the complaint curves
 * to its right, the class key in the corner between them, the posterior bar in
 * a band under the x axis title (the strip of scene.ts follows below).
 */
function computeLayout(w: number, h: number, mode: Mode, m: TextMeasure): Layout {
  const fonts = m.fonts(mode);
  const body = m.fontPx('chip-text', BODY_FALLBACK[mode]);
  const pad = 10;
  const gap = Math.round(fonts.tick * 0.45);
  const ptR = mode === 'ders' ? 8 : 6;
  const sample = Math.round(fonts.axis * 1.2);
  const legendW = m.maxWidth(['● Kaldı', '▲ Ayrıldı'], 'legend', fonts.axis);
  const rightW = Math.max(Math.round(w * 0.1), Math.ceil(sample + 6 + legendW) + 2 * pad);
  const topH = Math.max(Math.round(h * 0.13), Math.ceil(fonts.axis * 2.6));
  // scene-bar.ts in part 3: 12 px, the labels' baseline, half a body line, the bar, then air
  const barH = 12 + Math.round(fonts.title * 0.85) + Math.round(body * 0.5) + Math.round(body * 1.6) + 10;

  const yTickW = m.maxWidth(['0', '5'], 'tick', fonts.tick);
  const left = pad + fonts.axis * 1.2 + gap + yTickW + gap;
  const top = pad + topH;
  const axisBelow = gap + fonts.tick * 1.2 + gap + fonts.axis * 1.25 + 4;
  const plot: Rect = {
    left, top, width: Math.max(40, w - left - rightW), height: Math.max(40, h - top - axisBelow - barH),
  };
  const xTickY = top + plot.height + gap + fonts.tick * 0.9;
  const xTitleY = xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95;
  const legendX = plot.left + plot.width + pad;
  return {
    fonts, plot, topH, rightW, ptR,
    querySide: ptR * 1.6 * Math.SQRT2,
    queryLabelW: m.width('Yeni müşteri', 'query-label', fonts.tick),
    legend: { x: legendX, y: [pad + fonts.axis, pad + fonts.axis * 2.25], sample },
    bar: { top: Math.round(top + plot.height + axisBelow), h: barH },
    xTickCount: Math.max(2, Math.round(plot.width / (fonts.tick * 6))),
    yTickCount: 6,
    yTicks: [0, 1, 2, 3, 4, 5],
    xTickY,
    yTickX: left - gap,
    xTitle: { x: left + plot.width / 2, y: xTitleY, text: FEATURES[0] },
    yTitle: { x: pad + fonts.axis * 0.95, y: top + plot.height / 2, lines: [FEATURES[1]] },
  };
}

/**
 * GridLayer fill for GaussianNB's decision regions: each cell gets
 * argmax(proba) at its centre in data space (x over the scale's x domain,
 * row 0 = the top of the plot; 1 = Ayrıldı only where it is strictly more
 * likely, as numpy's argmax keeps the first class on a tie). The log-posterior
 * difference is a contract term plus a complaint term, so each is computed once
 * per column and once per row.
 */
export function regionFill(m: GaussModel, sc: Scales): (g: GridSize, out: Uint8Array) => void {
  const [x0, x1] = sc.x.domain();
  const [y0, y1] = sc.y.domain();
  return (g, out) => {
    const dx = new Float64Array(g.cols);
    for (let c = 0; c < g.cols; c++) {
      const t = x0 + ((c + 0.5) / g.cols) * (x1 - x0);
      dx[c] = logPdf(m, 1, 0, t) - logPdf(m, 0, 0, t);
    }
    const prior = Math.log(m.prior[1]) - Math.log(m.prior[0]);
    for (let r = 0, i = 0; r < g.rows; r++) {
      const c = y1 - ((r + 0.5) / g.rows) * (y1 - y0); // row 0 = top
      const dy = prior + logPdf(m, 1, 1, c) - logPdf(m, 0, 1, c);
      for (let col = 0; col < g.cols; col++, i++) out[i] = dy + dx[col] > 0 ? 1 : 0;
    }
  };
}

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.max(lo, Math.min(hi, v));
const TRANSLATE = /translate\(([-\d.e]+),([-\d.e]+)\)/;

/**
 * Moves `sel` to translate(x, y), animated by tweening the two numbers directly
 * (no SVG matrix parsing). Returns the transition (or, at 0 ms, the selection)
 * so the caller chains further attributes onto the same transition.
 */
function moveTo(sel: AnySel, ms: number, x: number, y: number): AnySel {
  if (ms <= 0) return sel.attr('transform', `translate(${r1(x)},${r1(y)})`);
  return sel.transition(GAUSS_T).duration(ms).ease(easeCubicInOut)
    .attrTween('transform', function (this: SVGElement) {
      const m = TRANSLATE.exec(this.getAttribute('transform') ?? '');
      const a = m ? { x: Number(m[1]), y: Number(m[2]) } : { x, y };
      return (t: number) => `translate(${r1(a.x + (x - a.x) * t)},${r1(a.y + (y - a.y) * t)})`;
    }) as unknown as AnySel;
}

/**
 * Part 3 (steps 10-12): the 154 training customers (Kaldı teal ●, Ayrıldı
 * orange ▲, complaints jittered for display), one bell curve per class and
 * feature on the plot's top (contract) and right (complaints) edges, the new
 * customer (◆) with the posterior bar under the plot. Step 11 marks the four
 * curve heights at the customer; the decision regions (Canvas, under the SVG)
 * show while `regions` is on (step 12). In Ders the customer and the bar appear
 * at step 11; in Lab they are there from step 10, where the customer can be
 * dragged. Static parts (axes, points, curves) are redrawn only on relayout;
 * a drag frame moves the ◆, the marks and the bar only.
 */
export class GaussLayer {
  readonly svgEl: SVGSVGElement;
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly barHost: HTMLDivElement;
  private readonly bar: BarLayer;
  private readonly grid: GridLayer;
  private readonly svg: Sel<SVGSVGElement>;
  private readonly axes: AxesLayer;
  private readonly hit: Sel<SVGRectElement>;
  private readonly gMargT: Sel<SVGGElement>;
  private readonly gMargC: Sel<SVGGElement>;
  private readonly gMarksT: Sel<SVGGElement>;
  private readonly gMarksC: Sel<SVGGElement>;
  private readonly gPts: Sel<SVGGElement>;
  private readonly gLegend: Sel<SVGGElement>;
  private readonly gGuides: Sel<SVGGElement>;
  private readonly gQuery: Sel<SVGGElement>;
  private readonly measure: TextMeasure;
  private size: { w: number; h: number; mode: Mode } | null = null;
  private layout: Layout | null = null;
  private layoutKey = '';
  private drawnKey = '';
  private scales: Scales | null = null;
  /** The next update follows a hidden spell (or is the first): points and curves fade in. */
  private entering = true;
  private regionsOn = false;
  private marksOn = false;
  private readonly cbs = new Set<QueryPointer>();
  private captured: number | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.host = host;
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'regions';
    this.svgEl = doc.createElementNS(SVG_NS, 'svg');
    this.svgEl.setAttribute('class', 'plot gauss-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Müşteri dağılımı ve çan eğrileri');
    this.barHost = doc.createElement('div');
    this.barHost.className = 'gauss-bar';
    host.append(this.canvas, this.svgEl, this.barHost);
    this.bar = new BarLayer(this.barHost);
    this.grid = new GridLayer(this.canvas, MARK, REGION_ALPHA.ders, { measure: 'regions' });

    const svg = select(this.svgEl);
    this.svg = svg;
    this.axes = new AxesLayer(svg.append('g').attr('class', 'axes'));
    this.hit = svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
    const passive = (cls: string): Sel<SVGGElement> => svg.append('g').attr('class', cls).attr('pointer-events', 'none');
    this.gMargT = passive('marginal-t');
    this.gMargC = passive('marginal-c');
    this.gMarksT = this.gMargT.append('g').attr('class', 'marks').attr('display', 'none');
    this.gMarksC = this.gMargC.append('g').attr('class', 'marks').attr('display', 'none');
    this.gLegend = passive('legend');
    this.gPts = passive('points');
    this.gGuides = passive('query-guides').attr('display', 'none');
    this.gQuery = passive('query-layer');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);

    // one curve per class in each band; two height marks (and their tips) per band
    for (const [g, marks] of [[this.gMargT, this.gMarksT], [this.gMargC, this.gMarksC]] as const) {
      for (const k of [0, 1] as const) {
        g.insert('path', 'g.marks').attr('class', `marginal ${CLS[k]}`).attr('fill', 'none')
          .attr('stroke', MARK[k]).attr('stroke-width', 3).attr('stroke-dasharray', DASH[k]);
        marks.append('line').attr('class', `height-mark ${CLS[k]}`).attr('stroke', MARK[k]).attr('stroke-width', MARK_W);
      }
      marks.append('circle').attr('class', 'height-tip kaldi').attr('fill', MARK[0]).attr('stroke', WHITE);
      marks.append('path').attr('class', 'height-tip ayrildi').attr('fill', MARK[1]).attr('stroke', WHITE);
    }
    for (const k of ['t', 'c']) {
      this.gGuides.append('line').attr('class', `query-guide ${k}`).attr('stroke', NAVY).attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 4');
    }
    for (const k of [0, 1] as const) {
      const item = this.gLegend.append('g').attr('class', `key ${CLS[k]}`);
      item.append('line').attr('stroke', MARK[k]).attr('stroke-width', 3).attr('stroke-dasharray', DASH[k]);
      item.append('text').attr('fill', TEXT[k]).text(k === 0 ? '● Kaldı' : '▲ Ayrıldı');
    }

    this.svgEl.addEventListener('pointerdown', this.onDown);
    this.svgEl.addEventListener('pointermove', this.onMove);
    this.svgEl.addEventListener('pointerup', this.onUp);
    this.svgEl.addEventListener('pointercancel', this.onUp);
    this.svgEl.addEventListener('lostpointercapture', this.onLost);
  }

  /** Area (CSS px) and mode; the layout is recomputed on the next update when they change. */
  resize(w: number, h: number, mode: Mode): void {
    const s = this.size;
    if (s && s.w === w && s.h === h && s.mode === mode) return;
    this.size = { w, h, mode };
    this.grid.setAlpha(REGION_ALPHA[mode]);
  }

  /** Cancels running transitions (the caller re-renders right after). */
  interrupt(): void {
    this.svg.selectAll('*').interrupt(GAUSS_T);
    select(this.canvas).interrupt('regions');
    this.bar.interrupt();
  }

  /** The part was hidden: the next update fades the scene in again. */
  leave(): void {
    this.entering = true;
    this.regionsOn = false;
    this.marksOn = false;
    this.captured = null;
  }

  /** Renders part 3 of `v`; `ms` (already scaled) animates, 0 jumps. */
  update(v: NbView, ms: number): void {
    const G = v.gauss;
    if (!this.size || !G) return;
    this.interrupt();
    const L = this.relayout(G.model);
    const sc = this.scales!;

    // entry: points, curves and key fade in; afterwards (and after an interrupted fade) they settle at 1
    const fading = [this.gPts, this.gMargT, this.gMargC, this.gLegend];
    if (this.entering && ms > 0) for (const g of fading) g.attr('opacity', 0);
    this.entering = false;
    for (const g of fading) tr(g, GAUSS_T, ms).attr('opacity', 1);

    this.drawRegions(v.regions, G.model, sc, L.plot, ms);

    const showQuery = v.stepId !== 'gauss' || this.size.mode === 'lab';
    const qx = sc.x(G.query.t);
    const qy = sc.y(G.query.c);
    const cls: 0 | 1 = (v.bar?.spam ?? 0) > 0.5 ? 1 : 0;
    this.drawQuery(showQuery, qx, qy, cls, L, ms);
    this.drawMarks(v.stepId === 'yeni-musteri', G.model, G.heights, qx, qy, L, ms);

    this.barHost.hidden = !showQuery;
    if (showQuery) this.bar.update(v, ms);
  }

  /** Registers a drag callback: Lab only, while part 3 shows. */
  onPointer(cb: QueryPointer): void {
    this.cbs.add(cb);
  }

  destroy(): void {
    this.interrupt();
    this.svgEl.removeEventListener('pointerdown', this.onDown);
    this.svgEl.removeEventListener('pointermove', this.onMove);
    this.svgEl.removeEventListener('pointerup', this.onUp);
    this.svgEl.removeEventListener('pointercancel', this.onUp);
    this.svgEl.removeEventListener('lostpointercapture', this.onLost);
    this.cbs.clear();
    this.bar.destroy();
    this.canvas.remove();
    this.svgEl.remove();
    this.barHost.remove();
  }

  // ---------------------------------------------------------------- static parts

  /** Layout for the current size and mode; on a change the static parts are redrawn instantly. */
  private relayout(model: GaussModel): Layout {
    const { w, h, mode } = this.size!;
    const key = `${w}x${h}|${mode}`;
    if (key !== this.layoutKey || !this.layout) {
      this.layout = computeLayout(w, h, mode, this.measure);
      this.layoutKey = key;
      this.svgEl.setAttribute('width', String(w));
      this.svgEl.setAttribute('height', String(h));
      this.grid.resize(w, h);
      Object.assign(this.barHost.style, { top: `${this.layout.bar.top}px`, width: `${w}px`, height: `${this.layout.bar.h}px` });
      this.bar.resize(w, this.layout.bar.h, mode);
    }
    const L = this.layout;
    if (this.drawnKey !== key) {
      this.drawnKey = key;
      const sc = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] }, L.plot, false);
      this.scales = sc;
      const { plot } = L;
      this.hit.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
      this.axes.draw(sc, plot, L, 0, 'churn');
      this.drawCurves(model, sc, L);
      this.drawPoints(sc, L);
      this.drawLegend(L);
    }
    return L;
  }

  /** Density → px in each band: both classes of a feature share one scale, so their heights compare. */
  private bandScales(model: GaussModel, L: Layout): [number, number] {
    const peak = (f: 0 | 1): number => Math.max(...([0, 1] as const).map((k) => 1 / Math.sqrt(2 * Math.PI * model.var[k][f])));
    return [(L.topH - 8) / peak(0), (L.rightW - 18) / peak(1)];
  }

  private drawCurves(model: GaussModel, sc: Scales, L: Layout): void {
    const [kT, kC] = this.bandScales(model, L);
    const top = L.plot.top;
    const right = L.plot.left + L.plot.width;
    const toT = (d: number): number => top - d * kT;
    const toC = (d: number): number => right + d * kC;
    for (const k of [0, 1] as const) {
      const tD = curvePath((t) => pdf(model, k, 0, t), DOMAIN.x[0], DOMAIN.x[1], CURVE_N, sc.x, toT);
      const cD = curvePathV((c) => pdf(model, k, 1, c), DOMAIN.y[0], DOMAIN.y[1], CURVE_N, toC, sc.y);
      this.gMargT.select(`path.marginal.${CLS[k]}`).attr('d', tD);
      this.gMargC.select(`path.marginal.${CLS[k]}`).attr('d', cD);
    }
  }

  private drawPoints(sc: Scales, L: Layout): void {
    const data: Pt[] = gauss.train.map((r, i) => ({ i, t: r.t, c: r.c, jy: r.jy }));
    const pos = (d: Pt): string => `translate(${r1(sc.x(d.t))},${r1(sc.y(d.c + d.jy))})`;
    const ys = gauss.train.map((r) => r.y);
    const join = <E extends SVGElement>(tag: 'circle' | 'path', k: 0 | 1): Selection<E, Pt, SVGGElement, unknown> =>
      this.gPts.selectAll<E, Pt>(`${tag}.pt.${CLS[k]}`).data(data.filter((d) => ys[d.i] === k), (d) => d.i)
        .join((enter) => enter.append(tag).attr('class', `pt ${CLS[k]}`) as unknown as Selection<E, Pt, SVGGElement, unknown>)
        .attr('transform', pos).attr('fill', MARK[k]).attr('stroke', WHITE).attr('stroke-width', 1);
    join<SVGCircleElement>('circle', 0).attr('r', L.ptR);
    join<SVGPathElement>('path', 1).attr('d', trianglePath(L.ptR));
  }

  private drawLegend(L: Layout): void {
    const { x, y, sample } = L.legend;
    this.gLegend.selectAll<SVGGElement, unknown>('g.key').each(function (_, i) {
      const g = select(this);
      const base = y[i];
      const mid = r1(base - L.fonts.axis * 0.33);
      g.select('line').attr('x1', r1(x)).attr('x2', r1(x + sample)).attr('y1', mid).attr('y2', mid);
      g.select('text').attr('x', r1(x + sample + 6)).attr('y', r1(base));
    });
  }

  // ---------------------------------------------------------------- per update

  private drawRegions(on: boolean, model: GaussModel, sc: Scales, plot: Rect, ms: number): void {
    if (!on) {
      this.grid.update(null, plot, () => {});
      this.regionsOn = false;
      return;
    }
    const [x0, x1] = sc.x.domain();
    const [y0, y1] = sc.y.domain();
    // the model is fixed, so moving the customer never refills the grid
    this.grid.update(`gauss|${x0}|${x1}|${y0}|${y1}`, plot, regionFill(model, sc));
    const c = select(this.canvas);
    if (!this.regionsOn && ms > 0) c.style('opacity', '0').transition('regions').duration(ms).style('opacity', '1');
    else c.style('opacity', '1');
    this.regionsOn = true;
  }

  private drawQuery(show: boolean, qx: number, qy: number, cls: 0 | 1, L: Layout, ms: number): void {
    const at = `translate(${r1(qx)},${r1(qy)})`;
    const sel = this.gQuery.selectAll<SVGGElement, number>('g.q').data(show ? [0] : []).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'q').attr('opacity', ms > 0 ? 0 : 1).attr('transform', at);
        g.append('rect').attr('class', 'query').attr('transform', 'rotate(45)')
          .attr('stroke', NAVY).attr('stroke-width', 2.5).attr('fill', MARK[cls]);
        g.append('text').attr('class', 'query-label').text('Yeni müşteri');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, GAUSS_T, ms).attr('opacity', 0).remove(); },
    );
    if (!show) return;
    const s = L.querySide;
    const half = (s * Math.SQRT2) / 2;
    // the label sits upper right of the ◆, or upper left where it would leave the plot
    const flip = qx + half + 6 + L.queryLabelW > L.plot.left + L.plot.width;
    sel.select('rect.query').attr('x', r1(-s / 2)).attr('y', r1(-s / 2)).attr('width', r1(s)).attr('height', r1(s));
    sel.select('text.query-label').attr('text-anchor', flip ? 'end' : 'start')
      .attr('x', r1(flip ? -half - 6 : half + 6)).attr('y', r1(-half - 2));
    moveTo(sel, ms, qx, qy).attr('opacity', 1);
    tr(sel.select<SVGRectElement>('rect.query'), GAUSS_T, ms).attr('fill', MARK[cls]);
  }

  /** Step 11: each class's curve height at the customer, as two bars side by side per band, with dashed guides. */
  private drawMarks(
    show: boolean, model: GaussModel, heights: [[number, number], [number, number]],
    qx: number, qy: number, L: Layout, ms: number,
  ): void {
    const groups = [this.gMarksT, this.gMarksC, this.gGuides];
    for (const g of groups) g.attr('display', show ? null : 'none');
    if (!show) {
      this.marksOn = false;
      return;
    }
    if (!this.marksOn && ms > 0) for (const g of groups) g.attr('opacity', 0);
    this.marksOn = true;
    for (const g of groups) tr(g, GAUSS_T, ms).attr('opacity', 1);

    const [kT, kC] = this.bandScales(model, L);
    const top = L.plot.top;
    const right = L.plot.left + L.plot.width;
    const off = MARK_W / 2;
    const tipR = Math.max(5, L.ptR * 0.75);
    for (const k of [0, 1] as const) {
      const side = k === 0 ? -off : off;
      const ht = top - heights[0][k] * kT;
      const wc = right + heights[1][k] * kC;
      tr(this.gMarksT.select(`line.height-mark.${CLS[k]}`), GAUSS_T, ms)
        .attr('x1', r1(qx + side)).attr('x2', r1(qx + side)).attr('y1', r1(top)).attr('y2', r1(ht));
      tr(this.gMarksC.select(`line.height-mark.${CLS[k]}`), GAUSS_T, ms)
        .attr('y1', r1(qy + side)).attr('y2', r1(qy + side)).attr('x1', r1(right)).attr('x2', r1(wc));
      const tips: [Sel<SVGGElement>, number, number][] = [[this.gMarksT, qx + side, ht], [this.gMarksC, wc, qy + side]];
      for (const [g, x, y] of tips) {
        const tip = g.select<SVGElement>(`.height-tip.${CLS[k]}`);
        if (k === 0) tip.attr('r', r1(tipR)).attr('cx', 0).attr('cy', 0);
        else tip.attr('d', trianglePath(tipR));
        moveTo(tip, ms, x, y);
      }
    }
    tr(this.gGuides.select('line.query-guide.t'), GAUSS_T, ms)
      .attr('x1', r1(qx)).attr('x2', r1(qx)).attr('y1', r1(qy)).attr('y2', r1(top));
    tr(this.gGuides.select('line.query-guide.c'), GAUSS_T, ms)
      .attr('x1', r1(qx)).attr('x2', r1(right)).attr('y1', r1(qy)).attr('y2', r1(qy));
  }

  // ---------------------------------------------------------------- pointer

  /** Clamped customer under the pointer and whether it is inside the plot; null when no drag may happen. */
  private locate(ev: PointerEvent): { q: { t: number; c: number }; inside: boolean } | null {
    const L = this.layout;
    const sc = this.scales;
    if (!L || !sc || !this.size || this.size.mode !== 'lab' || this.host.hidden) return null;
    const box = this.svgEl.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const { plot } = L;
    const inside = px >= plot.left && px <= plot.left + plot.width && py >= plot.top && py <= plot.top + plot.height;
    return { q: { t: clamp(sc.x.invert(px), T_RANGE), c: clamp(sc.y.invert(py), C_RANGE) }, inside };
  }

  private emit(q: { t: number; c: number }, kind: PointerKind): void {
    for (const cb of [...this.cbs]) cb(q, kind);
  }

  private readonly onDown = (ev: PointerEvent): void => {
    if (ev.button > 0) return;
    const l = this.locate(ev);
    if (!l || !l.inside) return;
    this.captured = ev.pointerId ?? 0;
    try { this.svgEl.setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
    this.emit(l.q, 'down');
  };

  private readonly onMove = (ev: PointerEvent): void => {
    if (this.captured === null) return;
    const l = this.locate(ev);
    if (l) this.emit(l.q, 'move');
  };

  private readonly onUp = (ev: PointerEvent): void => {
    if (this.captured === null) return;
    try { this.svgEl.releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
    this.captured = null;
    const l = this.locate(ev);
    if (l) this.emit(l.q, 'up');
  };

  private readonly onLost = (): void => { this.captured = null; };
}
