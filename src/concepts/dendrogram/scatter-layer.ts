import { select, type Selection } from 'd3-selection';
import { ACCENT } from '../../core/plot/dendrogram';
import { LABEL_FALLBACK_PX, chooseOffset, labelArea, offsets, type Box } from '../../core/plot/label-place';
import { CLUSTER, NAVY, UNASSIGNED, WHITE, r1 } from '../../core/plot/marks';
import { tr, type AnySel } from '../../core/plot/transition';
import { fitEqualAspect, type Domain, type Rect, type Scales } from '../../core/plot/viewport';
import type { Pt } from './data';

export interface Hull {
  /** Point indices inside the rounded outline. */
  members: readonly number[];
  /** 'merge' = the newest merge (accent, with data-merge); 'cluster' = a cut cluster; 'group' = an earlier cluster. */
  kind: 'merge' | 'cluster' | 'group';
  colour: string;
  merge?: number;
}

export interface ScatterSpec {
  points: readonly Pt[];
  /** Cluster per point (colours from CLUSTER), or null for plain grey points. */
  label: readonly number[] | null;
  hulls: readonly Hull[];
  /** Points of the newest merge: drawn in the accent colour. */
  merged: readonly number[];
  selected?: number | null;
}

const R = 5.5;
const PAD = 11;
const MS = 450;
const TR = 'dgs';
const colour = (c: number | undefined): string => (c === undefined || c < 0 ? UNASSIGNED : CLUSTER[c % CLUSTER.length]);

type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<D, E extends Element = SVGGElement> = Selection<E, D, SVGGElement, unknown>;

type XY = readonly [number, number];
const cross = (o: XY, a: XY, b: XY): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (monotone chain), counter-clockwise; fewer than 3 distinct points come back as they are. */
export function convexHull(pts: readonly XY[]): XY[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const build = (list: readonly XY[]): XY[] => {
    const h: XY[] = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...build(p), ...build([...p].reverse())];
}

/**
 * Numbered points with rounded outlines around clusters: the outline is the convex hull drawn with
 * a thick round-joined stroke, so one path gives a soft capsule or blob for two or more points.
 */
export class ScatterLayer {
  private readonly root: G;
  private readonly gHulls: G;
  private readonly gPoints: G;
  private readonly gSel: G;
  private rect: Rect = { left: 0, top: 0, width: 100, height: 100 };
  private scales: Scales;
  private last: ScatterSpec | null = null;
  private fsCache: number | null = null;

  constructor(parent: SVGGElement, private readonly domain: Domain) {
    this.root = select(parent).append('g').attr('class', 'dg-scatter-layer') as unknown as G;
    this.gHulls = this.root.append('g').attr('class', 'dg-hulls') as unknown as G;
    this.gPoints = this.root.append('g').attr('class', 'dg-points') as unknown as G;
    this.gSel = this.root.append('g').attr('class', 'dg-sel-g') as unknown as G;
    this.scales = fitEqualAspect(domain, this.rect);
  }

  resize(rect: Rect): void {
    this.rect = rect;
    this.fsCache = null;
    this.scales = fitEqualAspect(this.domain, rect);
    if (this.last) this.update(this.last, false);
  }

  update(s: ScatterSpec, animate: boolean): void {
    this.last = s;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = animate && !reduce ? MS : 0;
    const go = <S extends AnySel>(sel: S): S => (ms > 0 ? tr(sel, TR, ms) : (sel.interrupt(TR) as S));
    const { x, y } = this.scales;
    const px = (p: Pt): number => r1(x(p[0]));
    const py = (p: Pt): number => r1(y(p[1]));
    const merged = new Set(s.merged);

    // rounded outlines
    const hulls = this.gHulls.selectAll<SVGPathElement, Hull>('path.dg-hull').data(s.hulls);
    hulls.exit().remove();
    const hBorn = hulls.enter().append('path').attr('class', 'dg-hull').attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
    (hBorn.merge(hulls as never) as unknown as Selection<SVGPathElement, Hull, SVGGElement, unknown>)
      .attr('data-kind', (h) => h.kind)
      .attr('data-merge', (h) => (h.merge === undefined ? null : h.merge))
      .attr('fill', (h) => h.colour).attr('stroke', (h) => h.colour)
      .attr('stroke-width', (h) => (h.kind === 'merge' ? 2 * PAD + 4 : 2 * PAD))
      .attr('opacity', (h) => (h.kind === 'merge' ? 0.3 : h.kind === 'cluster' ? 0.16 : 0.12))
      .attr('d', (h) => {
        const hull = convexHull(h.members.map((i) => [px(s.points[i]), py(s.points[i])] as const));
        return hull.length === 0 ? '' : `M${hull.map((q) => `${q[0]},${q[1]}`).join('L')}${hull.length > 2 ? 'Z' : hull.length === 1 ? `L${hull[0][0]},${hull[0][1]}` : ''}`;
      });

    // points
    const pts = this.gPoints.selectAll<SVGGElement, Pt>('g.dg-point').data(s.points as Pt[]);
    pts.exit().remove();
    const born = pts.enter().append('g').attr('class', 'dg-point');
    born.append('circle').attr('r', R).attr('stroke', WHITE).attr('stroke-width', 1.2);
    born.append('text').attr('class', 'dg-num').attr('font-weight', 700).attr('fill', NAVY)
      .attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke').attr('font-size', LABEL_FALLBACK_PX);
    const all = born.merge(pts as never) as unknown as Sel<Pt>;
    all.attr('transform', (d) => `translate(${px(d)},${py(d)})`)
      .attr('data-i', (_d, i) => i)
      .attr('data-cluster', (_d, i) => (s.label && s.label[i] >= 0 ? String(s.label[i]) : '-'))
      .attr('data-merged', (_d, i) => (merged.has(i) ? 'true' : 'false'));
    const fill = (i: number): string => (merged.has(i) ? ACCENT : s.label ? colour(s.label[i]) : UNASSIGNED);
    go(all.select('circle') as unknown as AnySel).attr('fill', (_d: Pt, i: number) => fill(i));

    // number labels: greedy, selected point first, every mark is an obstacle
    const sel = s.selected != null && s.points[s.selected] ? s.selected : null;
    const fs = this.labelFont(all);
    const taken: Box[] = s.points.map((p) => ({ l: px(p) - R - 2, t: py(p) - R - 2, r: px(p) + R + 2, b: py(p) + R + 2 }));
    const area = labelArea(this.rect);
    const order = [...(sel === null ? [] : [sel]), ...s.points.map((_p, i) => i).filter((i) => i !== sel)];
    const place = new Map<number, { dx: number; dy: number; anchor: string }>();
    for (const i of order) {
      const chars = (i === sel ? `Nokta ${i + 1}` : String(i + 1)).length;
      // the label box is registered by chooseOffset; this point's own mark is not an obstacle to it
      const others = taken.filter((_b, j) => j !== i);
      const o = chooseOffset({ x: px(s.points[i]), y: py(s.points[i]), chars, cands: offsets(R + 2, 2, fs), fs, taken: others, area });
      taken.push(others[others.length - 1]);
      place.set(i, o);
    }
    all.select<SVGTextElement>('text')
      .attr('font-size', fs)
      .text((_d, i) => (i === sel ? `Nokta ${i + 1}` : String(i + 1)))
      .attr('x', (_d, i) => place.get(i)!.dx).attr('y', (_d, i) => place.get(i)!.dy)
      .attr('text-anchor', (_d, i) => place.get(i)!.anchor);
    all.select<SVGTextElement>('text').attr('class', (_d, i) => (i === sel ? 'dg-num dg-sel-label' : 'dg-num'));

    // selected ring
    const ring = this.gSel.selectAll<SVGCircleElement, number>('circle.dg-sel').data(sel === null ? [] : [sel]);
    ring.exit().remove();
    ring.enter().append('circle').attr('class', 'dg-sel').attr('fill', 'none').attr('stroke', NAVY)
      .attr('stroke-width', 2.5).attr('r', R + 5)
      .merge(ring as never)
      .attr('data-i', (d) => d as number)
      .attr('cx', (d) => px(s.points[d as number])).attr('cy', (d) => py(s.points[d as number]));
  }

  private labelFont(all: Sel<Pt>): number {
    if (this.fsCache !== null) return this.fsCache;
    const t = all.select<SVGTextElement>('text').node();
    const read = t && typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(t).fontSize) : NaN;
    // the born text carries the fallback inline; prefer the CSS size when the style sheet sets one
    this.fsCache = Number.isFinite(read) && read > 0 ? read : LABEL_FALLBACK_PX;
    return this.fsCache;
  }

  destroy(): void {
    this.root.selectAll('*').interrupt(TR);
    this.root.remove();
    this.last = null;
  }
}
