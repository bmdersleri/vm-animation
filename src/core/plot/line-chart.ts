import type { Selection } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { AxesLayer } from './axes';
import { tickFormat } from './format';
import { chooseOffset, labelArea, labelBox, offsets, overlap, type Box } from './label-place';
import { NAVY, r1 } from './marks';
import { tr } from './transition';
import type { TextMeasure } from './text-measure';
import { fitViewport, type Rect } from './viewport';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** One polyline of a line chart; `cls` carries its colour in the page's CSS. */
export interface LineSeries {
  id: string;
  cls: string;
  pts: [number, number][];
  dash?: string;
}

/** A horizontal reference line with a label at its right end. */
export interface LineRef {
  y: number;
  label: string;
  cls: string;
}

/** Everything a line chart draws: axis domains and titles, polylines, reference lines and one marked point. */
export interface LineChartSpec {
  x: [number, number];
  y: [number, number];
  xTitle: string;
  yTitle: string;
  series: LineSeries[];
  refs?: LineRef[];
  marker?: { x: number; y: number; label: string } | null;
  /** Explicit tick values (e.g. the integers 1-8); default is the d3 tick choice. */
  xTicks?: number[];
  yTicks?: number[];
}

/** Outer padding (px) around the axis titles. */
const PAD = 8;
/** Approximate y tick count. */
const Y_TICKS = 5;

/**
 * Generic line chart for the plot area of a scene: frame, ticks and titles
 * (AxesLayer), polylines, horizontal reference lines and one labelled marker.
 * Labels are placed with label-place and clamped into the plot. Pages style
 * the series and reference classes in their own CSS.
 */
export class LineChartLayer {
  private readonly axes: AxesLayer;
  private readonly seriesG: G;
  private readonly refsG: G;
  private readonly markG: G;

  constructor(
    g: G,
    private readonly measure: TextMeasure,
  ) {
    this.axes = new AxesLayer(g.append('g').attr('class', 'lc-axes'));
    this.seriesG = g.append('g').attr('class', 'lc-series-layer');
    this.refsG = g.append('g').attr('class', 'lc-refs');
    this.markG = g.append('g').attr('class', 'lc-mark');
  }

  /** Font sizes and the widest y tick label, which together decide the insets. */
  private metrics(spec: LineChartSpec) {
    const tick = this.measure.fontPx('tick', 13);
    const axis = this.measure.fontPx('axis-title', 14);
    const gap = Math.round(tick * 0.45);
    const yt = scaleLinear().domain(spec.y).ticks(Y_TICKS);
    const fy = tickFormat(yt);
    const yTickW = this.measure.maxWidth(yt.map(fy), 'tick', tick);
    return { tick, axis, gap, yTickW };
  }

  /** The plot rectangle inside a `w` × `h` area, leaving room for tick labels and axis titles. */
  plotRect(w: number, h: number, spec: LineChartSpec): Rect {
    const m = this.metrics(spec);
    const left = PAD + m.axis * 1.2 + m.gap + m.yTickW + m.gap;
    const top = PAD + m.tick;
    const below = m.gap + m.tick * 1.2 + m.gap + m.axis * 1.25 + PAD;
    return {
      left,
      top,
      width: Math.max(40, w - left - PAD - m.tick),
      height: Math.max(40, h - top - below),
    };
  }

  /** Draws the chart into `plot` (px); `ms` > 0 animates axes and lines. */
  draw(spec: LineChartSpec, plot: Rect, ms: number): void {
    const m = this.metrics(spec);
    const sc = fitViewport({ x: spec.x, y: spec.y }, plot, false);
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    const xTickY = bottom + m.gap + m.tick * 0.9;
    this.axes.draw(
      sc,
      plot,
      {
        xTickCount: Math.max(2, Math.round(plot.width / (m.tick * 6))),
        yTickCount: Y_TICKS,
        xTicks: spec.xTicks,
        yTicks: spec.yTicks,
        xTickY,
        yTickX: plot.left - m.gap,
        xTitle: { x: plot.left + plot.width / 2, y: xTickY + m.tick * 0.3 + m.gap + m.axis * 0.95, text: spec.xTitle },
        yTitle: {
          x: plot.left - m.gap - m.yTickW - m.gap - m.axis * 0.3,
          y: plot.top + plot.height / 2,
          lines: [spec.yTitle],
        },
      },
      ms,
      `${spec.x.join(',')}|${spec.y.join(',')}`,
    );

    const path = (pts: [number, number][]): string =>
      pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(sc.x(x))},${r1(sc.y(y))}`).join('');
    const lines = this.seriesG
      .selectAll<SVGPathElement, LineSeries>('path.lc-series')
      .data(spec.series, (d) => d.id)
      .join(
        (enter) => enter.append('path').attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 3),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', (d) => `lc-series ${d.cls}`)
      .attr('stroke-dasharray', (d) => d.dash ?? null);
    tr(lines, 'line', ms).attr('d', (d) => path(d.pts));

    const taken: Box[] = [];
    const refs = spec.refs ?? [];
    // the polylines count as occupied: ref labels and the marker label sit beside them
    const step = Math.max(3, m.tick * 0.3);
    for (const sr of spec.series) {
      for (let i = 1; i < sr.pts.length; i++) {
        const ax = sc.x(sr.pts[i - 1][0]);
        const ay = sc.y(sr.pts[i - 1][1]);
        const dx = sc.x(sr.pts[i][0]) - ax;
        const dy = sc.y(sr.pts[i][1]) - ay;
        const k = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
        for (let j = 0; j <= k; j++) {
          const x = ax + (dx * j) / k;
          const y = ay + (dy * j) / k;
          taken.push({ l: x - 2, t: y - 2, r: x + 2, b: y + 2 });
        }
      }
    }
    this.refsG
      .selectAll<SVGLineElement, LineRef>('line.lc-ref')
      .data(refs)
      .join('line')
      .attr('class', (d) => `lc-ref ${d.cls}`)
      .attr('stroke', NAVY)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8 5')
      .attr('x1', plot.left)
      .attr('x2', right)
      .attr('y1', (d) => r1(sc.y(d.y)))
      .attr('y2', (d) => r1(sc.y(d.y)));
    // each label goes above or below its line, whichever side is clearer of the curves and of earlier labels
    const refYs = new Map<LineRef, number>();
    for (const d of refs) {
      const y = sc.y(d.y);
      const cands = [y - 4, y + m.tick + 2].filter((c) => c - m.tick >= plot.top - 1 && c <= bottom);
      const score = (c: number): number => {
        const box = labelBox(right - 4, c, d.label.length, 'end', m.tick);
        return taken.reduce((n, t) => n + (overlap(box, t) > 0 ? 1 : 0), 0);
      };
      const best = cands.length === 0 ? y - 4 : cands.reduce((a, c) => (score(c) < score(a) ? c : a));
      refYs.set(d, best);
      taken.push(labelBox(right - 4, best, d.label.length, 'end', m.tick));
      taken.push({ l: plot.left, t: y - 2, r: right, b: y + 2 });
    }
    this.refsG
      .selectAll<SVGTextElement, LineRef>('text.lc-ref-label')
      .data(refs)
      .join('text')
      .attr('class', (d) => `lc-ref-label tick ${d.cls}`)
      .attr('text-anchor', 'end')
      .attr('x', r1(right - 4))
      .attr('y', (d) => r1(refYs.get(d)!))
      .text((d) => d.label);

    const marker = spec.marker ?? null;
    const mx = marker ? sc.x(marker.x) : 0;
    const my = marker ? sc.y(marker.y) : 0;
    const half = Math.max(4, m.tick * 0.4);
    this.markG
      .selectAll<SVGCircleElement, unknown>('circle.lc-marker')
      .data(marker ? [marker] : [])
      .join('circle')
      .attr('class', 'lc-marker')
      .attr('fill', NAVY)
      .attr('r', half)
      .attr('cx', r1(mx))
      .attr('cy', r1(my));
    const label = this.markG
      .selectAll<SVGTextElement, NonNullable<LineChartSpec['marker']>>('text.lc-label')
      .data(marker ? [marker] : [])
      .join('text')
      .attr('class', 'lc-label tick');
    if (marker) {
      const w = this.measure.width(marker.label, 'tick', m.tick);
      const o = chooseOffset({
        x: mx,
        y: my,
        chars: w / (m.tick * 0.7),
        cands: offsets(half, m.gap, m.tick),
        fs: m.tick,
        taken,
        area: labelArea(plot, 0),
      });
      const lo = o.anchor === 'end' ? plot.left + w : o.anchor === 'middle' ? plot.left + w / 2 : plot.left;
      const hi = o.anchor === 'end' ? right : o.anchor === 'middle' ? right - w / 2 : right - w;
      const x = Math.max(lo, Math.min(hi, mx + o.dx));
      const y = Math.max(plot.top + m.tick, Math.min(bottom - 2, my + o.dy));
      label.attr('text-anchor', o.anchor).attr('x', r1(x)).attr('y', r1(y)).text(marker.label);
    }
  }

  /** Removes the series, reference lines and marker (the axes stay). */
  clear(): void {
    this.seriesG.selectAll('*').remove();
    this.refsG.selectAll('*').remove();
    this.markG.selectAll('*').remove();
  }
}
