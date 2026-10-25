import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { formatNumber as f } from '../../core/plot/format';
import { HBarsLayer } from '../../core/plot/hbars';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import { MatrixLayer, matrixHeight } from '../../core/plot/matrix';
import type { TextMeasure } from '../../core/plot/text-measure';
import { sigmoid } from '../metin/score';
import { el, isWide, mountSvg, type G, type ViewScene } from './scene-base';
import { DriftStrip, driftHeight } from './scene-vocab';
import type { PanelView, ResultView, SentimentView } from './view';

/** z range of the sigmoid plot; a larger |z| puts the point on the edge (its label keeps the true p). */
export const Z_RANGE = 4;

/** Horizontal padding and border (px) of a score panel. */
const PANEL_CHROME = 28;

/** Smallest sigmoid plot height (px); two panels on one stage may go down to `SIG_MIN_TWO`. */
const SIG_MIN = 130;
const SIG_MIN_TWO = 96;

/** Panel width (px) from which the contribution bars and the sigmoid sit side by side. */
const SIDE_BY_SIDE = 560;

/** The sigmoid curve of the plot: 81 points over [-Z_RANGE, Z_RANGE]. */
const CURVE: [number, number][] = Array.from({ length: 81 }, (_, i) => {
  const z = -Z_RANGE + (i * 2 * Z_RANGE) / 80;
  return [z, sigmoid(z)];
});

/** The sigmoid chart spec with the probability point (null = no point). */
export function sigmoidSpec(z: number | null, p: number | null): LineChartSpec {
  const zc = z === null ? 0 : Math.max(-Z_RANGE, Math.min(Z_RANGE, z));
  return {
    x: [-Z_RANGE, Z_RANGE],
    y: [0, 1],
    xTitle: 'z',
    yTitle: 'p',
    xTicks: [-4, -2, 0, 2, 4],
    yTicks: [0, 0.5, 1],
    yFormat: (v) => f(v, 1),
    series: [{ id: 'sigmoid', cls: 'sigmoid-curve', pts: CURVE }],
    refs: [{ y: 0.5, label: '', cls: 'ref-half' }],
    marker: z === null || p === null ? null : { x: zc, y: sigmoid(zc), label: f(p, 3), cls: 'p-point' },
  };
}

/**
 * One score panel: the comment's token chips (`.token-chip`, out-of-vocabulary ones `.is-oov` with a dashed
 * frame, removed stop words `.is-dropped`), the contribution bars (`.contrib-bar`, weight x coefficient with
 * its sign), the "z = Σ katkı + b" line, the sigmoid with the probability point and `.prob-value`.
 */
class ScorePanel {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly note: HTMLElement;
  private readonly body: HTMLElement;
  private readonly barBox: HTMLElement;
  private readonly sigBox: HTMLElement;
  private readonly foot: HTMLElement;
  private readonly zLine: HTMLElement;
  private readonly probLine: HTMLElement;
  private readonly probValue: HTMLElement;
  private readonly lean: HTMLElement;
  private readonly compare: HTMLElement;
  private readonly acc: HTMLElement;
  private readonly barSvg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly sigSvg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly barMeasure: TextMeasure;
  private readonly sigMeasure: TextMeasure;
  private readonly bars: HBarsLayer;
  private readonly chart: LineChartLayer;

  constructor(doc: Document, readonly id: PanelView['id']) {
    this.el = el(doc, 'section', 'score-panel');
    this.el.dataset.panel = id;
    this.title = el(doc, 'h3', 'panel-heading');
    this.chips = el(doc, 'div', 'token-chips');
    this.note = el(doc, 'p', 'panel-note');
    this.body = el(doc, 'div', 'panel-body');
    this.barBox = el(doc, 'div', 'contrib-box');
    this.sigBox = el(doc, 'div', 'sig-box');
    this.foot = el(doc, 'div', 'panel-foot');
    this.zLine = el(doc, 'p', 'z-line');
    this.probLine = el(doc, 'p', 'prob-line');
    this.probValue = el(doc, 'strong', 'prob-value');
    this.lean = el(doc, 'span', 'prob-lean');
    this.compare = el(doc, 'p', 'compare-line');
    this.acc = el(doc, 'p', 'acc-line');
    this.probLine.append(el(doc, 'span', 'prob-label', 'p (olumlu) = '), this.probValue, this.lean);
    const b = mountSvg(this.barBox, 'contrib-plot', 'Terim katkıları: ağırlık çarpı katsayı');
    const s = mountSvg(this.sigBox, 'sig-plot', 'Sigmoid eğrisi ve olasılık noktası');
    this.barSvg = b.svg;
    this.sigSvg = s.svg;
    this.barMeasure = b.measure;
    this.sigMeasure = s.measure;
    this.bars = new HBarsLayer(this.barSvg.append('g').attr('class', 'contrib-bars'), this.barMeasure);
    this.chart = new LineChartLayer(this.sigSvg.append('g').attr('class', 'sig-chart') as G, this.sigMeasure);
    this.body.append(this.barBox, this.sigBox);
    this.foot.append(this.zLine, this.probLine, this.compare, this.acc);
    this.el.append(this.title, this.chips, this.note, this.body, this.foot);
  }

  interrupt(): void {
    this.barSvg.selectAll('*').interrupt('bars');
    this.sigSvg.selectAll('*').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.el.remove();
  }

  update(pv: PanelView, width: number, room: number, mode: Mode, ms: number, two = false): void {
    const doc = this.el.ownerDocument;
    this.el.dataset.model = pv.model;
    this.title.textContent = pv.title;
    this.chips.replaceChildren(
      ...pv.chips.map((c) => {
        const cls = `token-chip${c.oov ? ' is-oov' : ''}${c.dropped ? ' is-dropped' : ''}${c.bigram ? ' is-bigram' : ''}${c.negation ? ' is-negation' : ''}`;
        return el(doc, 'code', cls, c.text);
      }),
    );
    this.note.textContent = pv.note ?? '';
    this.note.hidden = pv.note === null;
    const hasP = pv.p !== null;
    this.zLine.textContent = pv.zText;
    this.zLine.hidden = !hasP;
    this.probLine.hidden = !hasP;
    this.probValue.textContent = pv.pText;
    this.lean.textContent = pv.lean ? ` · ${pv.lean}` : '';
    this.compare.textContent = pv.compare ? `${pv.compare.label}: p = ${pv.compare.p}` : '';
    this.compare.hidden = pv.compare === null || !hasP;
    this.acc.textContent = pv.accuracy ?? '';
    this.acc.hidden = pv.accuracy === null;
    this.sigBox.hidden = !hasP;

    const fonts = this.barMeasure.fonts(mode);
    // the panel's own padding and border (css) come off the width its plots may use
    width -= PANEL_CHROME;
    const solo = pv.bars.length === 0 && width >= SIDE_BY_SIDE;
    const side = width >= SIDE_BY_SIDE && !solo;
    this.el.dataset.layout = solo ? 'solo' : side ? 'side' : 'stack';
    const gap = 12;
    const barW = side ? Math.floor((width - gap) * 0.56) : width;
    const sigW = side ? width - gap - barW : solo ? Math.floor((width - gap) * 0.5) : Math.min(width, 360);
    const rowH = Math.round(fonts.tick * 1.7);
    const barH = rowH * pv.bars.length;
    this.barBox.hidden = pv.bars.length === 0;
    this.barSvg.attr('width', barW).attr('height', barH);
    if (pv.bars.length > 0) {
      this.bars.draw(pv.bars, {
        rect: { x: 0, y: 0, w: barW, h: barH },
        tick: fonts.tick,
        rows: pv.bars.length,
        slots: 1,
        max: pv.barMax,
        itemCls: 'contrib-bar',
        valueSample: '+0,000',
        ms,
      });
    } else {
      this.barSvg.select('g.contrib-bar-none').remove();
      this.barSvg.select('g.contrib-bars').selectAll('*').remove();
    }
    const fixed = this.overhead(pv, width, fonts.tick, fonts.axis, solo);
    const fit = Math.round(room - fixed);
    const cap = side || solo ? sigW * 0.85 : sigW * 0.6;
    const sigH = Math.max(two ? SIG_MIN_TWO : SIG_MIN, Math.min(260, cap, side ? Math.max(fit, barH) : solo ? fit : fit - barH));
    if (hasP) {
      this.sigSvg.attr('width', sigW).attr('height', Math.round(sigH));
      const spec = sigmoidSpec(pv.z, pv.p);
      const plot = this.chart.plotRect(sigW, Math.round(sigH), spec);
      this.chart.clear();
      this.chart.draw(spec, plot, ms);
    }
  }

  /** Height (px) of everything in the panel that is not the plot: padding, title, chip rows, note and the foot lines. */
  private overhead(pv: PanelView, width: number, tick: number, axis: number, solo: boolean): number {
    const chipW = pv.chips.map((c) => this.barMeasure.width(c.text, 'tick', tick) + 20);
    let rows = pv.chips.length > 0 ? 1 : 0;
    let used = 0;
    for (const w of chipW) {
      if (used > 0 && used + w > width - 24) {
        rows += 1;
        used = 0;
      }
      used += w + 6;
    }
    const chips = rows * (tick * 1.45 + 6);
    const noteLines = pv.note ? Math.ceil((pv.note.length * tick * 0.55) / Math.max(120, width - 24)) : 0;
    const note = noteLines > 0 ? noteLines * tick * 1.4 + 10 : 0;
    const foot = solo ? 0 : axis * 1.45 + tick * 1.4 + (pv.compare ? tick * 1.4 : 0) + (pv.accuracy ? Math.ceil((pv.accuracy.length * tick * 0.55) / Math.max(120, width - 24)) * tick * 1.4 : 0) + 8;
    return 22 + axis * 1.5 + chips + note + foot + 18;
  }
}

/**
 * Steps 4, 6, 7, 9: the comment and one `ScorePanel` (step 6 shows two, side by side on a wide stage). Panels
 * are created once and updated in place.
 */
export class ScoreScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly comment: HTMLParagraphElement;
  private readonly quote: HTMLElement;
  private readonly panels: HTMLDivElement;
  private readonly drift: DriftStrip;
  private readonly made = new Map<PanelView['id'], ScorePanel>();
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'score-scene');
    this.comment = el(doc, 'p', 'score-comment');
    this.quote = el(doc, 'q', 'comment-text');
    this.comment.append(el(doc, 'span', 'comment-label', 'Yorum: '), this.quote);
    this.panels = el(doc, 'div', 'score-panels');
    this.drift = new DriftStrip(this.root);
    this.root.append(this.comment, this.drift.el, this.panels);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    for (const p of this.made.values()) p.interrupt();
  }

  destroy(): void {
    this.interrupt();
    for (const p of this.made.values()) p.destroy();
    this.drift.destroy();
    this.root.remove();
  }

  update(v: SentimentView, ms: number): void {
    const s = v.score;
    if (!s) return;
    const doc = this.root.ownerDocument;
    const text = s.panels[0]?.comment ?? '';
    this.quote.textContent = text;
    this.comment.hidden = text.trim() === '';
    const wanted = new Set(s.panels.map((p) => p.id));
    for (const [id, panel] of this.made) panel.el.hidden = !wanted.has(id);
    const two = s.panels.length > 1;
    this.root.dataset.panels = String(s.panels.length);
    const wide = isWide(this.w);
    this.root.dataset.wide = String(wide);
    const cols = two && wide;
    const width = Math.max(200, cols ? Math.floor((this.w - 36) / 2) : this.w - 24);
    // room the panel may use: the stage less the comment line
    const axis = parseFloat(getComputedStyle(this.comment).fontSize) || (this.mode === 'ders' ? 19 : 14);
    this.drift.update(v.drift);
    const commentH = (this.comment.hidden ? 0 : Math.round(axis * 1.5 + 20 + 8)) + (v.drift ? driftHeight(axis) + 8 : 0);
    const order: HTMLElement[] = [];
    for (const pv of s.panels) {
      let panel = this.made.get(pv.id);
      if (!panel) {
        panel = new ScorePanel(doc, pv.id);
        this.made.set(pv.id, panel);
      }
      panel.el.hidden = false;
      panel.update(pv, width, this.h - commentH, this.mode, ms, two);
      order.push(panel.el);
    }
    const hidden = [...this.made.values()].filter((p) => p.el.hidden).map((p) => p.el);
    this.panels.replaceChildren(...order, ...hidden);
  }
}

/**
 * Step 5: the test confusion matrix (`MatrixLayer` from core/plot, olumsuz / olumlu), the accuracy and the
 * olumsuz class's precision and recall (`.metric`), and the book's two-comment report with its warning.
 */
export class ResultScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly matrix: MatrixLayer;
  private readonly metricList: HTMLUListElement;
  private readonly book: HTMLElement;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'result-scene');
    const main = el(doc, 'section', 'result-main');
    this.title = el(doc, 'h3', 'panel-heading');
    main.append(this.title);
    const m = mountSvg(main, 'matrix-plot', 'Test yorumlarının karışıklık matrisi');
    this.svg = m.svg;
    this.measure = m.measure;
    this.matrix = new MatrixLayer(this.svg.append('g').attr('class', 'result-matrix'), this.measure);
    this.metricList = el(doc, 'ul', 'metric-row');
    main.append(this.metricList);
    this.book = el(doc, 'section', 'result-book');
    this.root.append(main, this.book);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('cellbg');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: SentimentView, ms: number): void {
    const r = v.result;
    if (!r) return;
    this.root.dataset.model = r.model;
    this.title.textContent = r.title;
    this.root.dataset.wide = String(isWide(this.w));
    this.drawMatrix(r, ms);
    const doc = this.root.ownerDocument;
    this.metricList.replaceChildren(
      ...r.metrics.map((m) => {
        const li = el(doc, 'li', 'metric');
        li.dataset.metric = m.id;
        li.append(el(doc, 'span', 'metric-label', m.label), el(doc, 'strong', 'metric-value', m.value));
        return li;
      }),
    );
    this.drawBook(r);
  }

  private drawMatrix(r: ResultView, ms: number): void {
    const fonts = this.measure.fonts(this.mode);
    const width = Math.max(220, Math.min(460, isWide(this.w) ? Math.floor(this.w * 0.42) : this.w - 24));
    const cellH = Math.round(fonts.tick * 3);
    const height = Math.ceil(matrixHeight(fonts.tick, cellH)) + 4;
    this.svg.attr('width', width).attr('height', height);
    this.matrix.draw(r.matrix, {
      rect: { x: 0, y: 2, w: width, h: height - 4 },
      tick: fonts.tick,
      axis: fonts.axis,
      focusPositive: false,
      ms,
      names: ['olumsuz', 'olumlu'],
      tags: { tn: 'doğru olumsuz', fp: 'yanlış olumlu', fn: 'yanlış olumsuz', tp: 'doğru olumlu' },
    });
  }

  private drawBook(r: ResultView): void {
    const doc = this.root.ownerDocument;
    const b = r.book;
    const head = el(doc, 'tr', 'report-head');
    for (const h of ['sınıf', 'kesinlik', 'duyarlılık', 'f1', 'destek']) head.append(el(doc, 'th', 'report-col', h));
    const rows = b.rows.map((row) => {
      const tr = el(doc, 'tr', 'report-row');
      tr.dataset.class = row.id;
      tr.append(
        el(doc, 'th', 'report-name', row.id),
        el(doc, 'td', 'report-cell', row.precision),
        el(doc, 'td', 'report-cell', row.recall),
        el(doc, 'td', 'report-cell', row.f1),
        el(doc, 'td', 'report-cell', String(row.support)),
      );
      return tr;
    });
    const table = el(doc, 'table', 'report-table');
    table.append(el(doc, 'thead', 'report-thead'), el(doc, 'tbody', 'report-body'));
    table.tHead!.append(head);
    table.tBodies[0].append(...rows);
    const note = el(doc, 'p', 'report-note', b.note);
    const link = el(doc, 'a', 'card-link', r.link.text);
    link.href = r.link.href;
    this.book.replaceChildren(el(doc, 'h3', 'panel-heading', b.title), table, note, link);
  }
}
