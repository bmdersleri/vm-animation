import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { circlesPath, diamondPath } from '../../core/plot/dots-path';
import { formatNumber } from '../../core/plot/format';
import { r1, trianglePath } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, staggerRows, stackLevels } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import type { DagilimView } from './view';

/** Base duration of a step's moves, before `durationScale`. */
export const MS_STEP = 450;
/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'dag-hist';
const SVGNS = 'http://www.w3.org/2000/svg';
/** Domain padding as a fraction of the data range, so the outermost dots are not clipped. */
const PAD_FRAC = 0.06;
/** Horizontal gap in px between a bar and its bin edges. */
const BAR_GAP = 2;
/** Gap in px between two mark labels of one row (core `staggerRows` pad). */
const LABEL_PAD = 6;
/** The outlier's draggable range in hours, the same as the range input's. */
const DRAG_MIN = 28;
const DRAG_MAX = 60;
/** Step 9's three rule cards: the spec's thresholds, the robust summary and the outlier warning. */
const RULES: readonly { title: string; body: string }[] = [
  { title: 'eşikler', body: '|çarpıklık| < 0,5 simetrik · 0,5–1 orta · > 1 güçlü' },
  { title: 'özet', body: 'çarpıklık varsa özet olarak medyan + IQR kullan' },
  { title: 'uç değer', body: 'çarpıklık var diye silme — önce kaynağını incele' },
];
/** The two pages step 9 sends the reader to. */
const LINKS: readonly { href: string; label: string }[] = [
  { href: '../kutu-grafigi/', label: 'Kutu grafiği' },
  { href: '../iqr-aykiri/', label: 'IQR ve aykırı değer' },
];

type G = Selection<SVGGElement, unknown, null, undefined>;
type Tail = 'right' | 'left';
type MarkKind = 'mean' | 'median';

interface Lay {
  w: number; h: number;
  tick: number; axis: number;
  marginX: number;
  axisY: number; tickY: number; titleY: number;
  labelTop: number; rowH: number;
  histTop: number; baseY: number;
}

interface BarD { d: string; flat: string; cx: number; count: number; yTop: number; lo: number; hi: number }
interface MarkD { kind: MarkKind; x: number; cx: number; w: number; ly: number; label: string; show: boolean }
interface RuleD { title: string; x: number; y: number; w: number; h: number; pad: number; titlePx: number; bodyPx: number; lines: string[] }
interface LinkD { href: string; label: string; x: number; y: number }

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** Up to one decimal with trailing zeros trimmed: "12,4", "8". */
function trim1(x: number): string {
  return formatNumber(x, 1).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
}

/**
 * The plot of the `dagilim-carpiklik` page: the reused core number line with the
 * ten dots stacked above it (one `path.dots`), the histogram below it as ONE
 * `path.hist-bar` with one closed sub-path per bin (so a bar count is a sub-path
 * count), the mean / median mark lines through both panels and the tail shade.
 * Every node keeps its key, so a bar that grows is the same node; `update(v, ms)`
 * moves what changed over `ms` (0 = instantly). Text sizes come from the CSS
 * tokens only.
 */
export class HistLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axis: G;
  private readonly nl: NumberLineLayer;
  private readonly measure: TextMeasure;
  private readonly gTail: G;
  private readonly gHist: G;
  private readonly histBar: Selection<SVGPathElement, unknown, null, undefined>;
  private readonly gBarCount: G;
  private readonly gBinRange: G;
  private readonly dotsPath: Selection<SVGPathElement, unknown, null, undefined>;
  private readonly gMarks: G;
  private readonly gRule: G;
  private readonly gDrag: G;
  private readonly logNote: Selection<SVGTextElement, unknown, null, undefined>;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: DagilimView | null = null;
  /** Whether the current step drags the outlier; kept across a resize so an in-flight drag survives. */
  private dragOn = false;
  /** The current scale's data domain and px range, for turning a pointer x back into an hour. */
  private inv: { d0: number; d1: number; r0: number; r1: number } | null = null;
  private onDragCb: ((x: number) => void) | null = null;
  private dragging = false;
  private lastDrag: number | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'dag-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Çalışma saatlerinin sayı doğrusu ve histogramı');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    const g = (cls: string): G => svg.append('g').attr('class', cls);

    this.axis = g('axis-layer');
    this.nl = new NumberLineLayer(this.axis);
    this.gTail = g('tail-layer');
    this.gHist = g('hist-layer');
    this.histBar = this.gHist.append('path').attr('class', 'hist-bar');
    this.gBarCount = g('barcount-layer');
    this.gBinRange = g('binrange-layer');
    this.dotsPath = g('dots-layer').append('path').attr('class', 'dots');
    this.gMarks = g('mark-layer');
    this.gRule = g('rule-layer');
    this.gDrag = g('drag-layer');
    this.logNote = svg.append('text').attr('class', 'log-note').attr('text-anchor', 'end')
      .attr('opacity', 0).text('');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.mode = mode;
    this.svgEl.setAttribute('width', String(Math.max(1, w)));
    this.svgEl.setAttribute('height', String(Math.max(1, h)));
    this.lay = this.layout(w, h);
    if (this.view) {
      this.cancel();
      this.draw(this.view, 0, this.dragOn);
    }
  }

  update(v: DagilimView, ms: number, dragOn = false): void {
    this.cancel();
    this.view = v;
    this.dragOn = dragOn;
    if (this.lay) this.draw(v, ms, dragOn);
  }

  /** Registers the outlier drag sink: the scene writes the param. */
  onDrag(cb: (x: number) => void): void {
    this.onDragCb = cb;
  }

  /** Cancels running transitions so the next draw starts from the settled state. */
  interrupt(): void {
    this.cancel();
  }

  destroy(): void {
    this.cancel();
    this.svgEl.remove();
  }

  private cancel(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('*').interrupt('axes');
  }

  // ------------------------------------------------------------- layout
  private layout(w: number, h: number): Lay {
    const f = this.measure.fonts(this.mode);
    const tick = f.tick;
    const axis = f.axis;
    const marginX = Math.max(24, Math.round(tick * 1.8));
    const labelTop = Math.ceil(tick * 0.95);
    const rowH = Math.round(tick * 1.35);
    // the number line owns the upper third; two label rows plus the dots fit above it
    const axisY = Math.max(Math.round(labelTop + 3.2 * rowH), Math.round(h * 0.34));
    const tickY = axisY + Math.round(tick * 0.9 + 6);
    const titleY = tickY + Math.round(f.axis * 1.15 + 8);
    const histTop = titleY + Math.round(f.axis * 0.4 + 8);
    const baseY = h - Math.round(tick * 1.5 + 8);
    return { w, h, tick, axis, marginX, axisY, tickY, titleY, labelTop, rowH, histTop, baseY };
  }

  // ------------------------------------------------------------- draw
  private draw(v: DagilimView, ms: number, dragOn = false): void {
    const L = this.lay!;
    // a step change ends any drag that was still open
    if (!dragOn) this.dragging = false;
    const lo = Math.min(...v.values);
    const hi = Math.max(...v.values);
    // at the drag step the axis already reaches 60, so the outlier can be dragged there without the scale jumping
    const top = dragOn ? Math.max(hi, DRAG_MAX) : hi;
    const span = top - lo || 1;
    const dom = { min: lo - span * PAD_FRAC, max: top + span * PAD_FRAC };
    const range: [number, number] = [L.marginX, Math.max(L.marginX + 40, L.w - L.marginX)];
    const sc = lineScale(dom, range);
    this.inv = dragOn ? { d0: dom.min, d1: dom.max, r0: range[0], r1: range[1] } : null;
    const title = v.log ? 'log1p (saat + 1)' : 'Haftalık çalışma saati (saat)';
    this.nl.draw(
      sc, L.axisY,
      { tickCount: L.w > 700 ? 6 : 5, tickY: L.tickY, title, titleY: L.titleY },
      ms, v.log ? 'log' : 'raw',
    );
    this.logNote
      .attr('x', r1(L.w - L.marginX)).attr('y', r1(L.titleY))
      .attr('opacity', v.log ? 1 : 0).text(v.log ? '1p · log1p' : '');

    // ---- mean and median marks: rows stagger when the two labels are close
    const marks: MarkD[] = [
      { kind: 'mean', x: sc(v.mean), cx: 0, w: 0, ly: 0, label: formatNumber(v.mean, 1), show: v.showMean },
      { kind: 'median', x: sc(v.median), cx: 0, w: 0, ly: 0, label: formatNumber(v.median, 1), show: v.showMedian },
    ];
    for (const m of marks) {
      m.w = this.measure.width(m.label, 'mark-label', L.tick);
      m.cx = clamp(m.x, m.w / 2 + 8, Math.max(m.w / 2 + 8, L.w - m.w / 2 - 8));
    }
    const rows = staggerRows(marks.map((m) => ({ x: m.cx, w: m.w })), LABEL_PAD);
    marks.forEach((m, i) => { m.ly = L.labelTop + rows[i] * L.rowH; });

    // ---- tail shade: from the median to the long side of the distribution
    const shade = v.tail ? [v.tail] : [];
    const tail = this.gTail.selectAll<SVGRectElement, Tail>('rect.tail-shade')
      .data(shade, (d) => d)
      .join(
        (enter) => enter.append('rect').attr('class', (d) => `tail-shade ${d}`).attr('opacity', 0),
        (update) => update.attr('class', (d) => `tail-shade ${d}`),
        (exit) => { tr(exit, TN, ms).attr('opacity', 0).remove(); },
      );
    const mid = sc(v.median);
    const placeTail = (s: AnySel): void => {
      s.attr('y', r1(L.histTop)).attr('height', r1(L.baseY - L.histTop))
        .attr('x', (d: Tail) => r1(d === 'right' ? mid : L.marginX))
        .attr('width', (d: Tail) => r1(d === 'right' ? Math.max(0, L.w - L.marginX - mid) : Math.max(0, mid - L.marginX)));
    };
    placeTail(tail);
    if (ms > 0) tr(tail, TN, ms).attr('opacity', 1);
    else tail.attr('opacity', 1);

    // ---- bars: one closed sub-path per bin, in one path
    const maxCount = Math.max(1, ...v.bins.map((b) => b.count));
    const barMax = Math.max(8, L.baseY - L.histTop);
    const bars: BarD[] = v.bins.map((b) => {
      const x0 = sc(b.lo) + BAR_GAP;
      const x1 = Math.max(x0 + 1, sc(b.hi) - BAR_GAP);
      const yTop = L.baseY - (b.count / maxCount) * barMax;
      return {
        d: `M${r1(x0)},${r1(L.baseY)}L${r1(x0)},${r1(yTop)}L${r1(x1)},${r1(yTop)}L${r1(x1)},${r1(L.baseY)}Z`,
        // the same sub-path collapsed on the baseline, so the first draw grows out of the axis
        flat: `M${r1(x0)},${r1(L.baseY)}L${r1(x0)},${r1(L.baseY)}L${r1(x1)},${r1(L.baseY)}L${r1(x1)},${r1(L.baseY)}Z`,
        cx: (x0 + x1) / 2, count: b.count, yTop, lo: b.lo, hi: b.hi,
      };
    });
    const d = bars.map((b) => b.d).join('');
    if (ms > 0) {
      if (!this.histBar.attr('d')) this.histBar.attr('d', bars.map((b) => b.flat).join(''));
      tr(this.histBar, TN, ms).attr('d', d);
    } else this.histBar.attr('d', d);

    const cntSel = this.gBarCount.selectAll<SVGTextElement, BarD>('text.bar-count')
      .data(bars, (_, i) => String(i));
    cntSel.exit().remove();
    const cntEnter = cntSel.enter().append('text').attr('class', 'bar-count').attr('text-anchor', 'middle');
    const cntPlace = (s: AnySel): void => {
      s.attr('x', (b: BarD) => r1(b.cx)).attr('y', (b: BarD) => r1(b.yTop - 6));
    };
    cntPlace(cntEnter);
    if (ms > 0) cntPlace(tr(cntSel as AnySel, TN, ms));
    else cntPlace(cntSel as AnySel);
    cntEnter.merge(cntSel as never).text((b: BarD) => String(b.count))
      .attr('opacity', (b: BarD) => (b.count > 0 ? 1 : 0));

    // ---- bin ranges under the baseline (five bins or fewer, raw units only)
    const ranges = !v.log && bars.length <= 5 ? bars : [];
    this.gBinRange.selectAll<SVGTextElement, BarD>('text.bin-range')
      .data(ranges, (_, i) => String(i))
      .join(
        (enter) => enter.append('text').attr('class', 'bin-range').attr('text-anchor', 'middle'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .text((b) => `${trim1(b.lo)}–${trim1(b.hi)}`)
      .attr('x', (b) => r1(b.cx)).attr('y', r1(L.baseY + L.tick * 1.15));

    // ---- dots: one circle sub-path per value, stacked above the axis
    const r = Math.max(4, Math.round(L.tick * 0.5));
    const px = v.values.map((x) => sc(x));
    const dotsBottom = L.axisY - r - 6;
    let gap = 2 * r + 2;
    let lv = stackLevels(px, gap);
    const levels = Math.max(...lv) + 1;
    // the dots start below the label block; shrink the stack gap before a label is pushed off the top
    const dotsTop = L.labelTop + Math.max(...rows) * L.rowH + Math.round(L.tick * 0.6);
    const avail = dotsBottom - dotsTop;
    if (levels > 1 && levels * gap > avail) {
      gap = Math.max(r + 2, Math.floor(avail / levels));
      lv = stackLevels(px, gap);
    }
    const dd = circlesPath(px, lv.map((k) => dotsBottom - k * gap), r);
    if (ms > 0 && this.dotsPath.attr('d')) tr(this.dotsPath, TN, ms).attr('d', dd);
    else this.dotsPath.attr('d', dd);

    // ---- drag handle: at the tail step the 003 outlier is dragged along the number line
    const dragValue = dragOn && v.values.length > 0 ? v.values[v.values.length - 1] : null;
    const hsel = this.gDrag.selectAll<SVGCircleElement, number>('circle.drag-handle')
      .data(dragValue === null ? [] : [dragValue]);
    hsel.exit().remove();
    const hEnter = hsel.enter().append('circle')
      .attr('class', 'drag-handle')
      .attr('role', 'slider')
      .attr('aria-label', 'uç değer')
      .attr('aria-valuemin', DRAG_MIN)
      .attr('aria-valuemax', DRAG_MAX)
      .on('pointerdown', (ev: PointerEvent) => this.dragDown(ev))
      .on('pointermove', (ev: PointerEvent) => this.dragMove(ev))
      .on('pointerup', (ev: PointerEvent) => this.dragUp(ev))
      .on('pointercancel', (ev: PointerEvent) => this.dragUp(ev));
    const last = v.values.length - 1;
    hEnter.merge(hsel)
      .attr('cx', r1(px[last]))
      .attr('cy', r1(dotsBottom - lv[last] * gap))
      .attr('r', r1(r + 7))
      .attr('aria-valuenow', dragValue === null ? null : String(Math.round(dragValue)));
    this.svg.attr('data-drag', dragValue === null ? null : String(Math.round(dragValue)));

    // ---- mark lines and their labels (drawn last, so they sit over the bars)
    const capR = Math.max(5, Math.round(L.tick * 0.36));
    const capY = (m: MarkD): number => m.ly + 4 + capR;
    const sel = this.gMarks.selectAll<SVGGElement, MarkD>('g.mark').data(marks, (m) => m.kind);
    tr(sel.exit() as AnySel, TN, ms).attr('opacity', 0).remove();
    const enter = sel.enter().append('g').attr('class', (m) => `mark ${m.kind}`).attr('opacity', 0);
    enter.append('line').attr('class', (m) => `mark-${m.kind}`);
    enter.append('path').attr('class', 'mark-cap');
    enter.append('text').attr('class', 'mark-label').attr('text-anchor', 'middle');
    const upd = sel as AnySel;
    const place = (s: AnySel): void => {
      s.select('line')
        .attr('x1', (m: MarkD) => r1(m.x)).attr('x2', (m: MarkD) => r1(m.x))
        // like the sibling pages: the mark stops at the number line, so it never crosses the tick labels
        .attr('y1', (m: MarkD) => r1(capY(m) + capR * 0.6)).attr('y2', r1(L.axisY + 4));
      s.select('path.mark-cap')
        .attr('d', (m: MarkD) => (m.kind === 'mean' ? trianglePath(capR) : diamondPath(0, 0, capR * 0.9)))
        .attr('transform', (m: MarkD) => `translate(${r1(m.x)},${r1(capY(m))})`);
      s.select('text.mark-label')
        .attr('x', (m: MarkD) => r1(m.cx)).attr('y', (m: MarkD) => r1(m.ly));
    };
    const all = enter.merge(sel as never) as AnySel;
    all.select('text.mark-label').text((m: MarkD) => m.label);
    place(enter);
    if (ms > 0) {
      place(tr(upd, TN, ms));
      tr(upd, TN, ms).attr('opacity', (m: MarkD) => (m.show ? 1 : 0));
      tr(enter, TN, ms).attr('opacity', (m: MarkD) => (m.show ? 1 : 0));
    } else {
      place(upd);
      all.attr('opacity', (m: MarkD) => (m.show ? 1 : 0));
    }

    this.drawRules(L, v.thresholds, ms);
  }

  // ------------------------------------------------------------- rule cards (step 9)
  /** Three rule cards in the histogram's place plus the two links; the histogram hides while they show. */
  private drawRules(L: Lay, show: boolean, ms: number): void {
    this.gHist.attr('display', show ? 'none' : null);
    this.gBarCount.attr('display', show ? 'none' : null);
    this.gBinRange.attr('display', show ? 'none' : null);

    const gap = Math.round(L.tick * 0.8);
    const pad = Math.round(L.tick * 0.7);
    const linkPx = L.axis;
    const linkH = Math.round(linkPx * 1.7);
    const cardW = Math.max(80, (L.w - 2 * L.marginX - gap * 2) / 3);
    const cardH = Math.max(56, L.baseY - L.histTop - linkH - Math.round(L.tick * 0.5));
    const bodyPx = L.tick;
    const cards: RuleD[] = show ? RULES.map((r, i) => ({
      title: r.title,
      x: L.marginX + i * (cardW + gap),
      y: L.histTop,
      w: cardW,
      h: cardH,
      pad,
      titlePx: L.axis,
      bodyPx,
      lines: this.wrap(r.body, cardW - 2 * pad, bodyPx),
    })) : [];

    const sel = this.gRule.selectAll<SVGGElement, RuleD>('g.rule').data(cards, (d) => d.title);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'rule').attr('opacity', 0);
    enter.append('rect').attr('class', 'rule-box').attr('rx', 8);
    enter.append('text').attr('class', 'rule-title');
    enter.append('text').attr('class', 'rule-body');
    const upd = enter.merge(sel);
    upd.select('rect.rule-box')
      .attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y))
      .attr('width', (d) => r1(d.w)).attr('height', (d) => r1(d.h));
    upd.select('text.rule-title')
      .attr('x', (d) => r1(d.x + d.pad)).attr('y', (d) => r1(d.y + d.pad + d.titlePx * 0.9))
      .text((d) => d.title);
    upd.select<SVGTextElement>('text.rule-body')
      .attr('x', (d) => r1(d.x + d.pad)).attr('y', (d) => r1(d.y + d.pad + d.titlePx * 2.25))
      .each(function (this: SVGTextElement, d: RuleD) {
        select(this).selectAll<SVGTSpanElement, string>('tspan').data(d.lines).join('tspan')
          .attr('x', r1(d.x + d.pad))
          .attr('dy', (_, i) => (i === 0 ? 0 : r1(d.bodyPx * 1.3)))
          .text((l) => l);
      });
    if (ms > 0) tr(upd, TN, ms).attr('opacity', 1);
    else upd.attr('opacity', 1);

    // the two links under the cards, centred as one row
    const linkGap = Math.round(L.tick * 1.6);
    const widths = LINKS.map((l) => this.measure.width(l.label, 'rule-link', linkPx));
    const total = widths[0] + linkGap + widths[1];
    const start = Math.max(L.marginX, (L.w - total) / 2);
    const links: LinkD[] = show ? LINKS.map((l, i) => ({
      href: l.href,
      label: l.label,
      x: start + (i === 0 ? widths[0] / 2 : widths[0] + linkGap + widths[1] / 2),
      y: L.baseY,
    })) : [];
    const lsel = this.gRule.selectAll<HTMLAnchorElement, LinkD>('a.rule-link').data(links, (d) => d.href);
    lsel.exit().remove();
    const lEnter = lsel.enter().append('a').attr('class', 'rule-link').attr('href', (d) => d.href);
    lEnter.append('text').attr('class', 'rule-link-text');
    const lUpd = lEnter.merge(lsel);
    lUpd.select('text.rule-link-text')
      .attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y)).attr('text-anchor', 'middle')
      .text((d) => d.label);
  }

  /** Greedy word wrap of a card body at `maxW` px, measured with the card's own font. */
  private wrap(text: string, maxW: number, px: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.measure.width(next, 'rule-body', px) > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ------------------------------------------------------------- pointer drag
  private dragDown(ev: PointerEvent): void {
    if (ev.button > 0) return;
    this.dragging = true;
    this.lastDrag = null;
    try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
  }

  /** Pointer x → hour through the same scale the dots use, snapped to 1 h and clamped to 28–60. */
  private dragMove(ev: PointerEvent): void {
    if (!this.dragging || !this.inv) return;
    const box = this.svgEl.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const { d0, d1, r0, r1 } = this.inv;
    const raw = d0 + ((px - r0) / (r1 - r0)) * (d1 - d0);
    const v = clamp(Math.round(raw), DRAG_MIN, DRAG_MAX);
    if (v === this.lastDrag) return;
    this.lastDrag = v;
    this.onDragCb?.(v);
  }

  private dragUp(ev: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.lastDrag = null;
    try { (ev.target as Element).releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
  }
}
