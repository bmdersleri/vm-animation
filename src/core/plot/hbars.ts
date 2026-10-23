import type { Selection } from 'd3-selection';
import { r1 } from './marks';
import type { TextMeasure } from './text-measure';
import { tr } from './transition';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** A rectangle in px. */
export interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One horizontal bar. `row` is the row it sits in (0 = top), `slot` its place inside a row of several bars,
 * `cls` its colour class, `label` the name written left of the row (empty = none), `text` the value written
 * after the bar. `attrs` become `data-*` attributes.
 */
export interface HBar {
  id: string;
  row: number;
  slot: number;
  cls: string;
  value: number;
  text: string;
  label: string;
  attrs?: Record<string, string | number>;
}

/** Layout of one draw call. */
export interface HBarsOptions {
  rect: BarRect;
  tick: number;
  /** Rows and bars per row (sets the bar height). */
  rows: number;
  slots: number;
  /** Value that fills the full bar length. */
  max: number;
  /** Class of every bar group (the page's CSS keys on it). */
  itemCls: string;
  /** Widest value text, to reserve room for it (default: the widest `text` of the data). */
  valueSample?: string;
  /** Tallest bar in tick-font heights (default 1.5). */
  barK?: number;
  ms: number;
}

/** Where the last draw put things, so a scene can lay marks on the bars. */
export interface HBarsGeometry {
  x0: number;
  barH: number;
  xOf: (value: number) => number;
  yOf: (row: number, slot: number) => number;
}

const PAD = 12;

/**
 * Horizontal bars with a name column on the left and the value after each bar: rows from the top, one or
 * several bars per row. Pages colour them through `itemCls` and `cls`; bars grow from zero when `ms` > 0.
 */
export class HBarsLayer {
  constructor(
    private readonly g: G,
    private readonly measure: TextMeasure,
  ) {}

  draw(data: HBar[], o: HBarsOptions): HBarsGeometry {
    const { rect, tick } = o;
    const nameW = this.measure.maxWidth(data.map((d) => d.label), 'tick', tick) + 10;
    const valueW = this.measure.width(o.valueSample ?? this.widest(data), 'tick', tick) + 8;
    const x0 = rect.x + PAD + nameW;
    const xMax = Math.max(x0 + 20, rect.x + rect.w - PAD - valueW);
    const groupH = rect.h / Math.max(1, o.rows);
    const gapIn = 2;
    const barH = Math.max(6, Math.min(tick * (o.barK ?? 1.5), (groupH - 6 - gapIn * (o.slots - 1)) / o.slots));
    const blockH = barH * o.slots + gapIn * (o.slots - 1);
    const len = (c: number): number => (c / o.max) * (xMax - x0);
    const yOf = (row: number, slot: number): number => rect.y + row * groupH + (groupH - blockH) / 2 + slot * (barH + gapIn);

    const sel = this.g
      .selectAll<SVGGElement, HBar>(`g.${o.itemCls}`)
      .data(data, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('class', 'bar').attr('rx', 3).attr('width', 0);
        g.append('text').attr('class', 'bar-name tick').attr('text-anchor', 'end');
        g.append('text').attr('class', 'bar-value tick');
        return g;
      })
      .attr('class', (d) => `${o.itemCls} ${d.cls}`)
      .attr('transform', (d) => `translate(0,${r1(yOf(d.row, d.slot))})`)
      .each(function (d) {
        for (const [k, v] of Object.entries(d.attrs ?? {})) this.setAttribute(`data-${k}`, String(v));
      });
    sel
      .select('rect.bar')
      .attr('x', r1(x0))
      .attr('height', r1(barH))
      .call((s) => tr(s, 'bars', o.ms).attr('width', (d) => r1(Math.max(1, len(d.value)))));
    sel
      .select('text.bar-name')
      .attr('x', r1(x0 - 8))
      .attr('y', r1(barH / 2))
      .attr('dy', '0.35em')
      .text((d) => d.label);
    sel
      .select('text.bar-value')
      .attr('x', (d) => r1(x0 + len(d.value) + 6))
      .attr('y', r1(barH / 2))
      .attr('dy', '0.35em')
      .text((d) => d.text);
    return { x0, barH, xOf: (v) => x0 + len(v), yOf };
  }

  private widest(data: HBar[]): string {
    return data.reduce((a, d) => (d.text.length > a.length ? d.text : a), '');
  }
}
