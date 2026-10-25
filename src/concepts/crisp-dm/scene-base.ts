import type { Mode } from '../../core/mode';
import type { CrispView } from './view';

/** Below this width (px) the stage is one column: the cycle on top, the phase card under it. */
export const NARROW = 900;

/** The SVG namespace. */
export const NS = 'http://www.w3.org/2000/svg';

/** What the scene host needs from the card area. */
export interface CardPart {
  resize(w: number, mode: Mode): void;
  update(v: CrispView, ms: number): void;
  interrupt(): void;
  destroy(): void;
}

/** A new element with a class (and optional text). */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) {
    e.textContent = text;
  }
  return e;
}

/** A code name in code font. */
export function code(doc: Document, text: string, cls = ''): HTMLElement {
  const e = doc.createElement('code');
  e.className = cls;
  e.textContent = text;
  return e;
}

/** A table: `head` cells in the header row, one `tr` per row of body cells. */
export function table(doc: Document, cls: string, head: string[], rows: string[][]): HTMLTableElement {
  const t = el(doc, 'table', cls);
  const thead = doc.createElement('thead');
  const hr = doc.createElement('tr');
  for (const h of head) {
    hr.append(el(doc, 'th', 'cell-head', h));
  }
  thead.append(hr);
  const tbody = doc.createElement('tbody');
  for (const cells of rows) {
    const tr = doc.createElement('tr');
    for (const c of cells) {
      tr.append(el(doc, 'td', 'cell', c));
    }
    tbody.append(tr);
  }
  t.append(thead, tbody);
  return t;
}
