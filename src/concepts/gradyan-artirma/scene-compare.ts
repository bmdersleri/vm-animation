import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { sub } from './scenario';
import type { CompareRow, CompareView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;
type Scheme = CompareView['schemes'][number];

/** Outer padding (px) around the drawing. */
const PAD = 10;
/** Trees per scheme row (a picture, not data). */
const TREES = 4;
/** Least height (px) of the boxes-and-arrows drawing of one scheme row. */
const MIN_DRAWING = 84;

/**
 * Comparison scene (Ders step 10): a two-row scheme (bagging: parallel deep trees into one average;
 * boosting: a chain of shallow trees), four rows of the book's table and the closing links.
 * The table is three columns when it fits and stacked lines on a narrow screen.
 */
export class CompareScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly schemeG: G;
  private readonly tableG: G;
  private readonly linkG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'gb-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Bagging ve boosting karşılaştırması: paralel derin ağaçlar ve sığ ağaç zinciri');
    this.schemeG = this.svg.append('g').attr('class', 'cmp-schemes');
    this.tableG = this.svg.append('g').attr('class', 'cmp-table');
    this.linkG = this.svg.append('g').attr('class', 'cmp-links');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  destroy(): void {
    this.svg.remove();
  }

  update(v: CompareView): void {
    const { tick, axis } = this.measure.fonts(this.mode);
    const line = Math.max(tick, axis) * 1.4;
    const linkRow = tick * 1.7;
    const linksH = linkRow * v.links.length + PAD;
    const table = this.layoutTable(v.rows, tick, axis, line);
    // every scheme row needs its header and a minimum drawing; the content may outgrow the stage (it scrolls)
    const need = Math.max(...v.schemes.map((s) => this.schemeHead(s, tick, axis).headH)) + MIN_DRAWING + PAD * 0.8;
    const spare = (this.h - linksH - table.height - PAD) / v.schemes.length;
    const rowH = Math.max(need, spare);
    const schemesH = rowH * v.schemes.length;
    const total = schemesH + PAD + table.height + linksH;
    this.svg.attr('height', Math.ceil(Math.max(this.h, total)));
    this.drawSchemes(v.schemes, rowH, tick, axis);
    this.drawTable(table, tick, schemesH + PAD * 0.5, line);
    this.drawLinks(v.links, total - linksH + linkRow * 0.8, linkRow, axis);
  }

  /** Title and note lines of a scheme row, with the height they take. */
  private schemeHead(s: Scheme, tick: number, axis: number): { lines: string[]; stacked: boolean; headH: number } {
    const titleW = this.measure.width(s.title, 'axis-title', axis);
    const beside = this.measure.wrap(s.note, this.w - PAD * 2 - titleW - 12, 'tick', tick);
    // the note shares the title's line when it fits there; else it wraps under the title
    const stacked = beside.length > 1;
    const lines = stacked ? this.measure.wrap(s.note, this.w - PAD * 2, 'tick', tick) : beside;
    return { lines, stacked, headH: axis * 1.1 + (stacked ? lines.length * tick * 1.35 : 0) + tick * 0.6 };
  }

  /** Column positions (wide) or stacked lines (narrow) of the table, with its total height. */
  private layoutTable(rows: CompareRow[], tick: number, axis: number, line: number) {
    const m = (texts: string[]): number => this.measure.maxWidth(texts, 'tick', tick);
    // labels and heads are drawn bold at the axis size
    const labW = Math.max(this.measure.maxWidth(rows.map((r) => r.label), 'axis-title', axis), this.measure.width('Özellik', 'axis-title', axis));
    const bagW = Math.max(m(rows.map((r) => r.bagging)), this.measure.width('Bagging', 'axis-title', axis));
    const booW = Math.max(m(rows.map((r) => r.boosting)), this.measure.width('Boosting', 'axis-title', axis));
    const gapX = 20;
    const wide = PAD * 2 + labW + bagW + booW + gapX * 2 <= this.w;
    if (wide) {
      const x = [PAD, PAD + labW + gapX, PAD + labW + bagW + gapX * 2];
      return { wide, x, rows, lines: rows.map(() => [] as string[]), height: line * (rows.length + 1) + PAD };
    }
    // narrow: the label on one line, the two values on the next (or on two lines if they do not fit)
    const lines = rows.map((r) => {
      const joined = `${r.bagging} | ${r.boosting}`;
      return this.measure.width(joined, 'tick', tick) <= this.w - PAD * 2
        ? [joined]
        : [`Bagging: ${r.bagging}`, `Boosting: ${r.boosting}`];
    });
    const count = 1 + lines.reduce((n, l) => n + 1 + l.length, 0);
    return { wide, x: [PAD], rows, lines, height: line * count + PAD };
  }

  private drawSchemes(schemes: Scheme[], rowH: number, tick: number, axis: number): void {
    const g = this.schemeG
      .selectAll<SVGGElement, Scheme>('g.cmp-scheme')
      .data(schemes, (d) => d.id)
      .join('g')
      .attr('class', 'cmp-scheme')
      .attr('data-row', (d) => d.id);
    const self = this;
    g.each(function (d, i) {
      self.drawScheme(select(this), d, i * rowH, rowH, tick, axis);
    });
  }

  /** One scheme row: title and note on top, boxes and arrows below. */
  private drawScheme(g: G, s: Scheme, top: number, rowH: number, tick: number, axis: number): void {
    g.selectAll('*').remove();
    const { lines, stacked, headH } = this.schemeHead(s, tick, axis);
    g.append('text')
      .attr('class', 'cmp-title')
      .attr('x', PAD)
      .attr('y', r1(top + axis * 1.1))
      .text(s.title);
    const titleW = this.measure.width(s.title, 'axis-title', axis);
    lines.forEach((t, k) => {
      g.append('text')
        .attr('class', 'cmp-note')
        .attr('x', r1(stacked ? PAD : PAD + titleW + 12))
        .attr('y', r1(top + axis * 1.1 + (stacked ? (k + 1) * tick * 1.35 : 0)))
        .text(t);
    });
    const gTop = top + headH;
    const gH = rowH - headH - PAD * 0.8;
    const bagging = s.id === 'bagging';
    const outW = this.measure.width(s.out, 'tick', tick) + 18;
    const avail = this.w - PAD * 2;
    const bw = Math.max(24, Math.min(80, (avail - outW) / (TREES * 2.2)));
    const gapX = Math.max(14, Math.min(140, (avail - outW - TREES * bw) / TREES));
    const xs = Array.from({ length: TREES }, (_, k) => PAD + k * (bw + gapX));
    const arrow = (x1: number, y1: number, x2: number, y2: number): void => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const head = (da: number): string => `${r1(x2 - 8 * Math.cos(a + da))},${r1(y2 - 8 * Math.sin(a + da))}`;
      g.append('path')
        .attr('class', 'cmp-arrow')
        .attr('fill', 'none')
        .attr('d', `M${r1(x1)},${r1(y1)}L${r1(x2)},${r1(y2)}M${head(0.45)}L${r1(x2)},${r1(y2)}L${head(-0.45)}`);
    };
    const box = (x: number, y: number, w: number, h: number, cls: string, label: string): void => {
      g.append('rect')
        .attr('class', `cmp-box ${cls}`)
        .attr('x', r1(x))
        .attr('y', r1(y))
        .attr('width', r1(w))
        .attr('height', r1(h))
        .attr('rx', 6);
      g.append('text')
        .attr('class', 'cmp-box-label')
        .attr('text-anchor', 'middle')
        .attr('x', r1(x + w / 2))
        .attr('y', r1(y + h / 2 + tick * 0.35))
        .text(label);
    };
    if (bagging) {
      // parallel deep (tall) trees, each feeding one average under them
      const boxH = gH * 0.5;
      const outH = Math.min(gH * 0.28, tick * 2.2);
      const groupW = xs[TREES - 1] + bw - PAD;
      const outX = PAD + groupW / 2 - outW / 2;
      const outY = gTop + gH - outH;
      xs.forEach((x, k) => {
        box(x, gTop, bw, boxH, 'tree', `T${sub(k + 1)}`);
        arrow(x + bw / 2, gTop + boxH, outX + outW * ((k + 0.5) / TREES), outY);
      });
      box(outX, outY, outW, outH, 'out', s.out);
      return;
    }
    // a chain of shallow (short) trees, each fitted to the one before, ending in F
    const boxH = gH * 0.3;
    const midY = gTop + gH / 2;
    xs.forEach((x, k) => {
      box(x, midY - boxH / 2, bw, boxH, 'tree', `h${sub(k + 1)}`);
      const next = k + 1 < TREES ? xs[k + 1] : xs[TREES - 1] + bw + gapX;
      arrow(x + bw, midY, next, midY);
    });
    box(xs[TREES - 1] + bw + gapX, midY - boxH / 2, outW, boxH, 'out', s.out);
  }

  private drawTable(
    t: ReturnType<CompareScene['layoutTable']>,
    tick: number,
    top: number,
    line: number,
  ): void {
    this.tableG.selectAll('*').remove();
    if (t.wide) {
      const heads = ['Özellik', 'Bagging', 'Boosting'];
      heads.forEach((text, i) => {
        this.tableG.append('text').attr('class', 'cmp-head').attr('x', r1(t.x[i])).attr('y', r1(top + line * 0.8)).text(text);
      });
    }
    if (!t.wide && t.lines.every((l) => l.length === 1)) {
      this.tableG.append('text').attr('class', 'cmp-head').attr('x', r1(t.x[0])).attr('y', r1(top + line * 0.8)).text('Bagging | Boosting');
    }
    let y = top + line;
    for (const [i, r] of t.rows.entries()) {
      const row = this.tableG.append('g').attr('class', 'cmp-row');
      const label = row.append('text').attr('class', 'cmp-label').attr('x', r1(t.x[0]));
      label.attr('y', r1(y + line * 0.8)).text(r.label);
      if (t.wide) {
        row.append('text').attr('class', 'cmp-cell').attr('x', r1(t.x[1])).attr('y', r1(y + line * 0.8)).text(r.bagging);
        row.append('text').attr('class', 'cmp-cell').attr('x', r1(t.x[2])).attr('y', r1(y + line * 0.8)).text(r.boosting);
        y += line;
      } else {
        t.lines[i].forEach((text, k) => {
          row.append('text').attr('class', 'cmp-cell').attr('x', r1(t.x[0])).attr('y', r1(y + line * (k + 1.8))).text(text);
        });
        y += line * (1 + t.lines[i].length);
      }
    }
  }

  private drawLinks(links: CompareView['links'], top: number, row: number, axis: number): void {
    this.linkG.selectAll('*').remove();
    links.forEach((l, i) => {
      const a = this.linkG.append('a').attr('class', 'scene-link').attr('href', l.href).attr('aria-label', l.label);
      a.append('text')
        .attr('x', PAD)
        .attr('y', r1(top + row * i + axis * 0.1))
        .text(l.label);
    });
  }
}
