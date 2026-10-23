import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { formatNumber as f3 } from '../../core/plot/format';
import { MARK, r1, trianglePath } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import type { OobRow, OobView, RfView } from './view';

const NS = 'http://www.w3.org/2000/svg';
const PAD = 8;
/** Row height (x tick font) the legend may cost; below it the legend is dropped and the rows may shrink to MIN_ROW. */
const LEGEND_ROW = 1.15;
/** Smallest row height as a multiple of the tick font (a digit is about 0.75 em tall). */
const MIN_ROW = 0.9;

type Cell = { row: OobRow; tree: number; count: number; vote: 0 | 1 | null };

/** A class mark: turquoise circle for Kaldı (0), orange triangle for Ayrıldı (1). */
function mark(parent: Selection<SVGGElement, any, any, any>, cls: string, y: 0 | 1, r: number, x: number, yy: number): void {
  const el = parent.append(y === 1 ? 'path' : 'circle').attr('class', `${cls} ${y === 1 ? 'ayrildi' : 'kaldi'}`);
  if (y === 1) {
    el.attr('d', trianglePath(r)).attr('transform', `translate(${r1(x)},${r1(yy)})`).attr('fill', MARK[1]);
  } else {
    el.attr('r', r1(r)).attr('cx', r1(x)).attr('cy', r1(yy)).attr('fill', MARK[0]);
  }
}

/**
 * OOB matrix scene (steps 5-6): 25 customer rows by the first 12 bootstrap trees. A filled cell is a tree that drew
 * the customer (the number = how often); a dashed empty cell is OOB and shows that tree's vote (● Kaldı, ▲ Ayrıldı).
 * The right columns give the customer's OOB majority and ✓ / ✗; step 6 writes the OOB score under the matrix.
 */
export class OobScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly headG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly rowsG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly footG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly host: HTMLElement;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  /** Called with the customer index when a row is chosen (click, Enter or Space). */
  onPick: ((index: number) => void) | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'rf-plot oob-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Dışarıda kalan ağaçların müşteri başına oyları: 25 müşteri, ilk 12 ağaç');
    this.headG = this.svg.append('g').attr('class', 'oob-head');
    this.rowsG = this.svg.append('g').attr('class', 'oob-rows');
    this.footG = this.svg.append('g').attr('class', 'oob-foot');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt();
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the matrix for `v.oob`. */
  update(v: RfView): void {
    const o = v.oob;
    if (!o) return;
    const f = this.measure.fonts(this.mode);
    const tick = f.tick;
    const lines = this.legendLines(o, tick);
    const scoreH = o.score ? f.axis * 1.3 : 0;
    // 25 rows must stay on screen: when the legend would squeeze the rows, the step text explains the cells instead
    const legendH = lines.length * tick * 1.4;
    const roomy = (this.h - PAD - legendH - scoreH - 8) / (o.rows.length + 1) >= tick * LEGEND_ROW;
    const legendLines = roomy ? lines : [];
    const footH = (roomy ? legendH : 0) + scoreH + 8;
    const rowH = Math.max(tick * MIN_ROW, Math.floor((this.h - footH - PAD) / (o.rows.length + 1)));
    const headH = rowH;
    const labelW = this.measure.width('24', 'tick', tick) + tick * 1.5 + 6;
    const verdictW = tick * 3.4;
    const gap = 6;
    const left = PAD + labelW;
    const cellW = Math.max(8, Math.floor((this.w - 2 * PAD - labelW - verdictW - gap) / o.cols));
    const right = left + cellW * o.cols;
    const total = PAD + headH + rowH * o.rows.length + footH;
    this.svg.attr('width', this.w).attr('height', Math.max(this.h, Math.ceil(total)));
    this.host.dataset.fit = total <= this.h + 1 ? '1' : '0';
    const r = Math.max(3, Math.min(cellW, rowH) * 0.28);
    const colX = (k: number): number => left + k * cellW;
    const rowY = (i: number): number => PAD + headH + i * rowH;

    // header: tree numbers, OOB column
    const heads = Array.from({ length: o.cols }, (_, k) => k);
    this.headG
      .selectAll<SVGTextElement, number>('text.tree-head')
      .data(heads)
      .join('text')
      .attr('class', 'tree-head tick')
      .attr('text-anchor', 'middle')
      .attr('x', (k) => r1(colX(k) + cellW / 2))
      .attr('y', r1(PAD + headH / 2))
      .attr('dy', '0.35em')
      .text((k) => String(k + 1));
    this.headG
      .selectAll<SVGTextElement, string>('text.col-head')
      .data(['no', 'OOB'])
      .join('text')
      .attr('class', 'col-head tick')
      .attr('text-anchor', (_, i) => (i === 0 ? 'start' : 'middle'))
      .attr('x', (_, i) => r1(i === 0 ? PAD : right + gap + verdictW / 2))
      .attr('y', r1(PAD + headH / 2))
      .attr('dy', '0.35em')
      .text((d) => d);

    const self = this;
    const rows = this.rowsG
      .selectAll<SVGGElement, OobRow>('g.oob-row')
      .data(o.rows, (d) => d.index)
      .join((enter) => {
        const g = enter.append('g').attr('tabindex', 0).attr('role', 'button');
        g.append('rect').attr('class', 'row-bg');
        g.append('text').attr('class', 'row-no tick');
        g.append('g').attr('class', 'row-class');
        g.append('g').attr('class', 'row-cells');
        g.append('text').attr('class', 'verdict tick').attr('text-anchor', 'middle');
        g.append('g').attr('class', 'verdict-g');
        g.on('click', function (_, d) {
          self.onPick?.(d.index);
        });
        g.on('keydown', function (e: KeyboardEvent, d) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            self.onPick?.(d.index);
          }
        });
        return g;
      })
      .attr('class', (d) => `oob-row ${d.outcome}${d.index === o.pick ? ' picked' : ''}`)
      .attr('data-row', (d) => d.index)
      .attr('aria-label', (d) => `Müşteri ${d.index}`)
      .attr('aria-pressed', (d) => (d.index === o.pick ? 'true' : 'false'));

    rows
      .select('rect.row-bg')
      .attr('x', PAD / 2)
      .attr('y', (d) => r1(rowY(d.index)))
      .attr('width', r1(right + gap + verdictW - PAD / 2 + 2))
      .attr('height', r1(rowH))
      .attr('rx', 4);
    rows
      .select('text.row-no')
      .attr('x', PAD)
      .attr('y', (d) => r1(rowY(d.index) + rowH / 2))
      .attr('dy', '0.35em')
      .text((d) => String(d.index));
    rows.select<SVGGElement>('g.row-class').each(function (d) {
      const g = select<SVGGElement, OobRow>(this);
      g.selectAll('*').remove();
      mark(g, 'class-mark', d.y, r, left - 8 - r, rowY(d.index) + rowH / 2);
    });

    rows.select<SVGGElement>('g.row-cells').each(function (d) {
      const cells: Cell[] = d.cells.map((c, tree) => ({ row: d, tree, count: c.count, vote: c.vote }));
      const g = select(this)
        .selectAll<SVGGElement, Cell>('g.oob-cell')
        .data(cells, (c) => c.tree)
        .join((enter) => {
          const e = enter.append('g');
          e.append('rect').attr('class', 'cell-box').attr('rx', 3);
          e.append('text').attr('class', 'cell-count tick').attr('text-anchor', 'middle');
          return e;
        })
        .attr('class', (c) => `oob-cell ${c.count === 0 ? 'oob' : 'seen'}`)
        .attr('data-row', (c) => c.row.index)
        .attr('data-tree', (c) => c.tree)
        .attr('data-vote', (c) => (c.vote === null ? null : c.vote));
      g.select('rect.cell-box')
        .attr('x', (c) => r1(colX(c.tree) + 1))
        .attr('y', (c) => r1(rowY(c.row.index) + 1))
        .attr('width', r1(cellW - 2))
        .attr('height', r1(rowH - 2));
      g.select('text.cell-count')
        .attr('x', (c) => r1(colX(c.tree) + cellW / 2))
        .attr('y', (c) => r1(rowY(c.row.index) + rowH / 2))
        .attr('dy', '0.35em')
        .text((c) => (c.count === 0 ? '' : String(c.count)));
      g.each(function (c) {
        const cell = select<SVGGElement, Cell>(this);
        cell.selectAll('.vote-mark').remove();
        if (c.vote !== null) {
          mark(cell, 'vote-mark', c.vote, r, colX(c.tree) + cellW / 2, rowY(c.row.index) + rowH / 2);
        }
      });
    });

    rows.select<SVGGElement>('g.verdict-g').each(function (d) {
      const g = select<SVGGElement, OobRow>(this);
      g.selectAll('*').remove();
      if (d.verdict !== null) {
        mark(g, 'verdict-mark', d.verdict, r, right + gap + r + 2, rowY(d.index) + rowH / 2);
      }
    });
    rows
      .select('text.verdict')
      .attr('x', r1(right + gap + verdictW - tick * 0.9))
      .attr('y', (d) => r1(rowY(d.index) + rowH / 2))
      .attr('dy', '0.35em')
      .text((d) => (d.outcome === 'none' ? '–' : d.outcome === 'right' ? '✓' : '✗'));

    // footer: the score (step 6) and the legend
    let y = PAD + headH + rowH * o.rows.length + 6;
    const score = o.score ? `OOB skoru = ${o.score.correct} / ${o.score.total} = ${f3(o.score.correct / o.score.total, 3)}` : null;
    if (score) y += f.axis * 0.95;
    this.footG
      .selectAll<SVGTextElement, string>('text.oob-score')
      .data(score ? [score] : [])
      .join('text')
      .attr('class', 'oob-score axis-title')
      .attr('x', PAD)
      .attr('y', r1(y))
      .text((d) => d);
    if (score) y += f.axis * 0.35;
    this.footG
      .selectAll<SVGTextElement, string>('text.oob-legend')
      .data(legendLines)
      .join('text')
      .attr('class', 'oob-legend tick')
      .attr('x', PAD)
      .attr('y', (_, i) => r1(y + tick * 1.1 + i * tick * 1.4))
      .text((d) => d);
  }

  /** The legend sentence wrapped to the width of the scene. */
  private legendLines(o: OobView, tick: number): string[] {
    const text = `${o.cols} ağaç sütunu · dolu hücre: ağaç müşteriyi gördü (sayı = tekrar) · kesikli hücre: OOB, ağaç oy verir (● Kaldı, ▲ Ayrıldı) · sağda ${o.m} ağacın OOB çoğunluğu ve ✓ / ✗`;
    return this.measure.wrap(text, this.w - 2 * PAD, 'tick', tick);
  }
}
