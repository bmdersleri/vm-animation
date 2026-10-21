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

type G = Selection<SVGGElement, unknown, null, undefined>;
type Tail = 'right' | 'left';
type MarkKind = 'mean' | 'median';

interface Lay {
  w: number; h: number;
  tick: number;
  marginX: number;
  axisY: number; tickY: number; titleY: number;
  labelTop: number; rowH: number;
  histTop: number; baseY: number;
}

interface BarD { d: string; cx: number; count: number; yTop: number; lo: number; hi: number }
interface MarkD { kind: MarkKind; x: number; cx: number; w: number; ly: number; label: string; show: boolean }

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
  private readonly logNote: Selection<SVGTextElement, unknown, null, undefined>;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: DagilimView | null = null;

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
      this.draw(this.view, 0);
    }
  }

  update(v: DagilimView, ms: number): void {
    this.cancel();
    this.view = v;
    if (this.lay) this.draw(v, ms);
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
    const marginX = Math.max(24, Math.round(tick * 1.8));
    const labelTop = Math.ceil(tick * 0.95);
    const rowH = Math.round(tick * 1.35);
    // the number line owns the upper third; two label rows plus the dots fit above it
    const axisY = Math.max(Math.round(labelTop + 3.2 * rowH), Math.round(h * 0.34));
    const tickY = axisY + Math.round(tick * 0.9 + 6);
    const titleY = tickY + Math.round(f.axis * 1.15 + 8);
    const histTop = titleY + Math.round(f.axis * 0.4 + 8);
    const baseY = h - Math.round(tick * 1.5 + 8);
    return { w, h, tick, marginX, axisY, tickY, titleY, labelTop, rowH, histTop, baseY };
  }

  // ------------------------------------------------------------- draw
  private draw(v: DagilimView, ms: number): void {
    const L = this.lay!;
    const lo = Math.min(...v.values);
    const hi = Math.max(...v.values);
    const span = hi - lo || 1;
    const sc = lineScale(
      { min: lo - span * PAD_FRAC, max: hi + span * PAD_FRAC },
      [L.marginX, Math.max(L.marginX + 40, L.w - L.marginX)],
    );
    const title = v.log ? 'log1p (saat + 1)' : 'Haftalık çalışma saati (saat)';
    this.nl.draw(
      sc, L.axisY,
      { tickCount: L.w > 700 ? 6 : 5, tickY: L.tickY, title, titleY: L.titleY },
      ms, v.log ? 'log' : 'raw',
    );
    this.logNote
      .attr('x', r1(L.w - L.marginX)).attr('y', r1(L.titleY))
      .attr('opacity', v.log ? 1 : 0).text(v.log ? '1p' : '');

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
        cx: (x0 + x1) / 2, count: b.count, yTop, lo: b.lo, hi: b.hi,
      };
    });
    const d = bars.map((b) => b.d).join('');
    if (ms > 0 && this.histBar.attr('d')) tr(this.histBar, TN, ms).attr('d', d);
    else this.histBar.attr('d', d);

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
  }
}
