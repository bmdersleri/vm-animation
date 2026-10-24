import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { Chip, PatternRow, TfidfView, TokensView } from './view';

/** One token chip; `dropped` strikes it out, `broken` frames it in orange. */
function chip(doc: Document, c: Chip): HTMLElement {
  const e = el(doc, 'span', 'token-chip', c.text);
  e.classList.toggle('is-dropped', c.dropped);
  e.classList.toggle('is-broken', c.broken);
  return e;
}

function chipRow(doc: Document, chips: readonly Chip[], cls = 'token-chips'): HTMLElement {
  const row = el(doc, 'div', cls);
  row.append(...chips.map((c) => chip(doc, c)));
  return row;
}

/**
 * The token strip (steps 1-3): the raw comment with the characters the cleaning drops faded, the token chips
 * under it, the two patterns of step 2 side by side and the stop-word set, the `Counter` row and the "değil"
 * warning of step 3. The area is rebuilt on every update; chips wrap, so nothing is wider than the stage.
 */
export class TokensScene implements ViewScene {
  private readonly root: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.root = el(host.ownerDocument, 'div', 'tokens-scene');
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: TfidfView, _ms: number): void {
    const t = v.tokens;
    if (!t) return;
    const doc = this.root.ownerDocument;
    this.root.dataset.part = t.part;
    this.root.replaceChildren(...this.parts(doc, t));
  }

  private parts(doc: Document, t: TokensView): HTMLElement[] {
    const out: HTMLElement[] = [];
    if (t.raw) {
      const raw = el(doc, 'p', 'raw-line');
      raw.append(
        ...t.raw.map((c) => {
          const s = el(doc, 'span', 'raw-char', c.ch);
          s.classList.toggle('is-gone', c.state === 'gone');
          s.classList.toggle('is-lower', c.state === 'lower');
          return s;
        }),
      );
      out.push(el(doc, 'p', 'tokens-label', 'ham yorum'), raw);
    }
    if (t.patterns) {
      const rows = el(doc, 'div', 'pattern-rows');
      rows.append(...t.patterns.map((p) => this.pattern(doc, p)));
      out.push(rows);
    }
    if (t.part !== 'patterns') {
      out.push(el(doc, 'p', 'tokens-label', 'token çipleri'), chipRow(doc, t.chips));
    }
    if (t.stopSet) {
      out.push(el(doc, 'p', 'tokens-label', 'kitabın stop-word kümesi'));
      const set = el(doc, 'div', 'token-chips stop-set');
      set.append(...t.stopSet.map((w) => el(doc, 'span', 'token-chip stop-chip', w)));
      out.push(set);
    }
    if (t.counter) {
      out.push(el(doc, 'p', 'tokens-label', 'Counter'));
      const row = el(doc, 'div', 'token-chips counter-row');
      row.append(
        ...t.counter.map((c) => {
          const e = el(doc, 'span', 'token-chip counter-chip');
          e.append(c.term, el(doc, 'b', 'counter-count', String(c.count)));
          return e;
        }),
      );
      out.push(row);
    }
    if (t.warn) {
      const warn = el(doc, 'div', 'warn-row');
      warn.append(
        el(doc, 'strong', 'warn-title', 'Uyarı: "değil" stop-word olursa'),
        el(doc, 'span', 'warn-input', `"${t.warn.input}"`),
        chipRow(doc, t.warn.chips),
        el(doc, 'span', 'warn-kept', `[${t.warn.kept.join(', ')}] kalır: anlam ters döner`),
      );
      out.push(warn);
    }
    return out;
  }

  private pattern(doc: Document, p: PatternRow): HTMLElement {
    const row = el(doc, 'div', 'pattern-row');
    row.dataset.pattern = p.id;
    row.append(
      el(doc, 'code', 'pattern-code', p.pattern),
      el(doc, 'span', 'pattern-flow', `"${p.input}" → "${p.output}"`),
      chipRow(doc, p.chips),
    );
    return row;
  }
}
