import { sepetData, type Basket, type Itemset } from '../birliktelik/data';
import { setBraces, setNames, sortItems } from '../birliktelik/format';
import type { Rule } from '../birliktelik/rules';
import { renderStrip } from '../../core/plot/strip';
import { baseStrip, confidenceStrip, liftStrip, measures, ratioText, ruleText, side, supportStrip } from './view';

/** What the reading panel shows; the scene maps a step to one of these. */
export type PanelKind = 'list' | 'table' | 'support1' | 'support2' | 'conf' | 'trap' | 'real' | 'rules';

export interface PanelSpec {
  kind: PanelKind;
  tx: readonly Basket[];
  x: Itemset;
  y: Itemset;
  /** Count-up in progress: the baskets counted so far (null = counting is done or not animated). */
  counted: number | null;
  /**
   * Step 9-10 summary: rules found, rules kept by the lift filter, filter on, and the groups of two or more rules
   * that share one scatter point (same support and confidence), in rule order.
   */
  rules?: { total: number; kept: number; filtering: boolean; noSets?: boolean; stacks: readonly (readonly Rule[])[] };
  /** The book's code lines shown under the panel (steps 2 and 10). */
  code?: readonly string[];
}

export const NEED_RULE = 'Bir öncül ve bir sonuç seç.';
export const NEED_ITEM = 'Bir ürün seç.';
/** Stacked-point notes shown at most; a busier Lab scatter gets one summary line instead of the rest. */
const MAX_STACK_NOTES = 2;
/** Rules named per stacked-point note. */
const MAX_STACK_NAMES = 3;

function stackNotes(stacks: readonly (readonly Rule[])[]): HTMLElement[] {
  const notes = stacks.slice(0, MAX_STACK_NOTES).map((g) => {
    const names = g.slice(0, MAX_STACK_NAMES).map(ruleText);
    if (g.length > MAX_STACK_NAMES) names.push('…');
    const p = el('p', 'bk-note', `Aynı noktada ${g.length} kural: ${names.join(' · ')}`);
    p.dataset.stack = String(g.length);
    return p;
  });
  const rest = stacks.length - MAX_STACK_NOTES;
  if (rest > 0) notes.push(el('p', 'bk-note', `… ve ${rest} noktada daha birden çok kural var.`));
  return notes;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function row(label: string, value: string, attrs: Record<string, string> = {}): HTMLElement {
  const d = el('div', 'bk-row-pair');
  const v = el('strong', 'bk-value', value);
  for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val);
  d.append(el('span', 'bk-label', label), v);
  return d;
}

function strip(text: string, attrs: Record<string, string> = {}): HTMLElement {
  const p = el('p', 'bk-strip');
  for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
  renderStrip(p, text);
  return p;
}

/** Confidence bar on a 0..1 track with the dashed base-rate line; the bar is the rate of Y among X baskets. */
function confidenceBar(confidence: number | null, base: number | null): HTMLElement {
  const box = el('div', 'bk-gauge');
  const track = el('div', 'bk-gauge-track');
  if (confidence !== null) {
    const fill = el('div', 'bk-gauge-fill');
    fill.style.width = `${(confidence * 100).toFixed(1)}%`;
    fill.setAttribute('data-conf-bar', String(confidence));
    track.append(fill);
  }
  if (base !== null) {
    const line = el('div', 'bk-gauge-base');
    line.style.left = `${(base * 100).toFixed(1)}%`;
    line.setAttribute('data-base-line', String(base));
    const tag = el('span', 'bk-gauge-base-label', `taban ${ratioText(base)}`);
    line.append(tag);
    track.append(line);
  }
  const scale = el('div', 'bk-gauge-scale');
  scale.append(el('span', '', '0'), el('span', '', '1'));
  box.append(el('span', 'bk-label', confidence === null ? 'güven çubuğu: tanımsız' : `güven ${ratioText(confidence)}`), track, scale);
  return box;
}

function appendCode(panel: HTMLElement, lines: readonly string[] | undefined): void {
  if (!lines || lines.length === 0) return;
  panel.append(el('code', 'bk-code', lines.join('\n')));
}

export function drawPanel(panel: HTMLElement, spec: PanelSpec): void {
  panel.replaceChildren();
  const { kind, tx, x, y } = spec;
  const n = tx.length;
  const xs = sortItems(x);
  const ys = sortItems(y);

  if (kind === 'list') {
    panel.append(el('h3', 'bk-title', `${n} fiş`), el('p', 'bk-note', 'Her satır bir müşterinin tek alışverişi.'));
    return;
  }
  if (kind === 'table') {
    panel.append(el('h3', 'bk-title', 'İşlem–öğe tablosu'), el('p', 'bk-note', `${n} satır × ${sepetData.items.length} sütun; dolu hücre = ürün sepette.`));
    appendCode(panel, spec.code);
    return;
  }
  if (kind === 'rules') {
    const r = spec.rules;
    panel.append(el('h3', 'bk-title', 'Kural saçılımı'));
    if (r) {
      panel.append(row('Kural sayısı', String(r.total), { 'data-rules': String(r.total) }));
      if (r.total === 0) panel.append(el('p', 'bk-note', r.noSets ? 'Bu eşikte sık küme yok.' : 'Bu eşiklerde kural yok.'));
      if (r.filtering) panel.append(row('Süzgeçten geçen', String(r.kept), { 'data-kept': String(r.kept) }), row('Soluklaşan', String(r.total - r.kept), { 'data-faded': String(r.total - r.kept) }));
      panel.append(...stackNotes(r.stacks));
    }
    if (xs.length > 0 && ys.length > 0) {
      const m = measures(tx, xs, ys);
      panel.append(
        el('p', 'bk-note', `Seçili kural: ${ruleText({ x: xs, y: ys })}`),
        row('Destek', ratioText(m.support), { 'data-sel-support': String(m.support) }),
        row('Güven', ratioText(m.confidence), { 'data-sel-confidence': String(m.confidence) }),
        row('Kaldıraç', ratioText(m.lift), { 'data-sel-lift': String(m.lift) }),
      );
    }
    appendCode(panel, spec.code);
    return;
  }

  if (kind === 'support1' || kind === 'support2') {
    const set = kind === 'support1' ? xs : sortItems([...new Set([...xs, ...ys])]);
    if (kind === 'support1' ? xs.length === 0 : xs.length === 0 || ys.length === 0) {
      panel.append(el('p', 'bk-note', kind === 'support1' ? NEED_ITEM : NEED_RULE));
      return;
    }
    const m = measures(tx, set, set);
    const total = m.cx;
    panel.append(
      el('h3', 'bk-title', set.length === 1 ? `Destek: ${setNames(set)}` : `Destek: ${setBraces(set)}`),
      row('Sayılan fiş', String(spec.counted ?? total), { 'data-count': String(spec.counted ?? total) }),
      row('Toplam fiş', String(n), { 'data-of': String(n) }),
      strip(supportStrip(tx, set), { 'data-strip-kind': 'support' }),
    );
    return;
  }

  // confidence steps: conf, trap, real
  if (xs.length === 0 || ys.length === 0) {
    panel.append(el('p', 'bk-note', NEED_RULE));
    return;
  }
  const m = measures(tx, xs, ys);
  panel.append(
    el('h3', 'bk-title', `Kural: ${ruleText({ x: xs, y: ys })}`),
    row(`${side(xs)} içeren fiş`, String(m.cx), { 'data-of': String(m.cx) }),
    row('Sonucu da içeren', String(spec.counted ?? m.cxy), { 'data-count': String(spec.counted ?? m.cxy) }),
  );
  panel.append(strip(confidenceStrip(tx, xs, ys), { 'data-strip-kind': 'confidence' }));
  if (kind === 'conf') {
    panel.append(strip(supportStrip(tx, [...new Set([...xs, ...ys])]), { 'data-strip-kind': 'support' }));
    return;
  }
  panel.append(confidenceBar(m.confidence, m.base), strip(baseStrip(tx, ys), { 'data-strip-kind': 'base' }));
  panel.append(strip(liftStrip(tx, xs, ys), { 'data-lift': 'forward' }));
  if (kind === 'real') panel.append(strip(liftStrip(tx, ys, xs), { 'data-lift': 'backward' }));
}
