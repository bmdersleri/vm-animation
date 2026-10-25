import { select, type Selection } from 'd3-selection';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';

type G = Selection<SVGGElement, unknown, null, undefined>;
type Parent = AnySel;

/** The rule names of a bar panel, wrapped to the panel width: `lines[i]` are the rows of name i, `nameH` the tallest. */
export interface NameLayout {
  lines: string[][];
  nameFs: number;
  nameH: number;
}

/** Options of one draw: panel width and height (px), the tick font, the transition, the class of every bar group. */
export interface SignedDraw {
  width: number;
  height: number;
  fs: number;
  ms: number;
  itemCls: string;
}

/**
 * Diverging coefficient bars on the shared `HBarsLayer`: positive bars grow right of a zero line and negative bars
 * left of it (one scale for both), each value written at its bar end, the rule name above its bar, and the zero line
 * drawn per bar band only, so it never crosses a name or a label. Used by the surrogate scene (steps 6-7) and the
 * LIME panel of step 9.
 */
export class SignedBars {
  private readonly barG: G;
  private readonly zeroG: G;
  private readonly nameG: G;
  private readonly layer: HBarsLayer;

  constructor(
    private readonly parent: Parent,
    private readonly measure: TextMeasure,
  ) {
    this.barG = parent.append('g').attr('class', 'lime-bars');
    this.zeroG = parent.append('g').attr('class', 'lime-zeros');
    this.nameG = parent.append('g').attr('class', 'lime-names');
    this.layer = new HBarsLayer(this.barG, measure);
  }

  interrupt(): void {
    this.parent.selectAll('*').interrupt('bars');
  }

  /** Wraps the rule names at `width` (the same line count for every row, so the bars keep one pitch). */
  names(rules: readonly string[], width: number, fs: number): NameLayout {
    const nameFs = this.measure.fontPx('rule-name', fs);
    const lines = rules.map((rule) => this.measure.wrap(rule, width - 8, 'rule-name', nameFs));
    return { lines, nameFs, nameH: Math.max(...lines.map((l) => l.length)) * nameFs * 1.25 };
  }

  draw(bars: HBar[], names: NameLayout, o: SignedDraw): void {
    const { width, height, fs, ms, itemCls } = o;
    const { lines, nameFs } = names;
    // zero sits where the longest negative bar and the longest positive bar leave room for their labels
    const valueW = this.measure.width('+0,000', 'tick', fs) + 8;
    const maxPos = Math.max(0, ...bars.filter((b) => b.attrs?.sign === 'pos').map((b) => b.value));
    const maxNeg = Math.max(0, ...bars.filter((b) => b.attrs?.sign === 'neg').map((b) => b.value));
    const edge = 8;
    const labels = (maxPos > 0 ? valueW : 0) + (maxNeg > 0 ? valueW : 0);
    const scale = (width - 2 * edge - labels) / Math.max(1e-9, maxPos + maxNeg);
    const zero = edge + maxNeg * scale + (maxNeg > 0 ? valueW : 0);
    const draw = (x: number, w: number, max: number) =>
      this.layer.draw(bars, {
        rect: { x, y: 0, w, h: height },
        tick: fs,
        rows: bars.length,
        slots: 1,
        max,
        itemCls,
        valueSample: '+0,000',
        ms,
      });
    // the layer starts its bars `lead` px right of rect.x; a first draw tells how far
    const lead = draw(0, width, 1).x0;
    const ref = Math.max(maxPos, maxNeg, 1e-9);
    // the full-length bar ends `12 + valueW` px before the rect's right edge: the rect is sized so its length is ref * scale
    const geo = draw(zero - lead, lead + ref * scale + 12 + valueW, ref);
    // negative bars grow left from zero, their label sits left of the bar end
    this.barG.selectAll<SVGGElement, HBar>(`g.${itemCls}`).each(function (d) {
      if (d.attrs?.sign !== 'neg') {
        return;
      }
      const g = select(this);
      const len = d.value * scale;
      // a negative bar grows leftward: it starts at zero with no width, then x and width move together
      const rect = g.select<SVGRectElement>('rect.bar');
      if (ms > 0) {
        rect.attr('x', Math.round(zero * 10) / 10).attr('width', 0);
      }
      tr(rect, 'bars', ms)
        .attr('x', Math.round((zero - len) * 10) / 10)
        .attr('width', Math.round(len * 10) / 10);
      g.select('text.bar-value').attr('text-anchor', 'end').attr('x', Math.round((zero - len - 6) * 10) / 10);
    });
    // the zero line is drawn per bar, only across the bar bands
    const barH = geo.barH;
    this.zeroG
      .selectAll<SVGLineElement, number>('line.lime-zero')
      .data(bars.map((_b, i) => geo.yOf(i, 0)))
      .join('line')
      .attr('class', 'lime-zero')
      .attr('x1', Math.round(zero * 10) / 10)
      .attr('x2', Math.round(zero * 10) / 10)
      .attr('y1', (y) => Math.round(y * 10) / 10)
      .attr('y2', (y) => Math.round((y + barH + 1) * 10) / 10);
    this.nameG
      .selectAll<SVGTextElement, string[]>('text.rule-name')
      .data(lines)
      .join('text')
      .attr('class', 'rule-name')
      .attr('data-feature', (_d, i) => i)
      .each(function (rows, i) {
        const top = geo.yOf(i, 0) - 7 - (rows.length - 1) * nameFs * 1.25;
        select(this)
          .selectAll<SVGTSpanElement, string>('tspan')
          .data(rows)
          .join('tspan')
          .attr('x', 6)
          .attr('y', (_r, k) => Math.round((top + k * nameFs * 1.25) * 10) / 10)
          .text((r) => r);
      });
  }
}
