import { select, type Selection } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { ACCENT, FRAME, GRID, NAVY, WHITE, r1 } from '../../core/plot/marks';
import { tickFormat, formatNumber } from '../../core/plot/format';
import { epsText } from './view';
import type { Rect } from '../../core/plot/viewport';

export interface KDistState {
  /** Sorted k-distances, one per point. */
  sorted: readonly number[];
  /** Horizontal eps line. */
  eps: number;
  /** The bend of the curve (a distance), or null when it is not known for this min_samples. */
  knee: number | null;
}

type G = Selection<SVGGElement, unknown, null, undefined>;

/** The sorted k-distance curve with the eps line and the knee marked. Redrawn whole on every set(). */
export class KDistChart {
  private readonly root: G;
  private rect: Rect = { left: 0, top: 0, width: 240, height: 140 };
  private fontPx = 13;
  private state: KDistState | null = null;

  constructor(parent: SVGGElement, label: string) {
    this.root = select(parent).append('g').attr('class', 'kd-root').attr('role', 'img').attr('aria-label', label) as unknown as G;
  }

  set(state: KDistState): void {
    this.state = state;
    this.draw();
  }
  /** Stores the box and font size; the next set() draws. */
  resize(rect: Rect, fontPx = this.fontPx): void {
    this.rect = rect;
    this.fontPx = fontPx;
    if (this.state) this.draw();
  }
  destroy(): void { this.root.remove(); }

  private draw(): void {
    const st = this.state;
    if (!st || st.sorted.length === 0) return;
    const f = this.fontPx;
    const { left, top, width, height } = this.rect;
    const mL = Math.ceil(f * 2.9);
    const mR = Math.ceil(f * 0.8);
    const mT = Math.ceil(f * 0.8);
    const mB = Math.ceil(f * 2.2);
    const x0 = left + mL;
    const y0 = top + mT;
    const w = Math.max(20, width - mL - mR);
    const h = Math.max(20, height - mT - mB);
    const n = st.sorted.length;
    const yMax = Math.max(...st.sorted, st.eps);
    const sx = scaleLinear().domain([1, n]).range([x0 + 2, x0 + w - 2]);
    const sy = scaleLinear().domain([0, Math.ceil(yMax * 5) / 5]).range([y0 + h, y0]);

    const g = this.root;
    g.selectAll('*').remove();
    g.append('rect').attr('class', 'kd-frame').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h)
      .attr('fill', 'none').attr('stroke', FRAME);
    let yt = sy.ticks(4);
    if (yt.length > 1 && sy(yt[0]) - sy(yt[1]) < f * 1.1) yt = sy.ticks(2);
    const fy = tickFormat(yt);
    for (const t of yt) {
      g.append('line').attr('class', 'kd-grid').attr('x1', x0).attr('x2', x0 + w).attr('y1', r1(sy(t))).attr('y2', r1(sy(t))).attr('stroke', GRID);
      g.append('text').attr('class', 'kd-tick').attr('x', x0 - 6).attr('y', r1(sy(t))).attr('dy', '0.35em')
        .attr('text-anchor', 'end').text(fy(t));
    }
    g.append('text').attr('class', 'kd-tick kd-x-title').attr('x', r1(x0 + w / 2)).attr('y', y0 + h + f * 1.45)
      .attr('text-anchor', 'middle').attr('fill', NAVY).text('noktalar (küçükten büyüğe sıralı)');

    g.append('path').attr('class', 'kd-line').attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2)
      .attr('d', st.sorted.map((v, i) => `${i ? 'L' : 'M'}${r1(sx(i + 1))},${r1(sy(v))}`).join(''));

    // eps line: label above the line at the left, where the curve is still below it
    const ey = r1(sy(st.eps));
    g.append('line').attr('class', 'kd-eps').attr('data-eps-line', String(st.eps)).attr('x1', x0).attr('x2', x0 + w)
      .attr('y1', ey).attr('y2', ey).attr('stroke', ACCENT).attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
    g.append('text').attr('class', 'kd-label kd-eps-label').attr('x', x0 + 6).attr('y', ey - 5)
      .attr('fill', ACCENT).attr('font-weight', 700).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke')
      .text(`eps = ${epsText(st.eps)}`);

    // knee: the first sorted distance at or above it; label below-right, under the rising curve
    if (st.knee !== null) {
      let ki = st.sorted.findIndex((v) => v >= st.knee!);
      if (ki < 0) ki = n - 1;
      const kx = r1(sx(ki + 1));
      const ky = r1(sy(st.sorted[ki]));
      g.append('circle').attr('class', 'kd-knee').attr('data-knee', String(st.knee)).attr('cx', kx).attr('cy', ky).attr('r', 7)
        .attr('fill', 'none').attr('stroke', ACCENT).attr('stroke-width', 2.5);
      g.append('text').attr('class', 'kd-label kd-knee-label').attr('x', kx - 6).attr('y', ky + f * 2.3)
        .attr('text-anchor', 'end').attr('fill', ACCENT).attr('font-weight', 700).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke')
        .text(`bükülme ≈ ${formatNumber(st.knee, 2)}`);
    }
  }
}
