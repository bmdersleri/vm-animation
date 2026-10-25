import type { Selection } from 'd3-selection';
import type { Confusion } from '../../concepts/degerlendirme/metrics';
import { r1 } from './marks';
import type { TextMeasure } from './text-measure';
import { tr } from './transition';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** The four cells in reading order (row = actual class, column = predicted class). */
export type CellKey = 'tn' | 'fp' | 'fn' | 'tp';

/** Order and short Turkish tag of the cells. */
export const CELLS: readonly { key: CellKey; tag: string }[] = [
  { key: 'tn', tag: 'doğru kalan' },
  { key: 'fp', tag: 'yanlış alarm' },
  { key: 'fn', tag: 'kaçırılan' },
  { key: 'tp', tag: 'yakalanan' },
];

/** Class names the matrix writes on its axes. */
export const CLASS_NAMES: readonly [string, string] = ['kalan', 'ayrılan'];

/** Where and how large one draw call puts the matrix. */
export interface MatrixOptions {
  rect: { x: number; y: number; w: number; h: number };
  /** Tick and axis font sizes in px. */
  tick: number;
  axis: number;
  /** When true the actual-churner row (fn, tp) is emphasised. */
  focusPositive: boolean;
  ms: number;
  /** Drops the "tahmin" / "gerçek" titles and their room (a stack of matrices explains them once). */
  compact?: boolean;
  /** Axis class names and cell tags of another task (default: the churn wording above). */
  names?: readonly [string, string];
  tags?: Readonly<Record<CellKey, string>>;
}

/** Height (px) the matrix needs for a given tick size and cell height. */
export function matrixHeight(tick: number, cellH: number, compact = false): number {
  return tick * (compact ? 1.7 : 3.1) + cellH * 2;
}

/**
 * The small 2x2 confusion matrix shared by the imbalance and text-mining pages: predicted class across,
 * actual class down, class names "kalan" / "ayrılan", every cell a `g[data-cell]` with its tag and
 * count. Cells are drawn once and updated in place.
 */
export class MatrixLayer {
  constructor(
    private readonly g: G,
    private readonly measure: TextMeasure,
  ) {
    g.append('text').attr('class', 'matrix-title axis-title').attr('text-anchor', 'middle');
    g.append('text').attr('class', 'matrix-row-title axis-title').attr('text-anchor', 'end');
    for (let i = 0; i < 2; i++) {
      g.append('text').attr('class', 'matrix-col-name').attr('data-class', i).attr('text-anchor', 'middle');
      g.append('text').attr('class', 'matrix-row-name').attr('data-class', i).attr('text-anchor', 'end');
    }
    for (const c of CELLS) {
      const cell = g.append('g').attr('class', `matrix-cell ${c.key}`).attr('data-cell', c.key);
      cell.append('rect').attr('class', 'cell-bg').attr('rx', 6);
      cell.append('text').attr('class', 'cell-tag');
      cell.append('text').attr('class', 'cell-count').attr('text-anchor', 'middle');
    }
  }

  /** Draws `matrix` into `o.rect`; the count text changes at once, the fill fades over `o.ms`. */
  draw(matrix: Confusion, o: MatrixOptions): void {
    const { rect, tick, axis } = o;
    const gap = Math.round(tick * 0.4);
    const names = o.names ?? CLASS_NAMES;
    const tagOf = (key: CellKey, fallback: string): string => o.tags?.[key] ?? fallback;
    const nameW = this.measure.maxWidth([...names], 'tick', tick) + gap;
    const head = tick * (o.compact ? 1.7 : 3.1);
    const cellW = Math.max(40, (rect.w - nameW) / 2);
    const cellH = Math.max(tick * 1.6, (rect.h - head) / 2);
    const x0 = rect.x + nameW;
    const y0 = rect.y + head;
    this.g
      .select('text.matrix-title')
      .attr('x', r1(x0 + cellW))
      .attr('y', r1(rect.y + axis))
      .text(o.compact ? '' : 'tahmin');
    this.g
      .select('text.matrix-row-title')
      .attr('x', r1(x0 - gap))
      .attr('y', r1(rect.y + head - tick * 0.5))
      .text(o.compact ? '' : 'gerçek');
    this.g.selectAll<SVGTextElement, unknown>('text.matrix-col-name').each(function () {
      const i = Number(this.getAttribute('data-class'));
      this.setAttribute('x', String(r1(x0 + cellW * (i + 0.5))));
      this.setAttribute('y', String(r1(rect.y + head - tick * 0.5)));
      this.textContent = names[i];
    });
    this.g.selectAll<SVGTextElement, unknown>('text.matrix-row-name').each(function () {
      const i = Number(this.getAttribute('data-class'));
      this.setAttribute('x', String(r1(x0 - gap)));
      this.setAttribute('y', String(r1(y0 + cellH * (i + 0.5))));
      this.setAttribute('dy', '0.35em');
      this.textContent = names[i];
    });
    CELLS.forEach((c, n) => {
      const col = n % 2;
      const row = Math.floor(n / 2);
      const cell = this.g.select<SVGGElement>(`g[data-cell="${c.key}"]`);
      cell.classed('is-focus', o.focusPositive && row === 1);
      const bg = cell
        .select('rect.cell-bg')
        .attr('x', r1(x0 + col * cellW + 2))
        .attr('y', r1(y0 + row * cellH + 2))
        .attr('width', r1(cellW - 4))
        .attr('height', r1(cellH - 4));
      tr(bg, 'cellbg', o.ms);
      // a short cell writes tag and count on one baseline, a tall one stacks them
      const stacked = cellH >= tick * 2.3;
      const mid = y0 + row * cellH + cellH / 2;
      // on one line the tag gives way to the count when the cell is too narrow for both
      const countW = this.measure.width(String(matrix[c.key]), 'cell-count', axis);
      const tag = tagOf(c.key, c.tag);
      const tagW = this.measure.width(tag, 'cell-tag', tick);
      const showTag = stacked || (tagW + countW) * 1.15 + 24 <= cellW;
      cell
        .select('text.cell-tag')
        .attr('x', r1(x0 + col * cellW + 8))
        .attr('y', r1(stacked ? y0 + row * cellH + tick * 1.15 : mid))
        .attr('dy', stacked ? null : '0.35em')
        .text(showTag ? tag : '');
      cell
        .select('text.cell-count')
        .attr('text-anchor', stacked ? 'middle' : 'end')
        .attr('x', r1(stacked ? x0 + col * cellW + cellW / 2 : x0 + (col + 1) * cellW - 8))
        .attr('y', r1(stacked ? y0 + row * cellH + cellH - tick * 0.45 : mid))
        .attr('dy', stacked ? null : '0.35em')
        .text(String(matrix[c.key]));
    });
  }
}
