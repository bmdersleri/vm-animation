import { select, type Selection } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { ACCENT, FRAME, GRID, NAVY, WHITE, r1 } from '../../core/plot/marks';
import { tickFormat } from '../../core/plot/format';
import type { Rect } from '../../core/plot/viewport';

export interface KLineSpec {
  ks: number[];
  /** One value per k; null = undefined (no point, e.g. silhouette at k=1). */
  values: (number | null)[];
  label: string;
  yDomain: [number, number];
}
export type MarkKind = 'elbow' | 'peak';

const MARK_TEXT: Record<MarkKind, string> = { elbow: 'dirsek', peak: 'zirve' };

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * A small k -> value line chart: points, a highlighted selected k, a progressive
 * reveal (set({ reveal })) and kind-labelled marks (elbow / peak). No transitions:
 * every set() redraws the final state, so reduced motion needs no special case.
 */
export class KLineChart {
  private readonly root: G;
  private rect: Rect = { left: 0, top: 0, width: 200, height: 120 };
  private fontPx = 13;
  private selected: number | null = null;
  private reveal: number;
  private marks: { k: number; kind: MarkKind }[] = [];

  constructor(parent: SVGGElement, private readonly spec: KLineSpec) {
    this.root = select(parent).append('g').attr('class', 'kc-chart').attr('role', 'img').attr('aria-label', spec.label) as unknown as G;
    this.reveal = Math.max(...spec.ks);
    this.draw();
  }

  /** Sets reveal, selected k and marks together and draws once. */
  set(state: { reveal: number; selected: number | null; marks: readonly { k: number; kind: MarkKind }[] }): void {
    this.reveal = state.reveal;
    this.selected = state.selected;
    this.marks = state.marks.map((m) => ({ ...m }));
    this.draw();
  }
  /** Stores the box and font size only; the next set() draws, so a render draws each chart once. */
  resize(rect: Rect, fontPx = this.fontPx): void { this.rect = rect; this.fontPx = fontPx; }
  destroy(): void { this.root.remove(); }

  private draw(): void {
    const { ks, values, yDomain } = this.spec;
    const f = this.fontPx;
    const { left, top, width, height } = this.rect;
    const mL = Math.ceil(f * 2.9);
    const mR = Math.ceil(f * 0.8);
    const mT = Math.ceil(f * 0.8);
    const mB = Math.ceil(f * 1.9);
    const x0 = left + mL;
    const y0 = top + mT;
    const w = Math.max(20, width - mL - mR);
    const h = Math.max(20, height - mT - mB);
    const kMin = Math.min(...ks);
    const kMax = Math.max(...ks);
    const sx = scaleLinear().domain([kMin, kMax]).range([x0 + f * 0.6, x0 + w - f * 0.6]);
    const sy = scaleLinear().domain(yDomain).range([y0 + h, y0]);

    const g = this.root;
    g.selectAll('*').remove();

    // frame, y gridlines and tick labels
    g.append('rect').attr('class', 'kc-frame').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h)
      .attr('fill', 'none').attr('stroke', FRAME);
    const inDomain = (t: number): boolean => t >= yDomain[0] && t <= yDomain[1];
    let yt = sy.ticks(3).filter(inDomain);
    // A short chart (the narrow single-column layout) keeps fewer ticks than ones closer than 1.1 fonts.
    if (yt.length > 1 && sy(yt[0]) - sy(yt[1]) < f * 1.1) yt = sy.ticks(2).filter(inDomain);
    const fy = tickFormat(yt);
    for (const t of yt) {
      g.append('line').attr('class', 'kc-grid').attr('x1', x0).attr('x2', x0 + w).attr('y1', r1(sy(t))).attr('y2', r1(sy(t))).attr('stroke', GRID);
      g.append('text').attr('class', 'kc-tick kc-tick-y').attr('x', x0 - 6).attr('y', r1(sy(t))).attr('dy', '0.35em')
        .attr('text-anchor', 'end').text(fy(t));
    }
    for (const k of ks) {
      g.append('text').attr('class', 'kc-tick kc-tick-x').attr('x', r1(sx(k))).attr('y', y0 + h + f * 1.25)
        .attr('text-anchor', 'middle').text(String(k));
    }

    // line through the revealed, defined points
    const shown = ks.map((k, i) => ({ k, v: values[i] })).filter((p): p is { k: number; v: number } => p.v !== null && p.k <= this.reveal);
    if (shown.length > 1) {
      g.append('path').attr('class', 'kc-line').attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2)
        .attr('d', shown.map((p, i) => `${i ? 'L' : 'M'}${r1(sx(p.k))},${r1(sy(p.v))}`).join(''));
    }

    // marks first (under the points)
    for (const m of this.marks) {
      const p = shown.find((s) => s.k === m.k);
      if (!p) continue;
      const mg = g.append('g').attr('class', 'kc-mark').attr('data-kind', m.kind).attr('data-k', m.k);
      mg.append('circle').attr('cx', r1(sx(p.k))).attr('cy', r1(sy(p.v))).attr('r', 12).attr('fill', 'none')
        .attr('stroke', ACCENT).attr('stroke-width', 2.5).attr('stroke-dasharray', '4 3');
      mg.append('text').attr('class', 'kc-mark-label').attr('x', r1(sx(p.k)) + 12).attr('y', r1(sy(p.v)) - 14)
        .attr('fill', ACCENT).attr('font-weight', 700).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke')
        .text(`${MARK_TEXT[m.kind]} k=${m.k}`);
    }

    for (const p of shown) {
      const on = p.k === this.selected;
      g.append('circle').attr('class', 'kc-point').attr('data-k', p.k).attr('data-selected', String(on))
        .attr('cx', r1(sx(p.k))).attr('cy', r1(sy(p.v))).attr('r', on ? 7.5 : 4.5)
        .attr('fill', on ? NAVY : WHITE).attr('stroke', NAVY).attr('stroke-width', 2);
    }
  }
}
