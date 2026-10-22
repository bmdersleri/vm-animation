import { sepetData, type Basket, type Item } from '../birliktelik/data';
import { itemName } from '../birliktelik/format';
import { basketLine, ratioText } from './view';

/** What a highlighted column stands for: X (antecedent) or Y (consequent). */
export type Role = 'x' | 'y';

export interface RowFlag {
  /** The basket contains X / Y. */
  x: boolean;
  y: boolean;
  /** The basket is a numerator row the count has already reached (all of them once counting is done). */
  match: boolean;
  /** The basket is faded: it does not contain X (confidence steps). */
  dim: boolean;
}

export interface TableSpec {
  tx: readonly Basket[];
  cols: ReadonlyMap<Item, Role>;
  rows: readonly RowFlag[];
  /** Show the support bars under the column counts (step 3). */
  bars: boolean;
  /** Tag the highlighted column headers with their X / Y letter. */
  tags: boolean;
}

const ITEMS = sepetData.items;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface FisTable {
  /** The receipts list (step 1) and the one-hot table (steps 2-8) live side by side; the scene's `data-view` shows one. */
  readonly list: HTMLOListElement;
  readonly table: HTMLTableElement;
  update(spec: TableSpec): void;
}

/**
 * Builds the receipt list and the 18 x 6 one-hot table once; `update` only repaints attributes and text.
 * A cell toggles on click, or on Space / Enter; arrow keys move between cells (one tab stop).
 */
export function mountFisTable(host: HTMLElement, rowCount: number, onToggle: (row: number, col: number) => void = () => {}): FisTable {
  const list = el('ol', 'bk-list');
  list.setAttribute('aria-label', 'Kasa fişleri');
  const lines: HTMLLIElement[] = [];
  for (let r = 0; r < rowCount; r++) {
    const li = el('li', 'bk-list-item');
    li.setAttribute('value', String(r + 1));
    list.append(li);
    lines.push(li);
  }

  const table = el('table', 'bk-table');
  table.setAttribute('aria-label', 'İşlem–öğe tablosu: satır fiş, sütun ürün, dolu hücre ürünün sepette olduğunu gösterir');
  const head = table.createTHead().insertRow();
  head.append(el('th', 'bk-corner', 'Fiş'));
  const tags: HTMLElement[] = [];
  const heads = ITEMS.map((item) => {
    const th = el('th', 'bk-col-head');
    th.dataset.item = item;
    const tag = el('span', 'bk-tag');
    tag.setAttribute('aria-hidden', 'true');
    tags.push(tag);
    th.append(el('span', 'bk-col-name', itemName(item)), tag);
    head.append(th);
    return th;
  });

  const body = table.createTBody();
  const trs: HTMLTableRowElement[] = [];
  const cells: HTMLTableCellElement[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const tr = body.insertRow();
    tr.className = 'bk-row';
    tr.dataset.row = String(r);
    const rh = el('th', 'bk-row-head');
    rh.scope = 'row';
    const marks = el('span', 'bk-marks');
    marks.setAttribute('aria-hidden', 'true');
    marks.append(el('span', 'bk-mark-x', '▌'), el('span', 'bk-mark-y', '◆'));
    rh.append(el('span', 'bk-row-no', String(r + 1)), marks);
    tr.append(rh);
    const rowCells = ITEMS.map((item, c) => {
      const td = el('td', 'bk-cell');
      td.dataset.row = String(r);
      td.dataset.col = String(c);
      td.dataset.item = item;
      td.setAttribute('role', 'gridcell');
      td.tabIndex = r === 0 && c === 0 ? 0 : -1;
      tr.append(td);
      return td;
    });
    trs.push(tr);
    cells.push(rowCells);
  }

  const foot = table.createTFoot();
  const countRow = foot.insertRow();
  countRow.className = 'bk-counts';
  countRow.append(el('th', 'bk-foot-head', 'Fiş'));
  const barRow = foot.insertRow();
  barRow.className = 'bk-bars';
  barRow.append(el('th', 'bk-foot-head', 'Destek'));
  const countCells = ITEMS.map((item) => {
    const td = el('td', 'bk-total');
    td.dataset.item = item;
    countRow.append(td);
    return td;
  });
  const bars = ITEMS.map((item) => {
    const td = el('td', 'bk-bar-cell');
    td.dataset.item = item;
    const track = el('div', 'bk-bar-track');
    const bar = el('div', 'bk-bar');
    bar.dataset.item = item;
    const label = el('span', 'bk-bar-label');
    track.append(bar);
    td.append(track, label);
    barRow.append(td);
    return { bar, label };
  });

  host.append(list, table);

  table.setAttribute('role', 'grid');
  const cellOf = (e: Event): HTMLTableCellElement | null => (e.target as Element).closest<HTMLTableCellElement>('td.bk-cell');
  const focusCell = (r: number, c: number): void => {
    const to = cells[Math.max(0, Math.min(rowCount - 1, r))]?.[Math.max(0, Math.min(ITEMS.length - 1, c))];
    if (!to) return;
    for (const row of cells) for (const td of row) td.tabIndex = td === to ? 0 : -1;
    to.focus();
  };
  table.addEventListener('click', (e) => {
    const td = cellOf(e);
    if (td) onToggle(Number(td.dataset.row), Number(td.dataset.col));
  });
  table.addEventListener('focusin', (e) => {
    const td = cellOf(e);
    if (td) for (const row of cells) for (const t of row) t.tabIndex = t === td ? 0 : -1;
  });
  table.addEventListener('keydown', (e) => {
    const td = cellOf(e);
    if (!td) return;
    const r = Number(td.dataset.row);
    const c = Number(td.dataset.col);
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    // the page's step keys (arrows, Space) must not also fire while a cell is focused
    if (e.key in move) {
      e.preventDefault();
      e.stopPropagation();
      focusCell(r + move[e.key][0], c + move[e.key][1]);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onToggle(r, c);
    }
  });

  return {
    list,
    table,
    update(spec: TableSpec): void {
      const { tx, cols, rows } = spec;
      for (let r = 0; r < rowCount; r++) {
        const line = r < tx.length ? basketLine(tx, r) : '';
        if (lines[r].textContent !== line) lines[r].textContent = line;
        const f = rows[r];
        const tr = trs[r];
        tr.dataset.x = String(f.x);
        tr.dataset.y = String(f.y);
        tr.dataset.match = String(f.match);
        tr.dataset.dim = String(f.dim);
        ITEMS.forEach((item, c) => {
          const td = cells[r][c];
          const on = r < tx.length && tx[r].includes(item);
          td.dataset.on = String(on);
          const role = cols.get(item);
          if (role) td.dataset.hl = role;
          else delete td.dataset.hl;
          const glyph = on ? '●' : '';
          if (td.textContent !== glyph) td.textContent = glyph;
          td.setAttribute('aria-label', `Fiş ${r + 1}, ${itemName(item)}: ${on ? 'var' : 'yok'}`);
          td.setAttribute('aria-selected', String(on));
        });
      }
      ITEMS.forEach((item, c) => {
        const role = cols.get(item);
        for (const e of [heads[c], countCells[c], bars[c].bar.parentElement as HTMLElement]) {
          if (role) e.dataset.hl = role;
          else delete e.dataset.hl;
        }
        tags[c].textContent = spec.tags && role ? role.toUpperCase() : '';
        const total = tx.filter((b) => b.includes(item)).length;
        countCells[c].textContent = String(total);
        countCells[c].dataset.total = String(total);
        const s = tx.length === 0 ? 0 : total / tx.length;
        bars[c].bar.style.width = `${(s * 100).toFixed(1)}%`;
        bars[c].bar.dataset.support = String(s);
        bars[c].label.textContent = ratioText(s);
      });
      table.dataset.bars = String(spec.bars);
    },
  };
}
