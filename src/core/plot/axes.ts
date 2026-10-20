import type { Selection } from 'd3-selection';
import { tickFormat } from './format';
import { FRAME, GRID, r1 } from './marks';
import { tr } from './transition';
import type { Rect, Scales } from './viewport';

export interface AxesSpec {
  xTickCount: number; yTickCount: number; xTickY: number; yTickX: number;
  xTitle: { x: number; y: number; text: string };
  yTitle: { x: number; y: number; lines: string[] };
  /** For integer axes (e.g. complaint count 0-5): when given, these are the ticks. */
  xTicks?: number[]; yTicks?: number[];
}

/** Frame, gridline ticks and axis titles of a scatter-style plot. */
export class AxesLayer {
  private readonly frame: Selection<SVGRectElement, unknown, null, undefined>;
  private readonly gx: Selection<SVGGElement, unknown, null, undefined>;
  private readonly gy: Selection<SVGGElement, unknown, null, undefined>;
  private readonly xTitle: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly yTitle: Selection<SVGTextElement, unknown, null, undefined>;

  constructor(parent: Selection<SVGGElement, unknown, null, undefined>) {
    this.frame = parent.append('rect').attr('class', 'frame').attr('fill', 'none').attr('stroke', FRAME);
    this.gx = parent.append('g').attr('class', 'axis x');
    this.gy = parent.append('g').attr('class', 'axis y');
    this.xTitle = parent.append('text').attr('class', 'axis-title x').attr('text-anchor', 'middle');
    this.yTitle = parent.append('text').attr('class', 'axis-title y').attr('text-anchor', 'middle');
  }

  /** Ticks are re-keyed when `dataKey` changes (k-NN: `${dataset}${scaled}`). */
  draw(sc: Scales, plot: Rect, spec: AxesSpec, ms: number, dataKey: string): void {
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    this.frame.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);

    const xt = spec.xTicks ?? sc.x.ticks(spec.xTickCount);
    const fx = tickFormat(xt);
    const xs = this.gx.selectAll<SVGGElement, number>('g.tick').data(xt, (d) => `${dataKey}:${d}`).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'tick').attr('opacity', 0)
          .attr('transform', (d) => `translate(${r1(sc.x(d))},0)`);
        g.append('line').attr('stroke', GRID);
        g.append('text').attr('text-anchor', 'middle');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'axes', ms).attr('opacity', 0).remove(); },
    );
    xs.select('line').attr('y1', plot.top).attr('y2', bottom);
    xs.select<SVGTextElement>('text').attr('y', r1(spec.xTickY)).text((d) => fx(d));
    tr(xs, 'axes', ms).attr('transform', (d) => `translate(${r1(sc.x(d))},0)`).attr('opacity', 1);

    const yt = spec.yTicks ?? sc.y.ticks(spec.yTickCount);
    const fy = tickFormat(yt);
    const ys = this.gy.selectAll<SVGGElement, number>('g.tick').data(yt, (d) => `${dataKey}:${d}`).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'tick').attr('opacity', 0)
          .attr('transform', (d) => `translate(0,${r1(sc.y(d))})`);
        g.append('line').attr('stroke', GRID);
        g.append('text').attr('text-anchor', 'end');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'axes', ms).attr('opacity', 0).remove(); },
    );
    ys.select('line').attr('x1', plot.left).attr('x2', right);
    ys.select<SVGTextElement>('text').attr('x', r1(spec.yTickX)).attr('dy', '0.35em').text((d) => fy(d));
    tr(ys, 'axes', ms).attr('transform', (d) => `translate(0,${r1(sc.y(d))})`).attr('opacity', 1);

    this.xTitle.attr('x', r1(spec.xTitle.x)).attr('y', r1(spec.xTitle.y)).text(spec.xTitle.text);
    this.yTitle.attr('transform', `translate(${r1(spec.yTitle.x)},${r1(spec.yTitle.y)}) rotate(-90)`);
    const lines = spec.yTitle.lines;
    this.yTitle.selectAll('tspan').data(lines).join('tspan')
      .attr('x', 0)
      .attr('dy', (_, i) => (i === 0 ? `${r1(-(lines.length - 1) * 0.6)}em` : '1.2em'))
      .text((d) => d);
  }
}
