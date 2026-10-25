import { FEATURES } from '../xai/data';
import { el, featureName } from './scene-base';
import type { PatternRow } from './view';

/** Narrow-table metrics (CSS keeps them: line-height 1.2, cell padding 2 px, border spacing 2 px). */
export const TABLE_LINE = 1.2;
export const TABLE_PAD = 2;
export const TABLE_SPACING = 2;
/** Rows of the table: one per binary pattern. */
export const TABLE_ROWS = 8;

/** Height (px) of the narrow table with the caption, a two-line header and the eight rows, for a cell font of `cellFs` px. */
export function narrowTableHeight(cellFs: number): number {
  const line = cellFs * TABLE_LINE;
  const row = line + 2 * TABLE_PAD + TABLE_SPACING;
  return Math.ceil(line + 8 + (2 * line + 2 * TABLE_PAD + TABLE_SPACING) + TABLE_ROWS * row + TABLE_SPACING);
}

/**
 * The pattern table of steps 4 and 5: one `.pattern-row[data-mask]` per binary pattern (three "same bin as the
 * customer" marks, the sample count `.pattern-n`, the mean p `.pattern-mean`) and, in step 5, the kernel weight
 * `.pattern-weight`. A pattern with no sample reads "0 örnek" and "—".
 */
export class PatternTable {
  readonly root: HTMLDivElement;
  private readonly head: HTMLTableRowElement;
  private readonly body: HTMLTableSectionElement;
  private readonly weightHead: HTMLTableCellElement;

  constructor(doc: Document) {
    this.root = el(doc, 'div', 'pattern-wrap');
    const table = el(doc, 'table', 'pattern-table');
    const caption = el(doc, 'caption', 'pattern-caption', '✓ = örnek müşteriyle aynı bölmede');
    this.head = table.createTHead().insertRow();
    FEATURES.forEach((name) => {
      const th = el(doc, 'th', 'pattern-head');
      th.append(featureName(doc, name));
      this.head.append(th);
    });
    this.head.append(el(doc, 'th', 'pattern-head', 'örnek'), el(doc, 'th', 'pattern-head', 'ort. p'));
    this.weightHead = el(doc, 'th', 'pattern-head', 'ağırlık');
    this.body = table.createTBody();
    table.prepend(caption);
    this.root.append(table);
  }

  update(rows: PatternRow[]): void {
    const doc = this.root.ownerDocument;
    const withWeight = rows.some((r) => r.weightText !== null);
    if (withWeight && !this.weightHead.isConnected) {
      this.head.append(this.weightHead);
    } else if (!withWeight) {
      this.weightHead.remove();
    }
    this.body.replaceChildren(
      ...rows.map((r) => {
        const tr = el(doc, 'tr', `pattern-row${r.empty ? ' is-empty' : ''}${r.mask === 7 ? ' is-customer' : ''}`);
        tr.dataset.mask = String(r.mask);
        r.marks.forEach((on, j) => {
          const td = el(doc, 'td', `pattern-mark ${on ? 'is-in' : 'is-out'}`, on ? '✓' : '✗');
          td.dataset.feature = String(j);
          td.setAttribute('aria-label', `${FEATURES[j]} ${on ? 'aynı bölmede' : 'başka bölmede'}`);
          tr.append(td);
        });
        tr.append(el(doc, 'td', 'pattern-n', r.nText), el(doc, 'td', 'pattern-mean', r.meanText));
        if (r.weightText !== null) {
          tr.append(el(doc, 'td', 'pattern-weight', r.weightText));
        }
        return tr;
      }),
    );
  }

  destroy(): void {
    this.root.remove();
  }
}
