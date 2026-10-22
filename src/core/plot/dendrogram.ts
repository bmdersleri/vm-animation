import { select, type Selection } from 'd3-selection';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { tickFormat, formatNumber } from './format';
import { ACCENT, FRAME, GRID, NAVY, UNASSIGNED, WHITE, r1 } from './marks';
import { tr, type AnySel } from './transition';
import type { Rect } from './viewport';

/** Same shape as the Chapter 7 tree branches; defined here so core does not import from concepts. */
export interface Branch {
  /** n + merge index. */
  readonly id: number;
  /** x slots (0..n-1) of the two children and of the branch itself. */
  readonly xl: number;
  readonly xr: number;
  readonly x: number;
  /** Heights of the children (0 for a leaf). */
  readonly yl: number;
  readonly yr: number;
  readonly height: number;
  /** Point indices below the branch. */
  readonly members: readonly number[];
}

export interface DendrogramSpec {
  /** All merges of the linkage, in merge order. */
  branches: readonly Branch[];
  /** x slot of each point. */
  leafX: readonly number[];
  /** Text under each leaf, by point index. */
  leafLabels: readonly string[];
  /** Merges drawn: the first `shown` branches. */
  shown: number;
  /** Merge index (0-based) drawn in the accent colour. */
  highlight?: number | null;
  /** Height of the horizontal cut line. */
  cut?: number | null;
  /** Colour of a point's cluster; with `cut`, branches below the cut take it and the rest are muted. */
  colourOf?: (pointIndex: number) => string;
  /** Point whose leaf label is boxed. */
  selectedLeaf?: number | null;
  /** Band between two merge heights (the widest gap). */
  gap?: { low: number; high: number } | null;
}

const MS = 450;
/** Width of the transparent click band along each branch's bar. */
const HIT_WIDTH = 12;
const TR = 'dg';
const TITLE = 'birleşme uzaklığı';
const TITLE_LINES = ['birleşme', 'uzaklığı'];
const FALLBACK_TICK = 13;
const FALLBACK_AXIS = 14;
/** Rough rendered length of text: 0.5 em per character. */
const textLen = (text: string, px: number): number => text.length * px * 0.5;

type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<D, E extends Element = SVGGElement> = Selection<E, D, SVGGElement, unknown>;

/**
 * A dendrogram: one ⊓ per merge at the merge's height, leaves along the bottom with their labels,
 * a height axis on the left, an optional cut line and a band for the widest gap. The geometry comes
 * from `resize`; every `update` redraws from the spec, animating existing elements to their new place.
 */
export class DendrogramLayer {
  private readonly root: G;
  private readonly gGap: G;
  private readonly gAxis: G;
  private readonly gBranches: G;
  private readonly gCut: G;
  private readonly gHits: G;
  private readonly gLeaves: G;
  private readonly frame: Selection<SVGRectElement, unknown, null, undefined>;
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;
  private area: Rect = { left: 0, top: 0, width: 300, height: 200 };
  private maxHeight = 1;
  private plot: Rect = { left: 40, top: 8, width: 250, height: 150 };
  private y: ScaleLinear<number, number> = scaleLinear();
  private tick = FALLBACK_TICK;
  private axis = FALLBACK_AXIS;
  private titleLines: readonly string[] = [TITLE];

  constructor(parent: SVGGElement) {
    this.root = select(parent).append('g').attr('class', 'dg-layer') as unknown as G;
    const sub = (c: string): G => this.root.append('g').attr('class', c) as unknown as G;
    this.gGap = sub('dg-gap-g');
    this.frame = this.root.append('rect').attr('class', 'dg-frame').attr('fill', 'none').attr('stroke', FRAME);
    this.gAxis = sub('dg-axis');
    this.title = this.root.append('text').attr('class', 'dg-axis-title').attr('text-anchor', 'middle');
    this.gBranches = sub('dg-branches');
    this.gCut = sub('dg-cut-g');
    this.gHits = sub('dg-hits');
    this.gLeaves = sub('dg-leaves');
  }

  /**
   * Lays the plot out in `r`; the next `update` draws into it. `maxHeight` is the highest height the
   * axis must show (the caller includes its highest cut), plus 6 % headroom.
   */
  resize(r: Rect, maxHeight: number): void {
    this.area = r;
    this.maxHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 1;
    const node = this.root.node()!;
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
    const tick = cs ? parseFloat(cs.fontSize) : NaN;
    const axis = cs ? parseFloat(cs.getPropertyValue('--fs-axis')) : NaN;
    this.tick = Number.isFinite(tick) && tick > 0 ? tick : FALLBACK_TICK;
    this.axis = Number.isFinite(axis) && axis > 0 ? axis : FALLBACK_AXIS;
    const oneLine = textLen(TITLE, this.axis) <= r.height - 12;
    this.titleLines = oneLine ? [TITLE] : TITLE_LINES;
    const leftM = Math.ceil(this.tick * 2.6 + 10 + this.axis * (oneLine ? 1.5 : 2.7));
    const bottomM = Math.ceil(this.tick * 1.6 + 10);
    this.plot = {
      left: r.left + leftM,
      top: r.top + 8,
      width: Math.max(40, r.width - leftM - 8),
      height: Math.max(40, r.height - 8 - bottomM),
    };
    this.y = scaleLinear().domain([0, this.maxHeight * 1.06]).range([this.plot.top + this.plot.height, this.plot.top]);
  }

  update(s: DendrogramSpec, animate: boolean): void {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = animate && !reduce ? MS : 0;
    const go = <S extends AnySel>(sel: S): S => (ms > 0 ? tr(sel, TR, ms) : (sel.interrupt(TR) as S));
    const { plot, y, tick, axis } = this;
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    const n = s.leafX.length;
    const slot = plot.width / Math.max(1, n);
    const X = (i: number): number => r1(plot.left + (i + 0.5) * slot);
    const Y = (h: number): number => r1(y(h));

    this.frame.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);

    // height axis: ticks keyed by value, so they slide when the axis changes
    const count = Math.max(2, Math.min(8, Math.floor(plot.height / (tick * 2.4))));
    const ticks = y.ticks(count);
    const fmt = tickFormat(ticks);
    this.gAxis.selectAll<SVGGElement, number>('g.dg-tick').data(ticks, (d) => d).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'dg-tick').attr('opacity', 0).attr('transform', (d) => `translate(0,${Y(d)})`);
        g.append('line').attr('stroke', GRID);
        g.append('text').attr('text-anchor', 'end').attr('dy', '0.35em');
        return g;
      },
      (update) => update,
      (exit) => { go(exit as unknown as AnySel).attr('opacity', 0).remove(); },
    ).call((g) => {
      g.select('line').attr('x1', plot.left).attr('x2', right);
      g.select<SVGTextElement>('text').attr('x', r1(plot.left - 6)).text((d) => fmt(d));
      go(g as unknown as AnySel).attr('transform', (d: number) => `translate(0,${Y(d)})`).attr('opacity', 1);
    });
    const lines = this.titleLines;
    const tx = this.area.left + axis * (lines.length === 1 ? 1.1 : 1.5);
    this.title.attr('transform', `translate(${r1(tx)},${r1(plot.top + plot.height / 2)}) rotate(-90)`);
    this.title.selectAll('tspan').data(lines).join('tspan')
      .attr('x', 0).attr('dy', (_d, i) => (i === 0 ? `${r1(-(lines.length - 1) * 0.6)}em` : '1.2em')).text((d) => d);

    // gap band
    const gap = s.gap && s.gap.high > s.gap.low ? [s.gap] : [];
    const gb = this.gGap.selectAll<SVGGElement, { low: number; high: number }>('g.dg-gap-item').data(gap);
    gb.exit().remove();
    const gBorn = gb.enter().append('g').attr('class', 'dg-gap-item');
    gBorn.append('rect').attr('class', 'dg-gap').attr('fill', ACCENT).attr('fill-opacity', 0.1)
      .attr('stroke', ACCENT).attr('stroke-width', 1).attr('stroke-dasharray', '5 4');
    gBorn.append('text').attr('class', 'dg-gap-label').attr('text-anchor', 'end').attr('fill', ACCENT).attr('font-weight', 700);
    const gAll = gBorn.merge(gb as never) as unknown as Sel<{ low: number; high: number }>;
    gAll.select('rect').attr('x', plot.left).attr('width', plot.width)
      .attr('data-low', (d) => d.low).attr('data-high', (d) => d.high)
      .attr('y', (d) => Y(d.high)).attr('height', (d) => Math.max(0, Y(d.low) - Y(d.high)));
    gAll.select<SVGTextElement>('text').attr('x', r1(right - 6)).attr('y', (d) => r1(Y(d.high) + tick * 1.2))
      .attr('display', (d) => (Y(d.low) - Y(d.high) >= tick * 2.6 ? null : 'none'))
      .text((d) => `en uzun boşluk ${formatNumber(d.high - d.low, 2)}`);

    // branches: id -> d, stroke
    const cut = s.cut != null && Number.isFinite(s.cut) ? s.cut : null;
    const shown = s.branches.slice(0, Math.max(0, Math.min(s.branches.length, Math.trunc(s.shown))));
    const stateOf = (b: Branch): 'highlight' | 'muted' | 'cluster' | 'plain' => {
      if (s.highlight != null && b.id - n === s.highlight) return 'highlight';
      if (cut === null || !s.colourOf) return 'plain';
      return b.height > cut ? 'muted' : 'cluster';
    };
    const stroke = (b: Branch): string => {
      const st = stateOf(b);
      return st === 'highlight' ? ACCENT : st === 'muted' ? UNASSIGNED : st === 'cluster' ? s.colourOf!(b.members[0]) : NAVY;
    };
    const path = (b: Branch): string => `M${X(b.xl)},${Y(b.yl)}V${Y(b.height)}H${X(b.xr)}V${Y(b.yr)}`;
    const br = this.gBranches.selectAll<SVGPathElement, Branch>('path.dg-branch').data(shown, (b) => b.id);
    br.exit().remove();
    const born = br.enter().append('path').attr('class', 'dg-branch').attr('fill', 'none')
      .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('opacity', ms > 0 ? 0 : 1)
      .attr('d', path);
    const bAll = born.merge(br as never) as unknown as Selection<SVGPathElement, Branch, SVGGElement, unknown>;
    bAll.attr('data-merge', (b) => b.id - n + 1).attr('data-height', (b) => b.height)
      .attr('data-state', stateOf)
      .attr('stroke-width', (b) => (stateOf(b) === 'highlight' ? 4 : 2.5));
    go(bAll as unknown as AnySel).attr('d', path).attr('stroke', stroke).attr('opacity', 1);
    bAll.order();

    // Click targets: one wide transparent band per bar, over the branches and the cut line. Children come
    // last, so where a child's bar meets its parent's leg (the bar's centre) the child is picked.
    const hitPath = (b: Branch): string => `M${X(b.xl)},${Y(b.height)}H${X(b.xr)}`;
    const hits = this.gHits.selectAll<SVGPathElement, Branch>('path.dg-hit').data([...shown].reverse(), (b) => b.id);
    hits.exit().remove();
    hits.enter().append('path').attr('class', 'dg-hit').attr('fill', 'none').attr('stroke', 'transparent')
      .attr('stroke-width', HIT_WIDTH).attr('stroke-linecap', 'butt').attr('pointer-events', 'stroke')
      .merge(hits as never)
      .attr('data-merge', (b) => (b as Branch).id - n + 1)
      .attr('d', (b) => hitPath(b as Branch))
      .order();

    // cut line + label
    const cl = this.gCut.selectAll<SVGGElement, number>('g.dg-cut-item').data(cut === null ? [] : [cut]);
    cl.exit().remove();
    const cBorn = cl.enter().append('g').attr('class', 'dg-cut-item');
    cBorn.append('line').attr('class', 'dg-cut').attr('y1', (d) => Y(d)).attr('y2', (d) => Y(d)).attr('stroke', NAVY).attr('stroke-width', 2.5).attr('stroke-dasharray', '8 5');
    // The label sits just above the line; where the plot has no room above it (a cut near the axis top), below it.
    const labelY = (c: number): number => (Y(c) - 5 - tick < plot.top ? r1(Y(c) + tick + 3) : r1(Y(c) - 5));
    cBorn.append('text').attr('class', 'dg-cut-label').attr('y', labelY).attr('text-anchor', 'end').attr('fill', NAVY).attr('font-weight', 700)
      .attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke');
    const cAll = cBorn.merge(cl as never) as unknown as Sel<number>;
    const cutLine = cAll.select('line').attr('data-cut', (d) => d).attr('x1', plot.left).attr('x2', right);
    go(cutLine as unknown as AnySel).attr('y1', (d: number) => Y(d)).attr('y2', (d: number) => Y(d));
    const cutText = (c: number): string => `kesim ${formatNumber(c, 2)}`;
    // The label takes the rightmost stretch of the cut line that no branch stem crosses.
    const labelX = (c: number): number => {
      const w = cutText(c).length * tick * 0.62 + 8;
      const stems: number[] = [];
      for (const b of shown) {
        if (b.yl <= c && c <= b.height) stems.push(X(b.xl));
        if (b.yr <= c && c <= b.height) stems.push(X(b.xr));
      }
      for (let x = right - 6 - w; x >= plot.left + 4; x -= 6) if (stems.every((sx) => sx < x - 4 || sx > x + w + 4)) return r1(x);
      return r1(right - 6 - w);
    };
    const cutLabel = cAll.select<SVGTextElement>('text').attr('text-anchor', 'start').attr('x', (d) => labelX(d)).text((d) => cutText(d));
    go(cutLabel as unknown as AnySel).attr('y', labelY);

    // leaves
    const lf = this.gLeaves.selectAll<SVGGElement, number>('g.dg-leaf').data(s.leafX.map((_x, i) => i), (d) => d);
    lf.exit().remove();
    const ly = r1(bottom + tick * 1.05);
    const lBorn = lf.enter().append('g').attr('class', 'dg-leaf').attr('transform', (d) => `translate(${X(s.leafX[d])},${ly})`);
    lBorn.append('rect').attr('class', 'dg-leaf-box').attr('rx', 4).attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2);
    lBorn.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', NAVY);
    const lAll = lBorn.merge(lf as never) as unknown as Sel<number>;
    lAll.attr('data-i', (d) => d).attr('data-selected', (d) => (s.selectedLeaf === d ? 'true' : 'false'));
    lAll.select<SVGTextElement>('text').text((d) => s.leafLabels[d] ?? '').attr('font-weight', (d) => (s.selectedLeaf === d ? 700 : 500));
    lAll.select<SVGRectElement>('rect').attr('display', (d) => (s.selectedLeaf === d ? null : 'none'))
      .attr('x', (d) => r1(-(((s.leafLabels[d] ?? '').length * tick * 0.6) / 2 + 4)))
      .attr('width', (d) => r1((s.leafLabels[d] ?? '').length * tick * 0.6 + 8))
      .attr('y', r1(-tick * 0.75)).attr('height', r1(tick * 1.5));
    go(lAll as unknown as AnySel).attr('transform', (d: number) => `translate(${X(s.leafX[d])},${ly})`);
  }

  destroy(): void {
    this.root.selectAll('*').interrupt(TR);
    this.root.remove();
  }
}
