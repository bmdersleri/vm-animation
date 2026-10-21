import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { r1, trianglePath } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, stackLevels, staggerRows, type LineScale } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { LINE, type IqrView, type Pt } from './view';

/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'iqr-line';
/** Duration of the far <-> linear zone crossing, before `durationScale`. */
export const CROSS_MS = 250;
/** Mean slide from the axis start, before `durationScale`. */
export const SLIDE_MS = 900;
/** Fade of a deleted dot, before `durationScale`; applies to live changes too. */
export const DELETE_MS = 300;
const SVGNS = 'http://www.w3.org/2000/svg';
const TITLE = 'Aylık fatura (TL)';
/** Gap in px between two labels of one row (spec: staggerRows pad). */
const PAD = 6;

type G = Selection<SVGGElement, unknown, null, undefined>;

interface Lay {
  w: number; h: number; sc: LineScale; tick: number; r: number; rowH: number;
  axisY: number; tickY: number; titleY: number; tickCount: number;
  rowsBottom: number; rowCap: number; armY: number; zoneTop: number; zoneH: number; levelH: number;
}
interface PtD { pt: Pt; x: number; y: number; far: boolean; sk: string }
interface MarkD { kind: string; x: number; cx: number; w: number; ly: number; label: string }
interface LabelD { k: string; text: string; cx: number; w: number; ly: number; x?: number; y?: number }

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const notLeaving = function (this: Element): boolean { return !this.classList.contains('leaving'); };

/**
 * The number line of the `iqr-aykiri` page: broken axis, dots (beeswarm stacks),
 * mean triangle under the axis, median / Q1 / Q3 / fence lines with staggered
 * value labels, the quartile box, arms, whiskers and the ±3σ band. Every
 * element keeps its node by key, so a dot that moves is the same node.
 * `update(v, ms)` moves what changed over `ms` (0 = instantly); a dot that
 * crosses the axis break always takes CROSS_MS × durationScale and carries
 * `data-cross="1"` meanwhile. Text sizes come from the CSS tokens only.
 */
export class LineLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly nl: NumberLineLayer;
  private readonly measure: TextMeasure;
  private readonly gZband: G;
  private readonly gBox: G;
  private readonly gWhisk: G;
  private readonly gArms: G;
  private readonly gMarks: G;
  private readonly gZLabels: G;
  private readonly gPts: G;
  private readonly gPtLabels: G;
  private readonly gArmLabels: G;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: IqrView | null = null;

  constructor(host: HTMLElement, private readonly ds = 1) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'iqr-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Aylık fatura sayı doğrusu');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    const g = (cls: string): G => svg.append('g').attr('class', cls);
    this.gZband = g('zband-layer');
    this.gBox = g('box-layer');
    this.nl = new NumberLineLayer(svg.append('g').attr('class', 'axis-layer'));
    this.gWhisk = g('whisker-layer');
    this.gArms = g('arm-layer');
    this.gMarks = g('mark-layer');
    this.gZLabels = g('zlabel-layer');
    this.gPts = g('pt-layer');
    this.gArmLabels = g('armlabel-layer');
    this.gPtLabels = g('ptlabel-layer');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    if (this.lay && this.lay.w === w && this.lay.h === h && this.mode === mode) return;
    this.mode = mode;
    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
    this.lay = this.layout(w, h);
    if (this.view) {
      this.interrupt();
      this.draw(this.view, 0);
    }
  }

  update(v: IqrView, ms: number): void {
    if (!this.lay) {
      this.view = v;
      return;
    }
    this.interrupt();
    this.view = v;
    this.draw(v, ms);
  }

  /** Cancels running transitions, drops nodes that were fading out and clears crossing flags. */
  interrupt(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('.leaving').remove();
    this.svg.selectAll('[data-cross]').attr('data-cross', null);
  }

  destroy(): void {
    this.interrupt();
    this.svgEl.remove();
  }

  // ------------------------------------------------------------- layout
  private layout(w: number, h: number): Lay {
    const f = this.measure.fonts(this.mode);
    const tick = f.tick;
    const r = Math.max(6, Math.round(tick * 0.55));
    const rowH = Math.round(tick * 1.45);
    const levelH = 2 * r + 2;
    const margin = 28;
    const sc = lineScale(LINE, [margin, Math.max(margin + 100, w - margin)]);
    const below = 22 + tick * 0.8 + 8 + f.axis + 8;
    const axisY = Math.round(h - below);
    let levels = 3;
    let rowCap = 5;
    // arm labels own one row right above the arms; the shared value-label rows start one full row above it
    const armBand = rowH + 16;
    const need = (): number => rowCap * rowH + 6 + armBand + levels * levelH + 6;
    while (need() > axisY && (levels > 2 || rowCap > 1)) {
      if (rowCap > 2) rowCap--;
      else if (levels > 2) levels--;
      else rowCap--;
    }
    const zoneH = levels * levelH + 6;
    const zoneTop = axisY - zoneH;
    const perTen = (sc(10) - sc(0));
    return {
      w, h, sc, tick, r, rowH, levelH,
      axisY, tickY: Math.round(axisY + 22 + tick * 0.8), titleY: Math.round(h - 8 - f.axis * 0.25),
      tickCount: perTen >= tick * 3.2 ? 10 : 5,
      rowsBottom: zoneTop - armBand,
      rowCap,
      armY: zoneTop - 8,
      zoneTop,
      zoneH,
    };
  }

  // ------------------------------------------------------------- draw
  private draw(v: IqrView, ms: number): void {
    const L = this.lay!;
    const sc = L.sc;
    const dur = (k: number): number => Math.round(ms * k);
    this.nl.draw(sc, L.axisY, { tickCount: L.tickCount, tickY: L.tickY, title: TITLE, titleY: L.titleY }, 0, 'iqr');
    const fade = (enter: AnySel, delay: number): void => {
      if (ms <= 0) { enter.attr('opacity', 1); return; }
      tr(enter, TN, dur(0.7), () => delay).attr('opacity', 1);
    };
    const sync = <D,>(
      g: G, selector: string, data: D[], key: (d: D) => string, tag: string, cls: string | ((d: D) => string),
    ): { enter: AnySel; upd: AnySel; all: AnySel } => {
      const s = g.selectAll<SVGElement, D>(selector).filter(notLeaving).data(data, key as (d: unknown) => string);
      const exit = s.exit<D>();
      exit.classed('leaving', true);
      tr(exit as AnySel, TN, dur(0.5)).attr('opacity', 0).remove();
      const enter = s.enter().append<SVGElement>(tag).attr('opacity', 0)
        .attr('class', typeof cls === 'string' ? cls : (d) => cls(d as D));
      const upd = s as AnySel;
      upd.attr('opacity', 1);
      return { enter, upd, all: enter.merge(s as never) as AnySel };
    };

    // ---- ±3σ band and box (under the axis marks)
    const zb = v.zBand;
    const zRect = sync(this.gZband, 'rect.zband', zb ? [zb] : [], () => 'z', 'rect', 'zband');
    const zPlace = (s: AnySel): void => {
      s.attr('x', zb ? r1(sc(zb.lo)) : 0).attr('width', zb ? r1(sc(zb.hi) - sc(zb.lo)) : 0)
        .attr('y', L.zoneTop).attr('height', L.zoneH);
    };
    zPlace(zRect.enter);
    zPlace(tr(zRect.upd, TN, ms));
    fade(zRect.enter, 0);

    const bx = v.box;
    const box = sync(this.gBox, 'rect.box', bx ? [bx] : [], () => 'b', 'rect', 'box');
    const bPlace = (s: AnySel): void => {
      s.attr('x', bx ? r1(sc(bx.q1)) : 0).attr('width', bx ? r1(sc(bx.q3) - sc(bx.q1)) : 0)
        .attr('y', L.zoneTop).attr('height', L.zoneH);
    };
    bPlace(box.enter);
    bPlace(tr(box.upd, TN, ms));
    fade(box.enter, dur(0.4));

    // ---- whiskers (horizontal from the box edge to the whisker value, with a cap)
    interface WD { k: string; v: number; from: number }
    const wd: WD[] = v.whiskers && bx ? [{ k: 'lo', v: v.whiskers[0], from: bx.q1 }, { k: 'hi', v: v.whiskers[1], from: bx.q3 }] : [];
    const wh = sync(this.gWhisk, 'g.whisker-g', wd, (d) => d.k, 'g', 'whisker-g');
    wh.enter.each(function () {
      const g = select(this as SVGGElement);
      g.append('line').attr('class', 'whisker');
      g.append('line').attr('class', 'whisker-cap');
    });
    const midY = L.zoneTop + L.zoneH / 2;
    const wPlace = (s: AnySel): void => {
      s.select('line.whisker').attr('x1', (d: WD) => r1(sc(d.from))).attr('x2', (d: WD) => r1(sc(d.v)))
        .attr('y1', r1(midY)).attr('y2', r1(midY)).attr('data-v', (d: WD) => d.v);
      s.select('line.whisker-cap').attr('x1', (d: WD) => r1(sc(d.v))).attr('x2', (d: WD) => r1(sc(d.v)))
        .attr('y1', r1(midY - L.r)).attr('y2', r1(midY + L.r));
    };
    wh.all.each(function (d: WD) { select(this as SVGGElement).select('line.whisker').attr('data-v', d.v); });
    wPlace(wh.enter);
    wPlace(tr(wh.upd, TN, ms));
    fade(wh.enter, dur(0.5));

    // ---- arms
    interface AD { k: string; a: number; b: number }
    const ad: AD[] = v.arms && bx ? [{ k: 'lo', a: bx.q1, b: v.arms.lo }, { k: 'hi', a: bx.q3, b: v.arms.hi }] : [];
    const arms = sync(this.gArms, 'line.arm', ad, (d) => d.k, 'line', 'arm');
    const aPlace = (s: AnySel): void => {
      s.attr('x1', (d: AD) => r1(sc(d.a))).attr('x2', (d: AD) => r1(sc(d.b)))
        .attr('y1', r1(L.armY)).attr('y2', r1(L.armY));
    };
    aPlace(arms.enter);
    aPlace(tr(arms.upd, TN, ms));
    fade(arms.enter, dur(0.3));
    const armLabels: LabelD[] = [];
    if (v.arms) {
      for (const d of ad) {
        const wd_ = this.measure.width(v.arms.label, 'arm-label', L.tick);
        const mid = (sc(d.a) + sc(d.b)) / 2;
        armLabels.push({ k: d.k, text: v.arms.label, w: wd_, cx: clamp(mid, 8 + wd_ / 2, L.w - 8 - wd_ / 2), ly: L.armY - 8 });
      }
    }
    this.labels(this.gArmLabels, 'arm-label', armLabels, ms, fade, dur(0.4), sync);

    // ---- value marks: mean, median, Q1, Q3, fences — plus ±3σ labels share their rows
    const items: { id: string; cx: number; w: number; x: number; text: string; cls: string }[] = [];
    for (const m of v.markers) {
      const w = this.measure.width(m.label, 'mark-label', L.tick);
      const x = sc(m.value);
      items.push({ id: m.kind, x, w, cx: clamp(x, 8 + w / 2, L.w - 8 - w / 2), text: m.label, cls: 'mark-label' });
    }
    if (zb) {
      for (const [id, val, text] of [['zlo', zb.lo, zb.loLabel], ['zhi', zb.hi, zb.hiLabel]] as const) {
        const w = this.measure.width(text, 'zband-label', L.tick);
        const x = sc(val);
        items.push({ id, x, w, cx: clamp(x, 8 + w / 2, L.w - 8 - w / 2), text, cls: 'zband-label' });
      }
    }
    const rows = staggerRows(items.map((i) => ({ x: i.cx, w: i.w })), PAD);
    const lyOf = (i: number): number => L.rowsBottom - Math.min(rows[i], L.rowCap - 1) * L.rowH;
    const marksD: MarkD[] = [];
    const zl: LabelD[] = [];
    items.forEach((it, i) => {
      if (it.cls === 'mark-label') marksD.push({ kind: it.id, x: it.x, cx: it.cx, w: it.w, ly: lyOf(i), label: it.text });
      else zl.push({ k: it.id, text: it.text, cx: it.cx, w: it.w, ly: lyOf(i) });
    });
    const mk = sync(this.gMarks, 'g.mark', marksD, (d) => d.kind, 'g', (d) => `mark ${d.kind}`);
    mk.enter.each(function (d: MarkD) {
      const g = select(this as SVGGElement);
      const fence = d.kind === 'lo' || d.kind === 'hi';
      const ln = g.append('line').attr('class', fence ? 'fence' : 'mark-line');
      if (fence) ln.attr('stroke-dasharray', '10 6');
      if (d.kind === 'mean') g.append('path').attr('class', 'mean-tri');
      g.append('text').attr('class', 'mark-label').attr('text-anchor', 'middle');
    });
    const slideFrom = v.meanFrom === 'start' && ms > 0;
    const startX = L.sc(LINE.min);
    const mkPlace = (s: AnySel): void => {
      s.select('line').attr('y1', (d: MarkD) => r1(d.ly + 6))
        .attr('y2', (d: MarkD) => r1(L.axisY + (d.kind === 'mean' ? 4 : 0)));
      s.select('path.mean-tri').attr('d', `M0,${L.axisY + 4}L-${r1(L.r * 0.95)},${r1(L.axisY + 4 + L.r * 1.7)}L${r1(L.r * 0.95)},${r1(L.axisY + 4 + L.r * 1.7)}Z`);
      s.select('text.mark-label').attr('x', (d: MarkD) => r1(d.cx - d.x)).attr('y', (d: MarkD) => r1(d.ly));
    };
    const mkMove = (s: AnySel): void => { s.style('transform', (d: MarkD) => `translate(${r1(d.x)}px, 0px)`); };
    const mkData = (s: AnySel): void => {
      s.attr('data-x', (d: MarkD) => r1(d.x));
      s.select('text.mark-label').text((d: MarkD) => d.label)
        .attr('data-lx', (d: MarkD) => r1(d.cx)).attr('data-ly', (d: MarkD) => r1(d.ly)).attr('data-w', (d: MarkD) => r1(d.w));
    };
    mkData(mk.all);
    mkPlace(mk.enter);
    mkPlace(tr(mk.upd, TN, ms));
    mkMove(mk.enter);
    mkMove(tr(mk.upd, TN, ms));
    // the mean triangle glides in from the axis start (step 2)
    mk.all.filter((d: MarkD) => d.kind === 'mean').each(function (d: MarkD) {
      if (!slideFrom) return;
      const g = select(this as SVGGElement);
      g.style('transform', `translate(${r1(startX)}px, 0px)`).attr('opacity', 1);
      tr(g, TN, Math.min(ms * 2, SLIDE_MS * this.ds), undefined).style('transform', `translate(${r1(d.x)}px, 0px)`);
    });
    fade(mk.enter.filter((d: MarkD) => !(slideFrom && d.kind === 'mean')), dur(0.4));
    mk.enter.filter((d: MarkD) => slideFrom && d.kind === 'mean').attr('opacity', 1);
    this.labels(this.gZLabels, 'zband-label', zl, ms, fade, dur(0.4), sync);

    // ---- dots
    const live = v.points.filter((p) => !p.deleted && Number.isFinite(p.value));
    const px = live.map((p) => sc(p.value));
    const lv = stackLevels(px, L.levelH);
    const baseY = L.axisY - L.r - 4;
    const pd: PtD[] = live.map((p, i) => ({
      pt: p, x: px[i], y: baseY - lv[i] * L.levelH, far: p.far, sk: `${p.key}|${p.shape}`,
    }));
    this.dots(pd, ms, dur);

    // ---- dot labels (far, outlier, clipped)
    const r = L.r;
    const pl: LabelD[] = [];
    {
      const cand = pd.filter((d) => d.pt.label);
      const ws = cand.map((d) => this.measure.width(d.pt.label!, 'pt-label', L.tick));
      const cxs = cand.map((d, i) => clamp(d.x, 8 + ws[i] / 2, L.w - 8 - ws[i] / 2));
      const rws = staggerRows(cand.map((_, i) => ({ x: cxs[i], w: ws[i] })), PAD);
      cand.forEach((d, i) => {
        pl.push({ k: d.pt.key, text: d.pt.label!, w: ws[i], cx: cxs[i], ly: d.y - r * 1.4 - 8 - rws[i] * L.rowH, x: d.x, y: d.y });
      });
    }
    this.labels(this.gPtLabels, 'pt-label', pl, ms, fade, dur(0.5), sync);
  }

  /** Text labels keyed by `k`, one `text.<cls>` each, at (cx, ly). */
  private labels(
    g: G, cls: string, data: LabelD[], ms: number,
    fade: (e: AnySel, delay: number) => void, delay: number,
    sync: <D>(g: G, sel: string, data: D[], key: (d: D) => string, tag: string, cls: string) => { enter: AnySel; upd: AnySel; all: AnySel },
  ): void {
    const s = sync<LabelD>(g, `text.${cls}`, data, (d) => d.k, 'text', cls);
    s.enter.attr('text-anchor', 'middle');
    s.all.text((d: LabelD) => d.text)
      .attr('data-lx', (d: LabelD) => r1(d.cx)).attr('data-ly', (d: LabelD) => r1(d.ly)).attr('data-w', (d: LabelD) => r1(d.w));
    const place = (t: AnySel): void => { t.attr('x', (d: LabelD) => r1(d.cx)).attr('y', (d: LabelD) => r1(d.ly)); };
    place(s.enter);
    place(tr(s.upd, TN, ms));
    fade(s.enter, delay);
  }

  /** Circle / ▲ / ◆ nodes by key + shape (see draw). */
  private dots(pd: PtD[], ms: number, dur: (k: number) => number): void {
    const L = this.lay!;
    const crossMs = Math.round(CROSS_MS * this.ds);
    const s = this.gPts.selectAll<SVGElement, PtD>('.pt').filter(notLeaving).data(pd, (d) => d.sk);
    const exit = s.exit<PtD>();
    exit.classed('leaving', true).classed('deleted', (_d, i, n) => !pd.some((p) => p.pt.key === (n[i] as SVGElement).dataset.key));
    // a deleted dot (Sil) fades even on live changes; a shape swap follows the step duration
    tr(exit.filter('.deleted') as AnySel, TN, Math.round(DELETE_MS * this.ds)).attr('opacity', 0).remove();
    tr(exit.filter(':not(.deleted)') as AnySel, TN, dur(0.7)).attr('opacity', 0).remove();
    const R = L.r;
    const enter = s.enter().append<SVGElement>((d) => {
      const el = this.svgEl.ownerDocument.createElementNS(SVGNS, d.pt.shape === 'normal' ? 'circle' : 'path') as SVGElement;
      return el;
    }).attr('opacity', 0);
    enter.attr('class', (d) => `pt ${d.pt.shape}`)
      .attr('data-key', (d) => d.pt.key)
      .attr('d', (d) => (d.pt.shape === 'outlier' ? trianglePath(R * 1.25) : d.pt.shape === 'filled' ? diamond(R * 1.3) : null))
      .attr('r', (d) => (d.pt.shape === 'normal' ? R : null));
    // filled diamonds drop in from above
    const dropped = (d: PtD): number => (d.pt.shape === 'filled' && ms > 0 ? -L.levelH * 1.5 : 0);
    enter.style('transform', (d) => `translate(${r1(d.x)}px, ${r1(d.y + dropped(d))}px)`);

    const upd = s as AnySel;
    const crossing = upd.filter(function (this: Element, d: PtD) {
      const prev = (this as SVGElement).dataset.far;
      return crossMs > 0 && prev !== undefined && prev !== (d.far ? '1' : '0');
    });
    const calm = upd.filter(function (this: Element, d: PtD) {
      const prev = (this as SVGElement).dataset.far;
      return !(crossMs > 0 && prev !== undefined && prev !== (d.far ? '1' : '0'));
    });
    crossing.attr('data-cross', '1');
    const moveTo = (t: AnySel): void => { t.style('transform', (d: PtD) => `translate(${r1(d.x)}px, ${r1(d.y)}px)`); };
    moveTo(tr(calm, TN, ms));
    if (crossing.size() > 0) {
      const t = tr(crossing, TN, crossMs);
      moveTo(t);
      (t as unknown as { on(n: string, f: (this: SVGElement) => void): unknown }).on('end.cross interrupt.cross', function (this: SVGElement) {
        this.removeAttribute('data-cross');
      });
    }
    const all = enter.merge(s as never) as AnySel;
    all.classed('mid', (d: PtD) => d.pt.highlight)
      .attr('data-far', (d: PtD) => (d.far ? '1' : '0'))
      .attr('data-x', (d: PtD) => r1(d.x))
      .attr('data-y', (d: PtD) => r1(d.y));
    if (ms > 0) tr(enter, TN, dur(0.7), () => dur(0.3)).attr('opacity', 1).style('transform', (d: PtD) => `translate(${r1(d.x)}px, ${r1(d.y)}px)`);
    else enter.attr('opacity', 1);
    upd.attr('opacity', 1);
  }
}

/** ◆ with half-diagonal `h`. */
function diamond(h: number): string {
  const q = r1(h);
  return `M0,${-q}L${q},0L0,${q}L${-q},0Z`;
}
