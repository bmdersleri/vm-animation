import { scaleLinear } from 'd3-scale';
import { AxesLayer } from '../../core/plot/axes';
import { formatNumber as f } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { META } from './data';
import type { G } from './scene-base';

const PAD = 8;
/** Candidate y tick steps (shares), the first that gives at most five ticks wins. */
const STEPS = [0.01, 0.02, 0.05, 0.1];

/** Number of screen bins (22): `META.hist` from `lo` to `hi`. */
export const BINS = Math.round((META.hist.hi - META.hist.lo) / META.hist.width);

/**
 * Two histograms of the 22 fee bins on one set of axes: the reference as filled navy bars (`.hist-ref`), the current
 * window as orange outlines (`.hist-cur`), both as shares of their own total so months and windows of different
 * sizes compare. The x axis runs 15-125 (`META.hist`).
 */
export class HistPairLayer {
  private readonly axes: AxesLayer;
  private readonly refG: G;
  private readonly curG: G;

  constructor(
    g: G,
    private readonly measure: TextMeasure,
  ) {
    this.axes = new AxesLayer(g.append('g').attr('class', 'hist-axes'));
    this.refG = g.append('g').attr('class', 'hist-ref-layer');
    this.curG = g.append('g').attr('class', 'hist-cur-layer');
  }

  private static ticksOf(max: number): { top: number; ticks: number[] } {
    const step = STEPS.find((s) => max / s <= 5) ?? STEPS[STEPS.length - 1];
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks: number[] = [];
    for (let k = 0; k * step <= top + 1e-9; k += 1) {
      ticks.push(Math.round(k * step * 1000) / 1000);
    }
    return { top, ticks };
  }

  /** The plot rectangle inside a `w` x `h` area. */
  plotRect(w: number, h: number, tickPx: number, axisPx: number): Rect {
    const gap = Math.round(tickPx * 0.45);
    const left = PAD + axisPx * 1.2 + gap + this.measure.width('00', 'tick', tickPx) + gap;
    const top = PAD + tickPx * 0.5;
    const below = gap + tickPx * 1.2 + gap + axisPx * 1.25 + PAD;
    return { left, top, width: Math.max(40, w - left - PAD - tickPx), height: Math.max(40, h - top - below) };
  }

  /** Draws the pair (shares of the 22 bins) into a `box` of px; `ms` > 0 animates the axes. */
  draw(ref: readonly number[], cur: readonly number[], box: { w: number; h: number }, tickPx: number, axisPx: number, ms: number): void {
    const plot = this.plotRect(box.w, box.h, tickPx, axisPx);
    const { top, ticks } = HistPairLayer.ticksOf(Math.max(...ref, ...cur, 0.01));
    const sc = fitViewport({ x: [META.hist.lo, META.hist.hi], y: [0, top] }, plot, false);
    const gap = Math.round(tickPx * 0.45);
    const bottom = plot.top + plot.height;
    const xTickY = bottom + gap + tickPx * 0.9;
    this.axes.draw(
      sc,
      plot,
      {
        xTickCount: Math.max(2, Math.round(plot.width / (tickPx * 4.5))),
        yTickCount: ticks.length,
        yTicks: ticks,
        yFormat: (v) => f(v * 100, 0),
        xTickY,
        yTickX: plot.left - gap,
        xTitle: { x: plot.left + plot.width / 2, y: xTickY + tickPx * 0.3 + gap + axisPx * 0.95, text: 'aylık ücret' },
        yTitle: {
          x: plot.left - gap - this.measure.width('00', 'tick', tickPx) - gap - axisPx * 0.3,
          y: plot.top + plot.height / 2,
          lines: ['pay (%)'],
        },
      },
      ms,
      'hist',
    );
    const binW = plot.width / BINS;
    const bars = (g: G, shares: readonly number[], cls: string): void => {
      const sel = g
        .selectAll<SVGRectElement, number>(`rect.${cls}`)
        .data(shares)
        .join('rect')
        .attr('class', cls)
        .attr('data-bin', (_d, i) => i)
        .attr('data-share', (d) => d)
        .attr('x', (_d, i) => r1(plot.left + i * binW + 1))
        .attr('width', r1(Math.max(1, binW - 2)));
      tr(sel, 'hist', ms)
        .attr('y', (d) => r1(sc.y(d)))
        .attr('height', (d) => r1(Math.max(0, bottom - sc.y(d))));
    };
    bars(this.refG, ref, 'hist-ref');
    bars(this.curG, cur, 'hist-cur');
  }
}
