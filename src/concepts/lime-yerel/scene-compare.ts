import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { TextMeasure } from '../../core/plot/text-measure';
import { WaterfallLayer } from '../../core/plot/waterfall';
import { el, featureName, NARROW, NS, type ViewScene } from './scene-base';
import { SignedBars } from './signed-bars';
import type { CompareView, LimeView } from './view';

/** Vertical metrics (px) kept in step with the CSS: root padding (wide / narrow) and the gap between blocks. */
export const CMP_PAD_V = 16;
export const CMP_PAD_V_NARROW = 8;
export const CMP_GAP = 8;
export const CMP_GAP_NARROW = 6;
/** Padding and border of the badge around one text line (wide / narrow), and the padding of the table cells (wide / narrow). */
export const CMP_BADGE_PAD = 14;
export const CMP_BADGE_PAD_NARROW = 10;
export const CMP_CELL_PAD = 8;
export const CMP_CELL_PAD_NARROW = 4;

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Step 9: SHAP and LIME of one customer. The head row holds the agreement badge `.agree-badge[data-agree]` (is the
 * most influential feature the same?) and the model's p with the surrogate's prediction. Stage `book` shows the
 * book's kod06 table `.compare-table` (rank, SHAP feature, LIME rule); stage `pair` the two panels side by side
 * (under each other on a narrow stage): the SHAP force bar on the shared `WaterfallLayer` and the LIME coefficients
 * on `SignedBars`. The counter and the book's misunderstanding note sit under them; the note is left out when the
 * stage has no room for it. Badge and counter are navy and neutral: orange and blue are the sign of a contribution.
 */
export class CompareScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly badge: HTMLParagraphElement;
  private readonly modelValue: HTMLElement;
  private readonly localValue: HTMLElement;
  private readonly tableWrap: HTMLDivElement;
  private readonly tableBody: HTMLTableSectionElement;
  private readonly panels: HTMLDivElement;
  private readonly counter: HTMLParagraphElement;
  private readonly note: HTMLParagraphElement;
  private readonly shapSvg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly limeSvg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly limeTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly limeG: G;
  private readonly forceG: G;
  private readonly force: WaterfallLayer;
  private readonly signed: SignedBars;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'compare-scene');
    const head = el(doc, 'div', 'compare-head');
    this.badge = el(doc, 'p', 'agree-badge');
    const numbers = el(doc, 'p', 'compare-numbers');
    this.modelValue = el(doc, 'strong', 'compare-model');
    this.localValue = el(doc, 'strong', 'compare-local');
    numbers.append('model p ', this.modelValue, ' · vekil tahmini ', this.localValue);
    head.append(this.badge, numbers);

    this.tableWrap = el(doc, 'div', 'compare-table-wrap');
    const table = el(doc, 'table', 'compare-table');
    const headRow = table.createTHead().insertRow();
    for (const text of ['sıra', 'SHAP özelliği', 'LIME kuralı']) {
      const th = doc.createElement('th');
      th.textContent = text;
      headRow.append(th);
    }
    this.tableBody = table.createTBody();
    this.tableWrap.append(table);

    this.panels = el(doc, 'div', 'compare-panels');
    const shapBox = el(doc, 'div', 'compare-shap');
    const limeBox = el(doc, 'div', 'compare-lime');
    const shapRoot = doc.createElementNS(NS, 'svg');
    const limeRoot = doc.createElementNS(NS, 'svg');
    this.shapSvg = select(shapRoot).attr('class', 'compare-shap-plot').attr('role', 'img').attr('aria-label', 'SHAP katkıları: temel değerden tahmine kuvvet çubuğu');
    this.limeSvg = select(limeRoot).attr('class', 'compare-lime-plot').attr('role', 'img').attr('aria-label', 'LIME katsayıları');
    this.forceG = this.shapSvg.append('g').attr('class', 'force-bar');
    this.force = new WaterfallLayer(this.forceG.node()!);
    this.limeTitle = this.limeSvg.append('text').attr('class', 'compare-title').text('LIME katsayıları');
    this.limeG = this.limeSvg.append('g').attr('class', 'compare-bars');
    const probe = this.limeSvg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.signed = new SignedBars(this.limeG, this.measure);
    shapBox.append(shapRoot);
    limeBox.append(limeRoot);
    this.panels.append(shapBox, limeBox);

    this.counter = el(doc, 'p', 'compare-counter');
    this.note = el(doc, 'p', 'compare-note');
    this.root.append(head, this.tableWrap, this.panels, this.counter, this.note);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.force.interrupt();
    this.signed.interrupt();
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    const c = v.compare;
    if (!c) {
      return;
    }
    this.root.dataset.stage = c.stage;
    this.badge.dataset.agree = String(c.agree);
    this.badge.textContent = `${c.agree ? '=' : '≠'} ${c.agreeText}`;
    this.modelValue.textContent = c.modelText;
    this.localValue.textContent = c.localText;
    this.counter.textContent = c.counterText;
    this.note.textContent = c.noteText;
    this.tableWrap.hidden = c.table === null;
    this.panels.hidden = c.table !== null;
    if (c.table) {
      this.fillTable(c);
    }
    this.layout(c, ms);
  }

  private fillTable(c: CompareView): void {
    const doc = this.root.ownerDocument;
    this.tableBody.replaceChildren(
      ...(c.table ?? []).map((r) => {
        const tr = el(doc, 'tr', 'compare-row');
        tr.dataset.rank = String(r.rank);
        const rank = el(doc, 'td', 'compare-rank', String(r.rank));
        const shap = el(doc, 'td', 'compare-shap-cell');
        const name = featureName(doc, r.shap);
        name.classList.add('compare-shap-name');
        shap.append(name);
        const rule = el(doc, 'td', 'compare-rule', r.rule);
        tr.append(rank, shap, rule);
        return tr;
      }),
    );
  }

  /** Sizes the blocks from the stage height, draws the panels, and records the height the scene uses. */
  private layout(c: CompareView, ms: number): void {
    const narrow = this.w < NARROW;
    const fonts = this.measure.fonts(this.mode);
    const fs = fonts.tick;
    const lh = fs * 1.3;
    const padV = narrow ? CMP_PAD_V_NARROW : CMP_PAD_V;
    const gap = narrow ? CMP_GAP_NARROW : CMP_GAP;
    const cellPad = narrow ? CMP_CELL_PAD_NARROW : CMP_CELL_PAD;
    const inner = Math.max(240, this.w - (narrow ? 8 : 24));
    // text blocks: head (badge on one line, numbers beside it or under it), counter, note
    const headH = Math.ceil(lh + (narrow ? CMP_BADGE_PAD_NARROW : CMP_BADGE_PAD) + (narrow ? lh + gap : 0));
    const counterH = Math.ceil(this.lines(c.counterText, inner, fs) * lh);
    const noteH = Math.ceil(this.lines(c.noteText, inner, fs) * lh);
    const fixed = padV + headH + gap + counterH;

    let body = 0;
    if (c.table) {
      const rows = 1 + c.table.length;
      const ruleW = Math.floor((inner - 16) * 0.55);
      const longest = Math.max(...c.table.map((r) => this.lines(r.rule, ruleW, fs, 'rule-name')));
      body = Math.ceil(rows * (lh + cellPad) + (longest - 1) * lh * c.table.length + 6);
    } else {
      body = this.drawPanels(c, inner, fs, Math.max(0, this.h - fixed - gap), narrow, ms);
    }
    // the note is the first block to go when the stage is short
    const showNote = fixed + gap + body + gap + noteH <= this.h;
    this.note.hidden = !showNote;
    const used = fixed + gap + body + (showNote ? gap + noteH : 0);
    this.root.dataset.used = String(Math.ceil(used));
  }

  /** Number of lines `text` takes at `width` in the tick font. */
  private lines(text: string, width: number, fs: number, cls = 'tick'): number {
    return Math.max(1, this.measure.wrap(text, width, cls, fs).length);
  }

  /** Draws the SHAP force bar and the LIME bars; returns the height the panels row takes. */
  private drawPanels(c: CompareView, inner: number, fs: number, room: number, narrow: boolean, ms: number): number {
    const gap = narrow ? CMP_GAP_NARROW : 16;
    const panelW = narrow ? inner : Math.floor((inner - gap) / 2);
    const animate = ms > 0;
    // SHAP force bar: its own layout decides the height; a narrow stage drops the value axis, then the title, until the LIME bars fit
    const titleH = Math.ceil(fs * 1.7);
    const names = this.signed.names(c.rules, panelW, fs);
    const barsMin = Math.ceil((names.nameH + 14) * c.bars.length);
    const variants = [c.spec, { ...c.spec, axis: false }, { ...c.spec, axis: false, title: undefined }];
    let shapH = 0;
    for (const spec of narrow ? variants : variants.slice(0, 1)) {
      shapH = Math.ceil(this.force.update(spec, { x: 0, y: 0, w: panelW, h: 0 }, animate));
      if (!narrow || shapH + gap + titleH + barsMin <= room) {
        break;
      }
    }
    this.shapSvg.attr('width', panelW).attr('height', shapH);

    // LIME bars: the rule names above their bars; the stage gives them what the SHAP panel leaves (narrow) or its own row
    const natural = names.nameH + fs * 1.5 + 14;
    const roomForBars = narrow ? room - shapH - gap - titleH : room - titleH;
    const groupH = Math.max(names.nameH + 6 + 8, Math.min(natural, roomForBars / c.bars.length));
    const barsH = Math.ceil(groupH * c.bars.length);
    const limeH = titleH + barsH;
    this.limeSvg.attr('width', panelW).attr('height', limeH);
    this.limeTitle.attr('x', 4).attr('y', Math.round(fs * 1.1));
    this.limeG.attr('transform', `translate(0,${titleH})`);
    this.signed.draw(c.bars, names, { width: panelW, height: barsH, fs, ms, itemCls: 'compare-bar' });
    return narrow ? shapH + gap + limeH : Math.max(shapH, limeH);
  }
}
