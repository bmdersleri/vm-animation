import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { fitAspect, type Rect, type Scales } from '../../core/plot/viewport';
import { RAW } from './data';
import { UNIT_FACTOR, Z_FIT } from './space';
import type { CustView, OlcView } from './view';

/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'olc-scatter';
/** Unit / space change duration before `durationScale`; the caller passes `MOVE_MS * durationScale` as `ms`. */
export const MOVE_MS = 900;
const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

export type QueryPointer = (q: { t: number; f: number }, kind: 'down' | 'move' | 'up') => void;

type G = Selection<SVGGElement, unknown, null, undefined>;

interface Lay {
  w: number; h: number; plot: Rect; fonts: { tick: number; axis: number }; ptR: number; rowH: number; pad: number;
}
interface Item { k: string; text: string; cls: string; w: number; cx: number; ly: number; group: 'cust' | 'q' | 'mu' }
interface Axis { a: 'x' | 'y' }

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const AXES: Axis[] = [{ a: 'x' }, { a: 'y' }];

/**
 * The scatter of the `olcekleme` page: six customers, the draggable new
 * customer, six distance lines, the iso-distance ellipse (a circle once the
 * axes are equal), the μ lines with ±σ bands, and the unit / z transforms.
 * `update(v, ms, mode)` moves what changed over `ms` (0 = instantly); a query
 * drag passes 0. Text sizes come from the CSS tokens only.
 */
export class ScatterLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly measure: TextMeasure;
  private readonly hit: Selection<SVGRectElement, unknown, null, undefined>;
  private readonly clipRect: Selection<SVGRectElement, unknown, null, undefined>;
  private readonly gBands: G;
  private readonly gMu: G;
  private readonly gIso: G;
  private readonly gDist: G;
  private readonly gLeaders: G;
  private readonly gCust: G;
  private readonly gQ: G;
  private readonly gMuLabels: G;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: OlcView | null = null;
  private scales: Scales | null = null;
  private cbs: QueryPointer[] = [];
  private dragging = false;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'scale-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Hizmet süresi ve aylık fatura saçılım grafiği');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    const clipId = `olc-clip-${++uid}`;
    this.clipRect = svg.append('defs').append('clipPath').attr('id', clipId).append('rect');
    this.axes = new AxesLayer(svg.append('g').attr('class', 'axes'));
    this.hit = svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
    const clipped = svg.append('g').attr('class', 'clipped').attr('clip-path', `url(#${clipId})`).attr('pointer-events', 'none');
    this.gBands = clipped.append('g').attr('class', 'bands');
    this.gMu = clipped.append('g').attr('class', 'mus');
    this.gIso = clipped.append('g').attr('class', 'isos');
    this.gDist = clipped.append('g').attr('class', 'dists');
    this.gLeaders = svg.append('g').attr('class', 'leaders').attr('pointer-events', 'none');
    this.gCust = svg.append('g').attr('class', 'cust').attr('pointer-events', 'none');
    this.gQ = svg.append('g').attr('class', 'q').attr('pointer-events', 'none');
    this.gMuLabels = svg.append('g').attr('class', 'mu-labels').attr('pointer-events', 'none');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);

    this.hit.on('pointerdown', (ev: PointerEvent) => {
      if (ev.button > 0) return;
      this.dragging = true;
      try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
      this.emit(ev, 'down');
    });
    this.hit.on('pointermove', (ev: PointerEvent) => this.emit(ev, 'move'));
    const up = (ev: PointerEvent): void => {
      if (!this.dragging) return;
      this.dragging = false;
      try { (ev.target as Element).releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
      this.emit(ev, 'up');
    };
    this.hit.on('pointerup', up);
    this.hit.on('pointercancel', up);
  }

  onPointer(cb: QueryPointer): void { this.cbs.push(cb); }

  resize(w: number, h: number, mode: Mode): void {
    if (this.lay && this.lay.w === w && this.lay.h === h && this.mode === mode) return;
    this.mode = mode;
    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
    this.lay = this.layout(w, h);
    if (this.view) {
      this.cancel();
      this.draw(this.view, 0);
    }
  }

  update(v: OlcView, ms: number, mode: Mode): void {
    this.cancel();
    this.view = v;
    if (mode !== this.mode) {
      this.mode = mode;
      if (this.lay) {
        this.lay = this.layout(this.lay.w, this.lay.h);
        this.draw(v, 0);
      }
      return;
    }
    if (this.lay) this.draw(v, ms);
  }

  /** Cancels running transitions and snaps every element to its final position. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, 0);
  }

  destroy(): void {
    this.cancel();
    this.cbs = [];
    this.svgEl.remove();
  }

  private cancel(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('*').interrupt('axes');
  }

  // ------------------------------------------------------------- pointer
  private emit(ev: PointerEvent, kind: 'down' | 'move' | 'up'): void {
    const q = this.toRaw(ev);
    if (!q) return;
    for (const cb of [...this.cbs]) cb(q, kind);
  }

  /** px -> data of the current space -> raw (month, TL), clamped to the data box. */
  private toRaw(ev: PointerEvent): { t: number; f: number } | null {
    const s = this.view?.scatter;
    if (!s || !this.scales) return null;
    const box = this.svgEl.getBoundingClientRect();
    const x = this.scales.x.invert(ev.clientX - box.left);
    const y = this.scales.y.invert(ev.clientY - box.top);
    const k = UNIT_FACTOR[s.unit];
    let t: number;
    let f: number;
    if (s.space === 'z') {
      t = x * Z_FIT.t.scale + Z_FIT.t.center;
      f = y * Z_FIT.f.scale + Z_FIT.f.center;
    } else if (s.space === 'kaydir') {
      t = (x + Z_FIT.t.center * k) / k;
      f = y + Z_FIT.f.center;
    } else {
      t = x / k;
      f = y;
    }
    return { t: clamp(t, RAW.x[0], RAW.x[1]), f: clamp(f, RAW.y[0], RAW.y[1]) };
  }

  // ------------------------------------------------------------- layout
  private layout(w: number, h: number): Lay {
    const fonts = this.measure.fonts(this.mode);
    const pad = 10;
    const gap = Math.round(fonts.tick * 0.45);
    const yTickW = this.measure.width('2000', 'tick', fonts.tick);
    const left = pad + fonts.axis * 1.2 + gap + yTickW + gap;
    const top = pad + 6;
    const axisBelow = gap + fonts.tick * 1.2 + gap + fonts.axis * 1.25 + pad;
    const plot: Rect = {
      left, top,
      width: Math.max(40, w - left - pad - 10),
      height: Math.max(40, h - top - axisBelow),
    };
    return { w, h, plot, fonts, pad, ptR: this.mode === 'ders' ? 9 : 7, rowH: Math.round(fonts.tick * 1.45) };
  }

  // ------------------------------------------------------------- draw
  private draw(v: OlcView, ms: number): void {
    const L = this.lay!;
    const s = v.scatter;
    this.svgEl.style.display = s ? '' : 'none';
    if (!s) return;
    const { plot } = L;
    const gap = Math.round(L.fonts.tick * 0.45);

    // the month box fills the plot; other units / spaces keep the same px per unit ratio
    const r0 = (plot.width / 64) / (plot.height / 190);
    const sc = fitAspect(s.box, plot, s.aspect === 'ay-orani' ? r0 : 1);
    this.scales = sc;
    const px = (x: number): number => sc.x(x);
    const py = (y: number): number => sc.y(y);
    const ux = Math.abs(sc.x(1) - sc.x(0));
    const uy = Math.abs(sc.y(1) - sc.y(0));
    const right = plot.left + plot.width;
    const bottom = plot.top + plot.height;

    this.clipRect.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    this.hit.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);

    const xTickY = bottom + gap + L.fonts.tick * 0.9;
    this.axes.draw(sc, plot, {
      xTickCount: Math.max(2, Math.round(plot.width / (L.fonts.tick * 6))),
      yTickCount: Math.max(2, Math.round(plot.height / (L.fonts.tick * 3.2))),
      xTickY, yTickX: plot.left - gap,
      xTitle: { x: plot.left + plot.width / 2, y: xTickY + L.fonts.tick * 0.3 + gap + L.fonts.axis * 0.95, text: s.axisTitles.x },
      yTitle: { x: L.pad + L.fonts.axis * 0.95, y: plot.top + plot.height / 2, lines: [s.axisTitles.y] },
    }, ms, `${s.space}:${s.unit}`);

    const qShown = s.queryShown || this.mode === 'lab';
    const qx = px(s.query.x);
    const qy = py(s.query.y);

    // keyed upsert: new nodes are placed instantly, existing ones move over `ms`
    const upsert = <D,>(
      g: G, selector: string, data: D[], key: (d: D) => string, tag: string, cls: string,
      place: (sel: AnySel) => void, shown: (d: D) => boolean,
    ): AnySel => {
      const sel = g.selectAll<SVGElement, D>(selector).data(data, key as (d: unknown) => string);
      sel.exit().remove();
      const enter = sel.enter().append<SVGElement>(tag).attr('class', cls);
      place(enter);
      enter.attr('opacity', (d) => (shown(d) ? 1 : 0));
      const t = tr(sel as AnySel, TN, ms);
      place(t);
      t.attr('opacity', (d: D) => (shown(d) ? 1 : 0));
      const all = enter.merge(sel as never) as AnySel;
      all.attr('data-shown', (d: D) => (shown(d) ? '1' : '0'));
      return all;
    };

    // ---- ±σ bands and μ lines
    const mu = s.mu;
    const tag = (axis: 'x' | 'y') => function (this: SVGElement) { select(this).classed(axis, true); };
    upsert(this.gBands, 'rect.sigma', AXES, (d) => d.a, 'rect', 'sigma', (t) => {
      t.attr('x', (d: Axis) => (mu && d.a === 'x' ? r1(px(mu.x - mu.sx)) : plot.left))
        .attr('width', (d: Axis) => (mu && d.a === 'x' ? r1(Math.abs(px(mu.x + mu.sx) - px(mu.x - mu.sx))) : plot.width))
        .attr('y', (d: Axis) => (mu && d.a === 'y' ? r1(py(mu.y + mu.sy)) : plot.top))
        .attr('height', (d: Axis) => (mu && d.a === 'y' ? r1(Math.abs(py(mu.y - mu.sy) - py(mu.y + mu.sy))) : plot.height));
    }, () => !!mu).each(function (d: Axis) { tag(d.a).call(this as SVGElement); });
    upsert(this.gMu, 'line.mu', AXES, (d) => d.a, 'line', 'mu', (t) => {
      t.attr('x1', (d: Axis) => (mu && d.a === 'x' ? r1(px(mu.x)) : plot.left))
        .attr('x2', (d: Axis) => (mu && d.a === 'x' ? r1(px(mu.x)) : right))
        .attr('y1', (d: Axis) => (mu && d.a === 'y' ? r1(py(mu.y)) : plot.top))
        .attr('y2', (d: Axis) => (mu && d.a === 'y' ? r1(py(mu.y)) : bottom));
    }, () => !!mu).each(function (d: Axis) { tag(d.a).call(this as SVGElement); });

    // ---- iso-distance curve around the query
    const iso = s.iso;
    upsert(this.gIso, 'ellipse.iso', [0], () => 'i', 'ellipse', 'iso', (t) => {
      t.attr('cx', r1(qx)).attr('cy', r1(qy)).attr('rx', r1(iso ? iso.r * ux : 0)).attr('ry', r1(iso ? iso.r * uy : 0));
    }, () => !!iso && qShown);

    // ---- distance lines
    const showLines = s.lines && qShown;
    upsert(this.gDist, 'line.dist', s.customers, (c) => c.id, 'line', 'dist', (t) => {
      t.attr('x1', r1(qx)).attr('y1', r1(qy))
        .attr('x2', (c: CustView) => r1(px(c.x))).attr('y2', (c: CustView) => r1(py(c.y)));
    }, () => showLines).each(function (c: CustView) {
      select(this as SVGElement).classed('nearest', c.nearest).attr('data-id', c.id);
    });

    // ---- customers
    const R = L.ptR;
    upsert(this.gCust, 'circle.pt.cust', s.customers, (c) => c.id, 'circle', 'pt cust', (t) => {
      t.attr('cx', (c: CustView) => r1(px(c.x))).attr('cy', (c: CustView) => r1(py(c.y))).attr('r', R);
    }, () => true).each(function (c: CustView) {
      select(this as SVGElement).classed('nearest', c.nearest).attr('data-id', c.id);
    });

    // ---- query diamond
    const hh = R * 1.6;
    const diamond = (x: number, y: number): string =>
      `M${r1(x)},${r1(y - hh)}L${r1(x + hh)},${r1(y)}L${r1(x)},${r1(y + hh)}L${r1(x - hh)},${r1(y)}Z`;
    upsert(this.gQ, 'path.query', [0], () => 'q', 'path', 'query', (t) => { t.attr('d', diamond(qx, qy)); }, () => qShown)
      .attr('data-x', r1(qx)).attr('data-y', r1(qy));

    // ---- labels: each one sits at the first free spot around ITS own dot; only a crowded dot gets a leader line
    const tickPx = L.fonts.tick;
    const textW = (t: string, cls: string): number => this.measure.width(t, cls, tickPx);
    const lh = tickPx * 1.2;
    type Box = { l: number; r: number; t: number; b: number };
    interface Dot { id: string; x: number; y: number; r: number }
    const dots: Dot[] = s.customers.map((c) => ({ id: c.id, x: px(c.x), y: py(c.y), r: R }));
    if (qShown) dots.push({ id: 'query', x: qx, y: qy, r: hh });
    const placed: Box[] = dots.map((d) => ({ l: d.x - d.r, r: d.x + d.r, t: d.y - d.r, b: d.y + d.r }));
    const boxAt = (w: number, cx: number, ly: number): Box => ({ l: cx - w / 2 - 2, r: cx + w / 2 + 2, t: ly - lh * 0.8, b: ly + lh * 0.3 });
    const inside = (b: Box): boolean => b.l >= plot.left && b.r <= right && b.t >= plot.top && b.b <= bottom;
    const clash = (a: Box): boolean => placed.some((p) => a.l < p.r && a.r > p.l && a.t < p.b && a.b > p.t);
    const gapTo = (b: Box, x: number, y: number): number => Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b));
    const ownNearest = (padded: Box, own: Dot): boolean => {
      const b = { l: padded.l + 2, r: padded.r - 2, t: padded.t, b: padded.b }; // the text itself, without the clearance pad
      const d0 = gapTo(b, own.x, own.y);
      return dots.every((o) => o === own || gapTo(b, o.x, o.y) > d0 + 1);
    };
    const out: Item[] = [];
    const leaders: { k: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    const put = (it: Item, cx: number, ly: number, own: Dot | null, leader: boolean): void => {
      const b = boxAt(it.w, cx, ly);
      placed.push(b);
      out.push({ ...it, cx, ly });
      if (leader && own) {
        leaders.push({ k: it.k, x1: clamp(own.x, b.l, b.r), y1: clamp(own.y, b.t, b.b), x2: own.x, y2: own.y });
      }
    };
    // μ labels first: fixed spots, shifted only to clear the dots
    const muItems: Item[] = [];
    if (mu) {
      const [lx, ly] = mu.labels;
      const wx = textW(lx, 'mu-label');
      const wy = textW(ly, 'mu-label');
      muItems.push({ k: 'mu-x', text: lx, cls: 'mu-label x', w: wx, cx: px(mu.x) + 8 + wx / 2, ly: plot.top + tickPx * 1.3, group: 'mu' });
      muItems.push({ k: 'mu-y', text: ly, cls: 'mu-label y', w: wy, cx: right - wy / 2 - 8, ly: clamp(py(mu.y) - 8, plot.top + tickPx * 1.3, bottom - 6), group: 'mu' });
    }
    for (const it of muItems) {
      const cx = clamp(it.cx, plot.left + it.w / 2 + 2, right - it.w / 2 - 2);
      let ly = it.ly;
      for (let r = 0; r < 10; r++) {
        const cand = it.ly + (it.k === 'mu-y' ? -1 : 1) * r * L.rowH;
        if (inside(boxAt(it.w, cx, cand)) && !clash(boxAt(it.w, cx, cand))) { ly = cand; break; }
      }
      put(it, cx, ly, null, false);
    }
    const labelOf = (it: Item, d: Dot): void => {
      const w = it.w;
      const spots = (g: number): [number, number][] => {
        const e = g * 0.75;
        return [
          [d.x, d.y - g - lh * 0.3], [d.x + g + w / 2, d.y + lh * 0.25], [d.x - g - w / 2, d.y + lh * 0.25], [d.x, d.y + g + lh * 0.8],
          [d.x + e + w / 2, d.y - e - lh * 0.3], [d.x - e - w / 2, d.y - e - lh * 0.3],
          [d.x + e + w / 2, d.y + e + lh * 0.8], [d.x - e - w / 2, d.y + e + lh * 0.8],
        ];
      };
      const g0 = d.r + 4;
      for (const [cx, ly] of spots(g0)) {
        const b = boxAt(w, cx, ly);
        if (inside(b) && !clash(b) && ownNearest(b, d)) { put(it, cx, ly, d, false); return; }
      }
      for (const ring of [1, 2, 3, 4, 5, 6]) {
        const wide: [number, number][] = [];
        for (let k = -ring; k <= ring; k++) {
          wide.push([d.x + g0 + ring * lh + w / 2, d.y + k * lh + lh * 0.25], [d.x - g0 - ring * lh - w / 2, d.y + k * lh + lh * 0.25]);
        }
        for (const [cx, ly] of [...spots(g0 + ring * lh), ...wide]) {
          const b = boxAt(w, cx, ly);
          if (inside(b) && !clash(b)) { put(it, cx, ly, d, true); return; }
        }
      }
      const cx = clamp(d.x, plot.left + w / 2 + 2, right - w / 2 - 2);
      put(it, cx, clamp(d.y - g0 - lh * 0.3, plot.top + lh * 0.8, bottom - lh * 0.3), d, true);
    };
    if (qShown) {
      labelOf({ k: 'query', text: s.query.label, cls: 'query-label', w: textW(s.query.label, 'query-label'), cx: qx, ly: qy, group: 'q' }, dots[dots.length - 1]);
    }
    for (const c of s.customers) {
      labelOf({ k: c.id, text: c.id, cls: 'cust-label', w: textW(c.id, 'cust-label'), cx: 0, ly: 0, group: 'cust' }, dots.find((d) => d.id === c.id)!);
    }
    const labelsIn = (g: G, group: Item['group'], sel: string): void => {
      const data = out.filter((o) => o.group === group);
      const s2 = g.selectAll<SVGTextElement, Item>(sel).data(data, (d) => d.k);
      s2.exit().remove();
      const en = s2.enter().append('text').attr('text-anchor', 'middle');
      const placeL = (t: AnySel): void => { t.attr('x', (d: Item) => r1(d.cx)).attr('y', (d: Item) => r1(d.ly)); };
      placeL(en);
      placeL(tr(s2 as AnySel, TN, ms));
      en.merge(s2 as never).attr('class', (d: Item) => d.cls).text((d: Item) => d.text)
        .attr('data-lx', (d: Item) => r1(d.cx)).attr('data-ly', (d: Item) => r1(d.ly)).attr('data-w', (d: Item) => r1(d.w));
    };
    labelsIn(this.gCust, 'cust', 'text.cust-label');
    labelsIn(this.gQ, 'q', 'text.query-label');
    labelsIn(this.gMuLabels, 'mu', 'text.mu-label');
    // leader lines (under the dots) for labels that could not sit beside their own dot
    const ls = this.gLeaders.selectAll<SVGLineElement, (typeof leaders)[number]>('line.leader').data(leaders, (d) => d.k);
    ls.exit().remove();
    const lenter = ls.enter().append('line').attr('class', 'leader');
    const placeLd = (t: AnySel): void => {
      t.attr('x1', (d: (typeof leaders)[number]) => r1(d.x1)).attr('y1', (d: (typeof leaders)[number]) => r1(d.y1))
        .attr('x2', (d: (typeof leaders)[number]) => r1(d.x2)).attr('y2', (d: (typeof leaders)[number]) => r1(d.y2));
    };
    placeLd(lenter);
    placeLd(tr(ls as AnySel, TN, ms));
    lenter.merge(ls as never).attr('data-id', (d: (typeof leaders)[number]) => d.k);
  }
}
