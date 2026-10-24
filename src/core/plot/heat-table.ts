/** A white-to-colour scale: `hue` is the colour of the value `max`, white is zero. */
export interface HeatScale {
  name: string;
  hue: readonly [number, number, number];
}

/** Count tables (blue) and weight tables (orange) of the text-mining pages. */
export const BLUE_SCALE: HeatScale = { name: 'blue', hue: [31, 111, 178] };
export const ORANGE_SCALE: HeatScale = { name: 'orange', hue: [224, 123, 0] };

const INK = '#14365c';
const PAPER = '#ffffff';

/** Position of `value` on the scale: 0 to 1, clamped; a zero or invalid max gives 0. */
function share(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
}

function mix(scale: HeatScale, value: number, max: number): [number, number, number] {
  const t = share(value, max);
  return scale.hue.map((c) => 255 + (c - 255) * t) as [number, number, number];
}

/** CSS colour of a cell: white at 0, the scale's hue at `max`. */
export function heatFill(scale: HeatScale, value: number, max: number): string {
  const [r, g, b] = mix(scale, value, max);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Text colour for that fill: white on dark cells, navy on light ones (the number is the first channel, not the colour). */
export function heatInk(scale: HeatScale, value: number, max: number): string {
  const [r, g, b] = mix(scale, value, max);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55 ? PAPER : INK;
}

/** One cell: the value colours it, `text` is written in it; `state` greys it (`dim`) or empties it (`hidden`). */
export interface HeatCell {
  value: number;
  text: string;
  state?: 'dim' | 'hidden';
}

/** What a heat table shows: `cells[row][col]`, row and column names, the colour scale and the value that fills it. */
export interface HeatTableSpec {
  rows: string[];
  cols: string[];
  cells: HeatCell[][];
  scale: HeatScale;
  max: number;
  /** Row / column drawn with a frame (-1 or undefined: none). */
  focusRow?: number;
  focusCol?: number;
  /** Text of the top-left corner cell. */
  corner?: string;
}

/**
 * A colour-coded table (`table.heat-table` in a scrolling `div.heat-wrap`): rows are documents, columns terms.
 * Every cell is a `td.heat-cell[data-row][data-col]` holding its value text; cells keep their element when the
 * values change, so the page's CSS can fade the colours. Column names are set upright-rotated by the CSS.
 */
export class HeatTable {
  readonly el: HTMLDivElement;
  private readonly table: HTMLTableElement;
  private readonly head: HTMLTableRowElement;
  private readonly body: HTMLTableSectionElement;
  private readonly corner: HTMLTableCellElement;

  constructor(private readonly doc: Document) {
    this.el = doc.createElement('div');
    this.el.className = 'heat-wrap';
    this.table = doc.createElement('table');
    this.table.className = 'heat-table';
    const thead = doc.createElement('thead');
    this.head = doc.createElement('tr');
    this.corner = doc.createElement('th');
    this.corner.className = 'heat-corner';
    this.head.append(this.corner);
    thead.append(this.head);
    this.body = doc.createElement('tbody');
    this.table.append(thead, this.body);
    this.el.append(this.table);
  }

  update(spec: HeatTableSpec): void {
    this.corner.textContent = spec.corner ?? '';
    this.table.dataset.scale = spec.scale.name;
    this.table.dataset.cols = String(spec.cols.length);
    this.table.style.setProperty('--cols', String(spec.cols.length));
    this.fit(this.head, 1 + spec.cols.length, () => this.th('heat-col'));
    spec.cols.forEach((name, c) => {
      const th = this.head.children[c + 1] as HTMLTableCellElement;
      th.textContent = name;
      th.dataset.col = String(c);
      th.classList.toggle('is-focus', spec.focusCol === c);
    });
    while (this.body.children.length > spec.rows.length) this.body.lastElementChild!.remove();
    while (this.body.children.length < spec.rows.length) this.body.append(this.doc.createElement('tr'));
    spec.rows.forEach((name, r) => {
      const tr = this.body.children[r] as HTMLTableRowElement;
      tr.dataset.row = String(r);
      tr.classList.toggle('is-focus', spec.focusRow === r);
      this.fit(tr, 1 + spec.cols.length, (i) => (i === 0 ? this.th('heat-row') : this.td()));
      const rowHead = tr.children[0] as HTMLTableCellElement;
      rowHead.textContent = name;
      spec.cols.forEach((_, c) => {
        const cell = spec.cells[r]?.[c] ?? { value: 0, text: '' };
        const td = tr.children[c + 1] as HTMLTableCellElement;
        td.dataset.row = String(r);
        td.dataset.col = String(c);
        td.textContent = cell.state === 'hidden' ? '' : cell.text;
        const shown = cell.state !== 'hidden';
        // a hidden cell drops the inline colours so the page's CSS can grey it
        td.style.backgroundColor = shown ? heatFill(spec.scale, cell.value, spec.max) : '';
        td.style.color = shown ? heatInk(spec.scale, cell.value, spec.max) : '';
        td.classList.toggle('is-zero', shown && cell.value === 0);
        td.classList.toggle('is-dim', cell.state === 'dim');
        td.classList.toggle('is-hidden', !shown);
        td.classList.toggle('is-focus', spec.focusRow === r || spec.focusCol === c);
      });
    });
  }

  destroy(): void {
    this.el.remove();
  }

  private th(cls: string): HTMLTableCellElement {
    const th = this.doc.createElement('th');
    th.className = cls;
    return th;
  }

  private td(): HTMLTableCellElement {
    const td = this.doc.createElement('td');
    td.className = 'heat-cell';
    return td;
  }

  /** Makes row `tr` hold exactly `n` cells, creating them with `make(index)`. */
  private fit(tr: HTMLTableRowElement, n: number, make: (i: number) => HTMLTableCellElement): void {
    while (tr.children.length > n) tr.lastElementChild!.remove();
    while (tr.children.length < n) tr.append(make(tr.children.length));
  }
}
