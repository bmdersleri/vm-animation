import { select } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { tr } from '../../core/plot/transition';
import type { Cell, IqrView } from './view';

/** Transition name of the cell moves (interrupted on every update). */
const T = 'iqr-cards';
/** Longest sort move, before `durationScale`. */
export const SORT_MS = 600;
const GAP = 8;
const MAX_W = 150;

const setText = (el: HTMLElement, t: string): void => {
  if (el.textContent !== t) el.textContent = t;
};

interface CellEls { el: HTMLElement; value: HTMLElement; mark: HTMLElement | null; flag: HTMLElement | null; rank: HTMLElement | null }

/**
 * The eight bill cards: an absolutely positioned HTML layer. Each cell is one
 * node whose `transform` moves it between slots (sorting is a transition of
 * that node), so a card keeps its identity while it sorts, fills or fades.
 * Ranks hang under their cell; the quantile position marker sits between the
 * centres of the two cells whose ranks bracket the position.
 */
export class CardsLayer {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly markerLabel: HTMLElement;
  private cells = new Map<string, CellEls>();
  private view: IqrView | null = null;
  private w = 1200;

  constructor(host: HTMLElement) {
    this.doc = host.ownerDocument;
    this.root = this.el('div', 'iqr-cards');
    this.marker = this.el('div', 'pos-mark');
    this.markerLabel = this.el('span', 'pos-label');
    this.marker.append(this.markerLabel);
    this.marker.hidden = true;
    this.root.append(this.marker);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.interrupt();
    this.w = w;
    this.root.dataset.mode = mode;
    if (this.view) this.layout(this.view, 0);
  }

  /** Renders `v`; `ms` (already scaled) animates the sort, 0 jumps. */
  update(v: IqrView, ms: number): void {
    this.interrupt();
    const keys = v.cells.map((c) => c.key).sort().join('|');
    if (keys !== [...this.cells.keys()].sort().join('|')) this.build(v.cells);
    this.view = v;
    for (const c of v.cells) this.fill(this.cells.get(c.key)!, c, v);
    this.layout(v, Math.min(ms, SORT_MS));
  }

  interrupt(): void {
    select(this.root).selectAll('.cell').interrupt(T);
    select(this.marker).interrupt(T);
    // snap to the final state so no half-moved cell is left behind
    if (this.view) this.layout(this.view, 0);
  }

  destroy(): void {
    select(this.root).selectAll('.cell').interrupt(T);
    select(this.marker).interrupt(T);
    this.root.remove();
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
    const e = this.doc.createElement(tag);
    e.className = cls;
    return e;
  }

  private build(cells: readonly Cell[]): void {
    for (const c of this.cells.values()) c.el.remove();
    this.cells = new Map();
    for (const c of cells) {
      const el = this.el('div', 'cell');
      el.dataset.key = c.key;
      const value = this.el('span', 'cell-value');
      el.append(value);
      this.root.append(el);
      this.cells.set(c.key, { el, value, mark: null, flag: null, rank: null });
    }
  }

  private fill(e: CellEls, c: Cell, v: IqrView): void {
    const cls = ['cell'];
    if (c.empty) cls.push('empty');
    if (c.filled) cls.push('filled');
    if (c.highlight) cls.push(v.part === 1 ? 'mid' : 'pair');
    if (c.outlier) cls.push('outlier');
    if (c.deleted) cls.push('deleted');
    if (c.clipped) cls.push('clipped');
    e.el.className = cls.join(' ');
    e.el.dataset.slot = String(c.slot);
    setText(e.value, c.text);
    if (c.filled && !e.mark) {
      e.mark = this.el('span', 'cell-mark');
      e.mark.textContent = '◆';
      e.el.prepend(e.mark);
    } else if (!c.filled && e.mark) {
      e.mark.remove();
      e.mark = null;
    }
    if (c.outlier && !e.flag) {
      e.flag = this.el('span', 'cell-flag');
      e.flag.textContent = '▲ aykırı';
      e.el.append(e.flag);
    } else if (!c.outlier && e.flag) {
      e.flag.remove();
      e.flag = null;
    }
    const rankText = v.ranks && c.rank !== null ? String(c.rank) : null;
    if (rankText !== null) {
      if (!e.rank) {
        e.rank = this.el('span', 'rank');
        e.el.append(e.rank);
      }
      setText(e.rank, rankText);
    } else if (e.rank) {
      e.rank.remove();
      e.rank = null;
    }
  }

  private cellW(): number {
    return Math.min(MAX_W, (this.w - GAP * 7) / 8);
  }

  private layout(v: IqrView, ms: number): void {
    const w = this.cellW();
    const left = (slot: number): number => slot * (w + GAP);
    for (const c of v.cells) {
      const e = this.cells.get(c.key);
      if (!e) continue;
      const x = left(c.slot);
      e.el.dataset.x = String(x);
      e.el.dataset.w = String(w);
      e.el.style.width = `${w}px`;
      tr(select(e.el), T, ms).style('transform', `translate(${x}px, 0px)`);
    }
    this.placeMarker(v, w, left, ms);
  }

  private placeMarker(v: IqrView, w: number, left: (s: number) => number, ms: number): void {
    const pm = v.posMark;
    this.marker.hidden = pm === null;
    if (!pm) return;
    // centre of the cell holding rank r (ranks skip deleted cells)
    const centre = (r: number): number => {
      const c = v.cells.find((k) => k.rank === r) ?? v.cells.find((k) => k.slot === r);
      return left(c ? c.slot : r) + w / 2;
    };
    const lo = Math.floor(pm.pos);
    const hi = Math.min(lo + 1, v.cells.length - 1);
    const x = centre(lo) + (pm.pos - lo) * (centre(hi) - centre(lo));
    this.marker.dataset.x = String(x);
    setText(this.markerLabel, pm.label);
    tr(select(this.marker), T, ms).style('transform', `translate(${x}px, 0px)`);
  }
}
