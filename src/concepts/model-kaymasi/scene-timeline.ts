import type { Mode } from '../../core/mode';
import type { TextMeasure } from '../../core/plot/text-measure';
import { r1 } from '../../core/plot/marks';
import { el, makeSvg, TALL_BUDGET, type G, type Svg, type ViewScene } from './scene-base';
import type { KaymaView } from './view';

const PAD = 8;
const REF_LABEL = 'referans: model burada eğitildi';
const WATCH_LABEL = 'izleme';
/** A phone-sized area puts the 24 months in two rows of twelve. */
const TWO_ROWS_BELOW = 640;

/**
 * Step 1: the 24 months as cells (`.month-cell[data-month]`, the first six `.is-ref`) under two bands: `.ref-band`
 * ("referans: model burada eğitildi", months 1-6) and `.watch-band` ("izleme", the rest). The svg takes the whole
 * area; a narrow area wraps the months into two rows of twelve.
 */
export class TimelineScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Svg;
  private readonly g: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'timeline-scene');
    const { svg, measure } = makeSvg(doc, 'timeline', 'Zaman şeridi: referans ayları ve izleme ayları');
    this.svg = svg;
    this.measure = measure;
    this.g = svg.append('g').attr('class', 'timeline-g');
    this.root.append(svg.node()!);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(tall ? Math.min(h, TALL_BUDGET * 0.6) : h));
    this.mode = mode;
  }

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: KaymaView): void {
    const t = v.timeline;
    if (!t) {
      return;
    }
    const fs = this.measure.fonts(this.mode).tick;
    const lh = fs * 1.25;
    const rows = this.w < TWO_ROWS_BELOW ? 2 : 1;
    const perRow = Math.ceil(t.months / rows);
    const cw = (this.w - 2 * PAD) / perRow;
    // one row: tall cells that use the area (a wide stage is mostly empty otherwise); two rows: as tall as the width allows
    const ch = rows === 1
      ? Math.max(fs * 2.2, Math.min(this.h * 0.28, cw * 1.7, fs * 7))
      : Math.max(fs * 2.2, Math.min(fs * 3.6, cw * 1.1));
    // the longest band label decides the label block: wrapped to the band's width, one line when it fits
    const refW = Math.min(perRow, t.refMonths) * cw - 12;
    const refLines = this.measure.wrap(REF_LABEL, refW, 'tick', fs);
    const labelH = refLines.length * lh + 8;
    const block = labelH + ch + 12;
    const gapY = fs;
    const total = rows * block + (rows - 1) * gapY;
    const top = Math.max(PAD, (this.h - total) / 2);
    this.svg.attr('width', this.w).attr('height', this.h);
    this.g.selectAll('*').remove();
    for (let row = 0; row < rows; row += 1) {
      const from = row * perRow + 1;
      const to = Math.min(t.months, from + perRow - 1);
      const y0 = top + row * (block + gapY);
      const xOf = (m: number): number => PAD + (m - from) * cw;
      const bands: { cls: string; label: string; lines: string[]; a: number; b: number }[] = [];
      if (from <= t.refMonths) {
        bands.push({ cls: 'ref', label: REF_LABEL, lines: refLines, a: from, b: Math.min(to, t.refMonths) });
      }
      if (to > t.refMonths) {
        bands.push({ cls: 'watch', label: WATCH_LABEL, lines: [WATCH_LABEL], a: Math.max(from, t.refMonths + 1), b: to });
      }
      for (const band of bands) {
        const x = xOf(band.a);
        const wBand = xOf(band.b + 1) - x;
        this.g.append('rect')
          .attr('class', `${band.cls}-band`)
          .attr('x', r1(x + 1))
          .attr('y', r1(y0))
          .attr('width', r1(wBand - 2))
          .attr('height', r1(block))
          .attr('rx', 8);
        const text = this.g.append('text')
          .attr('class', `${band.cls}-band-label tick`)
          .attr('text-anchor', 'middle');
        band.lines.forEach((line, i) => {
          text.append('tspan')
            .attr('x', r1(x + wBand / 2))
            .attr('y', r1(y0 + 6 + lh * (i + 0.8)))
            .text(line);
        });
      }
      for (let m = from; m <= to; m += 1) {
        this.g.append('rect')
          .attr('class', `month-cell ${m <= t.refMonths ? 'is-ref' : 'is-watch'}`)
          .attr('data-month', m)
          .attr('x', r1(xOf(m) + 2))
          .attr('y', r1(y0 + labelH + 4))
          .attr('width', r1(cw - 4))
          .attr('height', r1(ch))
          .attr('rx', 5);
        this.g.append('text')
          .attr('class', 'month-no tick')
          .attr('text-anchor', 'middle')
          .attr('x', r1(xOf(m) + cw / 2))
          .attr('y', r1(y0 + labelH + 4 + ch / 2))
          .attr('dy', '0.35em')
          .text(m);
      }
    }
  }
}
