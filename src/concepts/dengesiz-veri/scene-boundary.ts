import type { Selection } from 'd3-selection';
import { labelArea, labelBox, overlap, type Box as LabelBox } from '../../core/plot/label-place';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { MatrixLayer } from '../dengesiz/matrix';
import { ScatterScene, type Box, type PlotFrame, type SideLike } from './scene-scatter';
import type { ViewScene } from './scene-smote';
import type { BoundaryView, ImbView, LineView, TableView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Outer padding (px) of the scatter area. */
const PAD = 8;

/** Column heads of the comparison table, in reading order. */
export const TABLE_HEADS: readonly { key: 'label' | 'caught' | 'falseAlarm' | 'precision' | 'recall' | 'ap'; text: string }[] = [
  { key: 'label', text: 'yöntem' },
  { key: 'caught', text: 'yakalanan' },
  { key: 'falseAlarm', text: 'yanlış alarm' },
  { key: 'precision', text: 'kesinlik' },
  { key: 'recall', text: 'duyarlılık' },
  { key: 'ap', text: 'PR-AUC' },
];

/** Spacing levels of the side panel: roomy cells, then short ones when the stage is short. */
const CELL_MAX = 2.2;
const CELL_MIN = 1.6;

/**
 * The side panel of step 9: the test part's title, one line saying how to read a matrix, and one
 * compact test matrix per method with a sample of the method's line style before its name.
 */
export class BoundarySide implements SideLike {
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly caption: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly items: { g: G; sample: Selection<SVGLineElement, unknown, null, undefined>; name: Selection<SVGTextElement, unknown, null, undefined>; matrix: MatrixLayer }[];

  constructor(
    g: G,
    private readonly measure: TextMeasure,
  ) {
    this.title = g.append('text').attr('class', 'sp-title axis-title');
    this.caption = g.append('text').attr('class', 'sp-caption');
    this.items = ['yok', 'smote', 'agirlik'].map((method) => {
      const item = g.append('g').attr('class', 'bs-item').attr('data-method', method);
      const sample = item.append('line').attr('class', 'bs-sample');
      const name = item.append('text').attr('class', 'bs-name');
      const matrix = new MatrixLayer(item.append('g').attr('class', 'bs-matrix'), measure);
      return { g: item, sample, name, matrix };
    });
  }

  private titleH(axis: number): number {
    return axis * 1.6;
  }

  private captionH(tick: number): number {
    return tick * 1.5;
  }

  private nameH(tick: number): number {
    return tick * 1.5;
  }

  private head(tick: number): number {
    return tick * 1.7;
  }

  heightFor(_v: ImbView, _w: number, tick: number, axis: number): number {
    return this.titleH(axis) + this.captionH(tick) + 3 * (this.nameH(tick) + this.head(tick) + 2 * tick * CELL_MAX);
  }

  minHeightFor(_v: ImbView, _w: number, tick: number, axis: number): number {
    return this.titleH(axis) + this.captionH(tick) + 3 * (this.nameH(tick) + this.head(tick) + 2 * tick * CELL_MIN);
  }

  draw(v: ImbView, o: { rect: Box; tick: number; axis: number; ms: number }): void {
    const { rect, tick, axis } = o;
    const b = v.boundary;
    this.title
      .attr('x', r1(rect.x + 4))
      .attr('y', r1(rect.y + axis))
      .text(v.counts.title);
    const captionY = rect.y + this.titleH(axis);
    this.caption
      .attr('x', r1(rect.x + 4))
      .attr('y', r1(captionY + tick * 0.4))
      .text('satır: gerçek sınıf · sütun: tahmin');
    const top = captionY + this.captionH(tick);
    const fixed = 3 * (this.nameH(tick) + this.head(tick));
    const cell = Math.max(tick * CELL_MIN, Math.min(tick * CELL_MAX, (rect.y + rect.h - top - fixed) / 6));
    const itemH = this.nameH(tick) + this.head(tick) + 2 * cell;
    this.items.forEach((item, i) => {
      const m = b?.matrices[i];
      item.g.attr('display', m ? null : 'none');
      if (!m || !b) {
        return;
      }
      const y = top + i * itemH;
      const selected = b.lines[i].selected;
      item.g.classed('is-selected', selected);
      item.sample
        .attr('x1', r1(rect.x + 4))
        .attr('x2', r1(rect.x + 4 + tick * 2.4))
        .attr('y1', r1(y + tick * 0.7))
        .attr('y2', r1(y + tick * 0.7));
      item.name
        .attr('x', r1(rect.x + 4 + tick * 3))
        .attr('y', r1(y + tick * 1.05))
        .text(m.label);
      item.matrix.draw(m.matrix, {
        rect: { x: rect.x, y: y + this.nameH(tick), w: Math.min(rect.w, tick * 22), h: this.head(tick) + 2 * cell },
        tick,
        axis,
        focusPositive: true,
        ms: o.ms,
        compact: true,
      });
    });
  }
}

/** The comparison table of step 10 (a real table: it wraps and scrolls instead of clipping), its sentence and links. */
export class CompareTable {
  private readonly root: HTMLElement;
  private readonly body: HTMLTableSectionElement;
  private readonly note: HTMLElement;
  private readonly links: HTMLElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'imb-compare';
    const table = doc.createElement('table');
    table.className = 'imb-table';
    const head = doc.createElement('thead');
    const hr = doc.createElement('tr');
    for (const h of TABLE_HEADS) {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = h.text;
      hr.append(th);
    }
    head.append(hr);
    this.body = doc.createElement('tbody');
    table.append(head, this.body);
    this.note = doc.createElement('p');
    this.note.className = 'imb-compare-note';
    this.links = doc.createElement('p');
    this.links.className = 'imb-links';
    this.root.append(table, this.note, this.links);
    this.root.hidden = true;
    host.append(this.root);
  }

  setShown(shown: boolean): void {
    this.root.hidden = !shown;
  }

  update(t: TableView): void {
    const doc = this.root.ownerDocument;
    this.body.replaceChildren(
      ...t.rows.map((r) => {
        const tr = doc.createElement('tr');
        tr.dataset.row = r.id;
        tr.classList.toggle('is-selection', r.selection);
        for (const h of TABLE_HEADS) {
          const td = doc.createElement('td');
          td.dataset.col = h.key;
          td.dataset.label = h.text;
          td.textContent = r[h.key];
          tr.append(td);
        }
        return tr;
      }),
    );
    this.note.textContent = t.note;
    this.links.replaceChildren(
      ...t.links.map((l) => {
        const a = doc.createElement('a');
        a.className = 'scene-link';
        a.href = l.href;
        a.textContent = l.label;
        a.setAttribute('aria-label', l.label);
        return a;
      }),
    );
  }

  destroy(): void {
    this.root.remove();
  }
}

/** The text of one outside note: the method's name and the sentence. */
const noteText = (l: LineView): string => `${l.label} · ${l.note}`;

/**
 * Steps 9-10: the test points with one decision-boundary line per method (clipped to the plot,
 * a note at the top edge when a line misses it) and the side panel of matrices; step 10 replaces the
 * drawing with the comparison table.
 */
export class BoundaryScene extends ScatterScene implements ViewScene {
  private readonly table: CompareTable;
  private readonly linesG: G;
  private readonly notesG: G;

  constructor(host: HTMLElement) {
    super(host, (g, m) => new BoundarySide(g, m));
    this.linesG = this.overG.append('g').attr('class', 'imb-lines');
    this.notesG = this.overG.append('g').attr('class', 'imb-notes');
    this.table = new CompareTable(host);
  }

  /** The wrapped note lines of a view at a scatter width. */
  private noteLines(b: BoundaryView | null, width: number, tick: number): string[][] {
    if (!b) {
      return [];
    }
    return b.lines.filter((l) => l.note).map((l) => this.measure.wrap(noteText(l), width - 2 * PAD, 'tick', tick));
  }

  protected override reserveTop(v: ImbView, width: number, tick: number): number {
    const lines = this.noteLines(v.boundary, width, tick).reduce((n, l) => n + l.length, 0);
    return lines ? lines * tick * 1.3 + tick * 0.5 : 0;
  }

  override update(v: ImbView, ms: number): void {
    const compare = v.table !== null;
    this.setShown(!compare);
    this.table.setShown(compare);
    if (v.table) {
      this.table.update(v.table);
    } else {
      super.update(v, ms);
    }
  }

  override destroy(): void {
    this.table.destroy();
    super.destroy();
  }

  protected override drawOver(v: ImbView, f: PlotFrame, scatter: Box): void {
    const b = v.boundary;
    const lines = b ? b.lines : [];
    const px = (t: number): number => r1(f.sc.x(t));
    const py = (c: number): number => r1(f.sc.y(c));
    this.linesG
      .selectAll<SVGLineElement, LineView>('line.boundary-line')
      .data(
        lines.filter((l) => l.segment),
        (d) => d.method,
      )
      .join('line')
      .attr('class', (d) => `boundary-line${d.selected ? ' is-selected' : ''}`)
      .attr('data-method', (d) => d.method)
      .attr('x1', (d) => px(d.segment!.x1))
      .attr('y1', (d) => py(d.segment!.y1))
      .attr('x2', (d) => px(d.segment!.x2))
      .attr('y2', (d) => py(d.segment!.y2));
    this.drawLineLabels(lines, f, px, py);
    this.drawNotes(b, scatter, f.tick);
  }

  /** The method names at the right ends of the lines, placed clear of the lines and each other. */
  private drawLineLabels(
    lines: LineView[],
    f: PlotFrame,
    px: (t: number) => number,
    py: (c: number) => number,
  ): void {
    const shown = lines.filter((l) => l.segment);
    // the lines are obstacles: boxes every ~3 px along each of them
    const taken: LabelBox[] = [];
    for (const l of shown) {
      const s = l.segment!;
      const len = Math.hypot(px(s.x2) - px(s.x1), py(s.y2) - py(s.y1));
      const n = Math.max(2, Math.ceil(len / 3));
      for (let t = 0; t <= n; t++) {
        const x = px(s.x1) + ((px(s.x2) - px(s.x1)) * t) / n;
        const y = py(s.y1) + ((py(s.y2) - py(s.y1)) * t) / n;
        taken.push({ l: x - 3, t: y - 3, r: x + 3, b: y + 3 });
      }
    }
    const area = labelArea(f.rect, 4);
    const outside = (b: LabelBox): number => (b.r - b.l) * (b.b - b.t) - overlap(b, area);
    const fs = f.tick;
    const placed = shown.map((l) => {
      const s = l.segment!;
      // walk from the right end inward; try both sides of the line at every stop
      const ends = [
        { x: px(s.x1), y: py(s.y1) },
        { x: px(s.x2), y: py(s.y2) },
      ].sort((a, b) => b.x - a.x);
      const [from, to] = ends;
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const dx = (to.x - from.x) / len;
      const dy = (to.y - from.y) / len;
      const nx = -dy;
      const ny = dx;
      const w = l.label.length * 0.7 * fs + 2;
      const h = 1.25 * fs + 2;
      const reach = Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2) + 5;
      let best: { x: number; y: number; hits: number; box: LabelBox } | null = null;
      for (let k = 0; k <= 30 && !(best && best.hits === 0); k++) {
        const u = (k / 30) * 0.9;
        for (const [side, far] of [[1, 1], [-1, 1], [1, 1.8], [-1, 1.8], [1, 2.8], [-1, 2.8]]) {
          const cx = from.x + dx * len * u + nx * reach * far * side;
          const cy = from.y + dy * len * u + ny * reach * far * side;
          const y = cy + 0.325 * fs;
          const box = labelBox(cx, y, l.label.length, 'middle', fs);
          const hits = taken.reduce((sum, t) => sum + overlap(box, t), 0) + outside(box);
          if (!best || hits < best.hits) {
            best = { x: cx, y, hits, box };
          }
        }
      }
      taken.push(best!.box);
      return { method: l.method, label: l.label, x: r1(best!.x), y: r1(best!.y), anchor: 'middle' as const, selected: l.selected };
    });
    this.linesG
      .selectAll<SVGTextElement, (typeof placed)[number]>('text.boundary-label')
      .data(placed, (d) => d.method)
      .join('text')
      .attr('class', (d) => `boundary-label${d.selected ? ' is-selected' : ''}`)
      .attr('data-method', (d) => d.method)
      .attr('data-chars', (d) => d.label.length)
      .attr('text-anchor', (d) => d.anchor)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .text((d) => d.label);
  }

  /** The "no line" notes in the strip reserved above the plot: one text per note, one tspan per wrapped line. */
  private drawNotes(b: BoundaryView | null, scatter: Box, tick: number): void {
    const wrapped = this.noteLines(b, scatter.w, tick);
    const rows: { method: string; lines: string[]; y: number }[] = [];
    let n = 0;
    (b?.lines ?? [])
      .filter((l) => l.note)
      .forEach((l, i) => {
        rows.push({ method: l.method, lines: wrapped[i], y: scatter.y + PAD + tick * 1.0 + n * tick * 1.3 });
        n += wrapped[i].length;
      });
    const x = r1(scatter.x + PAD + 4);
    this.notesG
      .selectAll<SVGTextElement, (typeof rows)[number]>('text.outside-note')
      .data(rows, (d) => d.method)
      .join('text')
      .attr('class', 'outside-note')
      .attr('data-method', (d) => d.method)
      .attr('x', x)
      .attr('y', (d) => r1(d.y))
      .each(function (d) {
        const text = this;
        text.replaceChildren(
          ...d.lines.map((line, i) => {
            const span = text.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            span.setAttribute('x', String(x));
            span.setAttribute('dy', i === 0 ? '0' : String(r1(tick * 1.3)));
            span.textContent = i < d.lines.length - 1 ? `${line} ` : line;
            return span;
          }),
        );
      });
  }
}
