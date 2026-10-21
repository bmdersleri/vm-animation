import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { circlesPath, trianglesPath } from '../../core/plot/dots-path';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import { CHURN, COLUMNS, VALUES } from './data';
import type { RowView, SecimMode, SecimView } from './view';

/** Durations before `durationScale`. */
const ROW_MS = 600;
const FADE_MS = 400;
const BAR_MS = 500;
const NAMES = ['sr-row', 'sr-fade', 'sr-bar'];
/** Golden-ratio step: a deterministic, even vertical spread for the dots. */
const GOLDEN = 0.618034;
const DOT_R: Record<Mode, number> = { ders: 3, lab: 2.5 };
/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };
const LEGEND_MODES: readonly SecimMode[] = ['strips', 'variance', 'split'];
const KIDEM = COLUMNS.indexOf('musteriKidemAy');
const GURULTU = COLUMNS.indexOf('gurultuluOznitelik');
const SPLIT_COLS: readonly number[] = [KIDEM, GURULTU];
const SUB_LABELS = ['churn etmeyen ●', 'churn eden ▲'];
/** Longest value-column texts besides the variances: F labels, the RFE labels. */
const VALUE_SAMPLES = ['629.688,34', 'F = 94,66', 'elendi', 'tur 4', '0,00004'];
const ZERO_NOTE = 'varyansı sıfır';

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

interface RowEl {
  g: G;
  hl: El<SVGRectElement>;
  name: El<SVGTextElement>;
  strip: G;
  c0: El<SVGPathElement>;
  c1: El<SVGPathElement>;
  bar: El<SVGRectElement>;
  value: El<SVGTextElement>;
  zero: El<SVGTextElement>;
  elim: El<SVGTextElement>;
  subs: El<SVGTextElement>[];
  cut: { line: El<SVGLineElement>; label: El<SVGTextElement> } | null;
  /** Layout version and split flag the dots were last written for. */
  dotsKey: string;
  placed: boolean;
}

interface Lay {
  rect: Rect;
  mode: Mode;
  tick: number;
  legendH: number;
  rowH: number;
  nameW: number;
  stripL: number;
  stripR: number;
  r: number;
  version: number;
}

/**
 * The eight column rows of `ozellik-secimi`: name on the left, the 400-customer
 * strip (two dot paths per row) or the bar in the middle, the value on the right.
 * Rows slide to their slot, strips fade into bars and bars change width with fixed
 * durations × `ds` (`ms > 0` is only the animate flag). The dots are rewritten
 * only when the layout changes, or when a row enters or leaves the split view.
 */
export class RowsLayer {
  private readonly root: G;
  private readonly measure: TextMeasure;
  private readonly legend: G;
  private readonly legendLabels: El<SVGTextElement>[];
  private readonly rows: RowEl[];
  private lay: Lay | null = null;
  private view: SecimView | null = null;

  constructor(svgEl: SVGSVGElement, private readonly ds: number) {
    this.root = select(svgEl).append('g').attr('class', 'secim-rows');
    this.legend = this.root.append('g').attr('class', 'legend');
    this.legendLabels = ['● churn etmeyen', '▲ churn eden'].map((t, i) =>
      this.legend.append('text').attr('class', `legend-label c${i}`).text(t));
    this.rows = COLUMNS.map((name, col) => this.makeRow(name, col));
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  private makeRow(name: string, col: number): RowEl {
    const g = this.root.append('g').attr('class', 'row').attr('data-col', name);
    const hl = g.append('rect').attr('class', 'hl').attr('fill', 'none');
    const nameEl = g.append('text').attr('class', 'col-name').attr('dy', '0.35em').text(name);
    const strip = g.append('g').attr('class', 'strip');
    const c0 = strip.append('path').attr('class', 'dots c0');
    const c1 = strip.append('path').attr('class', 'dots c1');
    const bar = g.append('rect').attr('class', 'bar').attr('width', 0);
    const value = g.append('text').attr('class', 'row-value').attr('text-anchor', 'end').attr('dy', '0.35em');
    const zero = g.append('text').attr('class', 'zero-note').attr('dy', '0.35em').text(ZERO_NOTE);
    const elim = g.append('text').attr('class', 'elim-label').attr('text-anchor', 'end').attr('dy', '0.35em');
    const splittable = SPLIT_COLS.includes(col);
    const subs = splittable
      ? SUB_LABELS.map((t) => g.append('text').attr('class', 'sub-label').attr('text-anchor', 'end').text(t))
      : [];
    const cut = col === KIDEM
      ? {
        line: g.append('line').attr('class', 'cut'),
        label: g.append('text').attr('class', 'cut-label').text('12 ay'),
      }
      : null;
    return { g, hl, name: nameEl, strip, c0, c1, bar, value, zero, elim, subs, cut, dotsKey: '', placed: false };
  }

  layout(rect: Rect, mode: Mode): void {
    const fonts = this.measure.fonts(mode);
    const bodyPx = this.measure.fontPx('col-name', BODY_FALLBACK[mode]);
    const nameW = this.measure.maxWidth([...COLUMNS], 'col-name', bodyPx) + 16;
    const valueW = this.measure.maxWidth(VALUE_SAMPLES, 'row-value', fonts.tick) + 16;
    const legendH = Math.round(fonts.tick * 1.2 * 1.6);
    this.lay = {
      rect,
      mode,
      tick: fonts.tick,
      legendH,
      rowH: (rect.height - legendH) / COLUMNS.length,
      nameW,
      stripL: rect.left + nameW,
      stripR: rect.left + rect.width - valueW,
      r: DOT_R[mode],
      version: (this.lay?.version ?? 0) + 1,
    };
    if (this.view) {
      this.cancel();
      this.draw(this.view, false);
    }
  }

  update(v: SecimView, ms: number): void {
    this.cancel();
    this.view = v;
    if (this.lay) this.draw(v, ms > 0 && this.ds > 0);
  }

  /** Cancels running transitions and snaps every element to its final state. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, false);
  }

  destroy(): void {
    this.cancel();
    this.root.remove();
  }

  private cancel(): void {
    for (const n of NAMES) {
      this.root.selectAll('*').interrupt(n);
      this.root.interrupt(n);
    }
  }

  // ------------------------------------------------------------- draw
  private draw(v: SecimView, animate: boolean): void {
    const lay = this.lay!;
    const { rect, legendH } = lay;
    const area = rect.height - legendH;
    const fade = animate ? FADE_MS * this.ds : 0;

    // ---- legend above the rows (strip modes only)
    this.legendLabels[0].attr('x', r1(lay.stripL)).attr('y', r1(rect.top + legendH * 0.55)).attr('dy', '0.35em');
    const w0 = this.measure.width(this.legendLabels[0].text(), 'legend-label', lay.tick);
    this.legendLabels[1].attr('x', r1(lay.stripL + w0 + 28)).attr('y', r1(rect.top + legendH * 0.55)).attr('dy', '0.35em');
    tr(this.legend, 'sr-fade', fade).attr('opacity', LEGEND_MODES.includes(v.mode) ? 1 : 0);

    for (const rv of v.rows) this.drawRow(this.rows[rv.col], rv, v, lay, area, animate);
  }

  private drawRow(el: RowEl, rv: RowView, v: SecimView, lay: Lay, area: number, animate: boolean): void {
    const { rect, stripL, stripR } = lay;
    const h = rv.split ? area / 2 : lay.rowH;
    const y = rect.top + lay.legendH + rv.slot * h;
    const cy = h / 2;
    const lh = lay.tick * 1.2;
    const right = rect.left + rect.width - 8;
    const move = animate && el.placed ? ROW_MS * this.ds : 0;
    const fade = animate ? FADE_MS * this.ds : 0;
    el.placed = true;

    el.g.attr('data-slot', rv.slot).attr('data-split', rv.split ? 1 : null)
      .classed('eliminated', rv.eliminated).classed('selected', rv.selected)
      .classed('highlight', rv.highlight).classed('hidden', rv.hidden);
    tr(el.g, 'sr-row', move).attr('transform', `translate(0,${r1(y)})`);
    tr(el.g, 'sr-fade', fade).attr('opacity', rv.hidden ? 0 : 1);

    el.hl.attr('x', rect.left + 2).attr('y', 2).attr('width', rect.width - 4).attr('height', Math.max(0, h - 4));
    el.name.attr('x', rect.left + 8).attr('y', r1(cy));

    // ---- strip (two dot paths) or bar
    const showStrip = rv.bar === null;
    const key = `${lay.version}:${rv.split ? 1 : 0}`;
    if (showStrip && el.dotsKey !== key) {
      this.writeDots(el, rv, lay, h);
      el.dotsKey = key;
    }
    tr(el.strip, 'sr-fade', fade).attr('opacity', showStrip ? 1 : 0);

    const barH = Math.min(h * 0.5, lay.tick * 1.8);
    const barMax = Math.max(0, stripR - stripL);
    const barW = r1((rv.bar ?? 0) * barMax);
    const grow = Number(el.bar.attr('width')) === 0 ? FADE_MS : BAR_MS;
    el.bar.attr('x', r1(stripL)).attr('y', r1(cy - barH / 2)).attr('height', r1(barH));
    tr(el.bar, 'sr-bar', animate ? grow * this.ds : 0).attr('width', barW);

    // ---- labels on the right and in the bar area
    const hasElim = rv.elimLabel !== null;
    const valueY = hasElim && rv.value !== null ? cy - lh * 0.6 : cy;
    el.value.text(rv.value ?? '').attr('x', r1(right)).attr('y', r1(valueY));
    el.elim.text(rv.elimLabel ?? '').attr('x', r1(right)).attr('y', r1(rv.value !== null ? cy + lh * 0.6 : cy));
    el.zero.attr('display', rv.zeroNote ? null : 'none').attr('x', r1(stripL + 10)).attr('y', r1(cy));

    // ---- split view: sub-strip names and the 12-month cut
    el.subs.forEach((t, i) => {
      t.attr('display', rv.split ? null : 'none').attr('x', r1(stripR)).attr('y', r1(subTop(h, lh, i) - 4));
    });
    if (el.cut) {
      const x = r1(this.xScale(KIDEM, lay)(v.cut?.value ?? 11.5));
      el.cut.line.attr('display', v.cut ? null : 'none').attr('x1', x).attr('x2', x)
        .attr('y1', r1(subTop(h, lh, 0))).attr('y2', r1(subTop(h, lh, 1) + subBand(h, lh)));
      el.cut.label.attr('display', v.cut ? null : 'none').attr('x', r1(x + 8)).attr('y', r1(h - 4));
    }
  }

  /** Maps a column's value range onto the strip; a constant column sits in the middle. */
  private xScale(col: number, lay: Lay): (v: number) => number {
    const xs = VALUES[col];
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const a = lay.stripL + lay.r + 4;
    const b = lay.stripR - lay.r - 4;
    return (v) => (hi === lo ? (a + b) / 2 : a + ((v - lo) / (hi - lo)) * (b - a));
  }

  private writeDots(el: RowEl, rv: RowView, lay: Lay, h: number): void {
    const x = this.xScale(rv.col, lay);
    const lh = lay.tick * 1.2;
    const xs: number[][] = [[], []];
    const ys: number[][] = [[], []];
    const values = VALUES[rv.col];
    for (let i = 0; i < values.length; i++) {
      const c = CHURN[i];
      const frac = (i * GOLDEN) % 1;
      let y: number;
      if (rv.split) {
        const band = subBand(h, lh);
        y = subTop(h, lh, c) + lay.r + frac * (band - 2 * lay.r);
      } else {
        const band = h * 0.7 - 2 * lay.r;
        y = h / 2 + (frac - 0.5) * band;
      }
      xs[c].push(x(values[i]));
      ys[c].push(y);
    }
    el.c0.attr('d', circlesPath(xs[0], ys[0], lay.r));
    el.c1.attr('d', trianglesPath(xs[1], ys[1], lay.r));
  }
}

/** Height of one sub-strip in a split row: the row minus two label lines and the cut label. */
const subBand = (h: number, lh: number): number => (h - 3.8 * lh) / 2;
/** Top of sub-strip `i` (0 = churn etmeyen, 1 = churn eden) in row coordinates. */
const subTop = (h: number, lh: number, i: number): number => 1.4 * lh + i * (subBand(h, lh) + 1.4 * lh);
