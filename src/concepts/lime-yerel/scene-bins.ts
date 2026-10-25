import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { r1 } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NS, type ViewScene } from './scene-base';
import type { BinsRow, LimeView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Vertical padding (px) of the scene: top and bottom together. */
export const BINS_PAD_V = 8;

/** Horizontal room kept at both ends of a number line for the end labels. */
const EDGE = 20;

/**
 * Step 2: one number line per feature (`NumberLineLayer`) with the three training cuts (`g.bin-cut[data-feature]`,
 * the value written at each), the four bins as bands (`.bin-band`, the customer's one `.bin-active`, its
 * lime-style rule name above the line) and the customer's value as a dot (`.bin-value`). The domain of each line
 * comes from that feature's cuts and the customer's value.
 */
export class BinsScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly rows: { g: G; line: NumberLineLayer; bandG: G; cutG: G; markG: G; nameG: G }[];
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'bins-scene');
    const root = doc.createElementNS(NS, 'svg');
    this.root.append(root);
    this.svg = select(root).attr('class', 'bins-plot').attr('role', 'img').attr('aria-label', 'Kartil bölmeleri: her özellik için üç sınır, dört bölme');
    this.rows = [0, 1, 2].map((feature) => {
      const g = this.svg.append('g').attr('class', 'bins-row').attr('data-feature', feature);
      const bandG = g.append('g').attr('class', 'bin-bands');
      const line = new NumberLineLayer(g);
      const cutG = g.append('g').attr('class', 'bin-cuts');
      const markG = g.append('g').attr('class', 'bin-marks');
      const nameG = g.append('g').attr('class', 'bin-names');
      return { g, line, bandG, cutG, markG, nameG };
    });
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    if (!v.bins) {
      return;
    }
    const fs = this.measure.fonts(this.mode).tick;
    const width = Math.max(240, this.w - 24);
    const lh = fs * 1.25;
    // a roomy layout first; when the three rows do not fit the stage, the compact one (tighter gaps)
    const heightOf = (compact: boolean): number =>
      v.bins!.reduce((sum, row) => sum + this.rowLayout(row, fs, lh, width, compact).height + this.gap(fs, compact), BINS_PAD_V);
    const compact = heightOf(false) > this.h;
    let top = BINS_PAD_V / 2;
    v.bins.forEach((row, i) => {
      top += this.drawRow(this.rows[i], row, fs, lh, width, top, ms, compact) + this.gap(fs, compact);
    });
    this.root.dataset.used = String(Math.ceil(heightOf(compact)));
    this.svg.attr('width', width).attr('height', Math.ceil(top - this.gap(fs, compact) + 2));
  }

  /** Gap between two rows. */
  private gap(fs: number, compact: boolean): number {
    return compact ? 2 : fs * 0.8;
  }

  /** Heights inside one row: rule name, cut labels (staggered), band, ticks and title. */
  private rowLayout(row: BinsRow, fs: number, lh: number, width: number, compact: boolean) {
    const sc = lineScale({ min: row.domain[0], max: row.domain[1] }, [EDGE, width - EDGE]);
    const active = row.rules[row.active];
    const nameLines = this.measure.wrap(active, width - 8, 'rule-name', fs);
    const headH = nameLines.length * lh;
    const labelW = row.cuts.map((c) => this.measure.width(c.text, 'tick', fs) + 6);
    const levels = staggerRows(row.cuts.map((c, k) => ({ x: sc(c.value), w: labelW[k] })), 0);
    const tiers = Math.max(...levels) + 1;
    const bandH = fs * 1.1;
    const tick = compact ? 1.3 : 1.5;
    const height = headH + 2 + tiers * lh + 2 + bandH + fs * tick + fs * tick + fs * 0.4;
    return { sc, active, nameLines, headH, levels, tiers, bandH, tick, height };
  }

  /** Draws one feature; returns the height it used. */
  private drawRow(r: (typeof this.rows)[number], row: BinsRow, fs: number, lh: number, width: number, top: number, ms: number, compact: boolean): number {
    const L = this.rowLayout(row, fs, lh, width, compact);
    const { sc, active, nameLines, headH, levels, tiers, bandH } = L;
    const cutsTop = top + headH + 2;
    const bandTop = cutsTop + tiers * lh + 2;
    const y = bandTop + bandH;

    // bins as bands between the cuts (the open ends run to the domain)
    const edges = [row.domain[0], ...row.cuts.map((c) => c.value), row.domain[1]];
    const bands = row.rules.map((name, k) => ({ k, name, x0: sc(edges[k]), x1: sc(edges[k + 1]) }));
    r.bandG
      .selectAll<SVGRectElement, (typeof bands)[number]>('rect.bin-band')
      .data(bands, (d) => d.k)
      .join('rect')
      .attr('class', (d) => `bin-band${d.k === row.active ? ' bin-active' : ''}`)
      .attr('data-feature', row.feature)
      .attr('data-bin', (d) => d.k)
      .attr('data-name', (d) => d.name)
      .attr('x', (d) => r1(d.x0))
      .attr('y', r1(bandTop))
      .attr('width', (d) => r1(Math.max(0, d.x1 - d.x0)))
      .attr('height', r1(bandH));

    // the three cuts: a tick across the band and the value above it
    const cutSel = r.cutG
      .selectAll<SVGGElement, BinsRow['cuts'][number] & { level: number }>('g.bin-cut')
      .data(row.cuts.map((c, k) => ({ ...c, level: levels[k] })), (d) => d.value)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'bin-cut');
        g.append('line');
        g.append('text').attr('class', 'bin-cut-label').attr('text-anchor', 'middle');
        return g;
      })
      .attr('data-feature', row.feature)
      .attr('data-value', (d) => d.value);
    cutSel
      .select('line')
      .attr('x1', (d) => r1(sc(d.value)))
      .attr('x2', (d) => r1(sc(d.value)))
      .attr('y1', (d) => r1(cutsTop + (d.level + 1) * lh))
      .attr('y2', r1(y));
    cutSel
      .select('text')
      .attr('x', (d) => r1(sc(d.value)))
      .attr('y', (d) => r1(cutsTop + d.level * lh + fs))
      .text((d) => d.text);

    // customer's value on the line
    r.markG
      .selectAll<SVGCircleElement, number>('circle.bin-value')
      .data([row.value])
      .join('circle')
      .attr('class', 'bin-value')
      .attr('data-feature', row.feature)
      .attr('cx', r1(sc(row.value)))
      .attr('cy', r1(y))
      .attr('r', r1(fs * 0.4));

    // the rule name of the customer's bin
    r.nameG
      .selectAll<SVGTextElement, string>('text.bin-name')
      .data([active])
      .join('text')
      .attr('class', 'bin-name')
      .attr('data-feature', row.feature)
      .selectAll<SVGTSpanElement, string>('tspan')
      .data(nameLines)
      .join('tspan')
      .attr('x', 4)
      .attr('y', (_d, k) => r1(top + lh * k + fs))
      .text((d) => d);

    const tickY = y + fs * L.tick;
    r.line.draw(sc, y, { tickCount: 5, tickY, title: `${row.name} = ${row.valueText}`, titleY: tickY + fs * L.tick }, ms, `bins-${row.feature}-${row.domain[0]}`);
    return L.height;
  }
}
