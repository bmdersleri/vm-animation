import { select, type BaseType, type Selection } from 'd3-selection';
import { CLUSTER, NAVY, NEGATIVE, UNASSIGNED, WHITE, r1 } from './marks';
import { tr, type AnySel } from './transition';
import { fitEqualAspect, type Domain, type Rect, type Scales } from './viewport';

/** Same shape as the Chapter 7 data type; defined here so core does not import from concepts. */
export type Pt = readonly [number, number];

export interface ClusterScatterSpec {
  points: readonly Pt[];
  /** null: every point is UNASSIGNED. */
  labels: readonly number[] | null;
  /** Plus marker + 'M1'.. label. */
  centers: readonly Pt[] | null;
  /** Previous centre positions (faded plus + arrow to the current centre). */
  trails?: readonly Pt[] | null;
  /** Point to every centre; the nearest one is drawn thick. */
  lines?: readonly { point: number; nearest: number }[];
  changed?: readonly number[];
  negative?: readonly number[];
  selected?: number | null;
}

const R = 4;
const ARM = 7;
const TRAIL_ARM = 6;
const MS = 450;
const colour = (c: number | undefined): string => (c === undefined || c < 0 ? UNASSIGNED : CLUSTER[c % CLUSTER.length]);
const plusPath = (arm: number): string => `M${-arm},0H${arm}M0,${-arm}V${arm}`;

type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<D, E extends Element = SVGGElement> = Selection<E, D, SVGGElement, unknown>;
type Ring = { kind: 'changed' | 'negative' | 'selected'; i: number };
type Trail = { from: Pt; to: Pt };
type Seg = { point: number; center: number; nearest: boolean };
type Box = { l: number; t: number; r: number; b: number };
type Anchor = 'start' | 'middle' | 'end';
type Offset = { dx: number; dy: number; anchor: Anchor };

/** Label width estimate per character, in em (bold sans digits and capitals; errs wide). */
const CHAR_EM = 0.7;
const LABEL_FALLBACK_PX = 12;
const overlap = (p: Box, q: Box): number =>
  Math.max(0, Math.min(p.r, q.r) - Math.max(p.l, q.l)) * Math.max(0, Math.min(p.b, q.b) - Math.max(p.t, q.t));
/** Text box of a label written at (x, y) with the given anchor (y is the baseline). */
function labelBox(x: number, y: number, chars: number, anchor: Anchor, fs: number): Box {
  const w = chars * CHAR_EM * fs;
  const l = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { l: l - 1, t: y - 0.95 * fs - 1, r: l + w + 1, b: y + 0.3 * fs + 1 };
}
/** Label offsets around a mark of half-size `half`, in order of preference: NE, NW, SE, SW, then wider fallbacks. */
function offsets(half: number, gap: number, fs: number): Offset[] {
  const d = half + gap;
  const up = -half;
  const down = half + fs;
  return [
    { dx: d, dy: up, anchor: 'start' }, { dx: -d, dy: up, anchor: 'end' },
    { dx: d, dy: down, anchor: 'start' }, { dx: -d, dy: down, anchor: 'end' },
    { dx: 0, dy: up - gap, anchor: 'middle' }, { dx: 0, dy: down + gap, anchor: 'middle' },
    { dx: d, dy: up - fs, anchor: 'start' }, { dx: -d, dy: up - fs, anchor: 'end' },
    { dx: d, dy: down + fs, anchor: 'start' }, { dx: -d, dy: down + fs, anchor: 'end' },
  ];
}

export class ClusterScatterLayer {
  private readonly root: G;
  private readonly gTrails: G;
  private readonly gLines: G;
  private readonly gPoints: G;
  private readonly gRings: G;
  private readonly gCenters: G;
  private rect: Rect = { left: 0, top: 0, width: 100, height: 100 };
  private scales: Scales;
  private last: ClusterScatterSpec | null = null;

  constructor(parent: SVGGElement, private readonly domain: Domain) {
    this.root = select(parent).append('g').attr('class', 'cs-layer') as unknown as G;
    const sub = (c: string): G => this.root.append('g').attr('class', c) as unknown as G;
    this.gLines = sub('cs-lines');
    this.gPoints = sub('cs-points');
    // Old-centre trails above the dense points so the faded plus stays legible.
    this.gTrails = sub('cs-trails');
    this.gRings = sub('cs-rings');
    this.gCenters = sub('cs-centers');
    this.scales = fitEqualAspect(domain, this.rect);
  }

  resize(rect: Rect): void {
    this.rect = rect;
    this.scales = fitEqualAspect(this.domain, rect);
    if (this.last) this.update(this.last, false);
  }

  update(spec: ClusterScatterSpec, animate: boolean): void {
    this.last = spec;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = animate && !reduce ? MS : 0;
    // Instant writes must also stop a still-running 'cs' transition, or it overwrites them.
    const go = <S extends AnySel>(sel: S): S => (ms > 0 ? tr(sel, 'cs', ms) : (sel.interrupt('cs') as S));
    const { x, y } = this.scales;
    const px = (p: Pt): number => r1(x(p[0]));
    const py = (p: Pt): number => r1(y(p[1]));
    const centers = spec.centers ?? [];

    // points
    const pts = this.gPoints.selectAll<SVGCircleElement, Pt>('circle.cs-point').data(spec.points as Pt[]);
    pts.exit().remove();
    const ptsAll = pts.enter().append('circle').attr('class', 'cs-point').attr('r', R)
      .attr('stroke', WHITE).attr('stroke-width', 0.8)
      .attr('cx', (d) => px(d)).attr('cy', (d) => py(d)).attr('fill', UNASSIGNED)
      .merge(pts as never) as unknown as Sel<Pt, SVGCircleElement>;
    ptsAll.attr('data-i', (_d, i) => i)
      .attr('data-cluster', (_d, i) => {
        const c = spec.labels?.[i];
        return c === undefined || c < 0 ? '-' : String(c);
      });
    go(ptsAll)
      .attr('cx', (d: Pt) => px(d)).attr('cy', (d: Pt) => py(d))
      .attr('fill', (_d: Pt, i: number) => colour(spec.labels?.[i]));

    // centres
    const cs = this.gCenters.selectAll<SVGGElement, Pt>('g.cs-center').data(centers as Pt[]);
    cs.exit().remove();
    const born = cs.enter().append('g').attr('class', 'cs-center')
      .attr('transform', (d) => `translate(${px(d)},${py(d)})`);
    born.append('path').attr('class', 'cs-plus-outline').attr('d', plusPath(ARM)).attr('fill', 'none')
      .attr('stroke', NAVY).attr('stroke-width', 6).attr('stroke-linecap', 'round');
    born.append('path').attr('class', 'cs-plus').attr('d', plusPath(ARM)).attr('fill', 'none')
      .attr('stroke-width', 3).attr('stroke-linecap', 'round');
    born.append('text').attr('class', 'cs-center-label')
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', NAVY)
      .attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke');
    const csAll = born.merge(cs as never) as unknown as Sel<Pt>;
    csAll.attr('data-cluster', (_d, i) => i);
    csAll.select('path.cs-plus').attr('stroke', (_d, i) => colour(i));
    csAll.select('text').text((_d, i) => `M${i + 1}`);
    go(csAll).attr('transform', (d: Pt) => `translate(${px(d)},${py(d)})`);

    // trails
    const trailData: Trail[] = [];
    (spec.trails ?? []).forEach((from, i) => { if (centers[i]) trailData.push({ from, to: centers[i] }); });
    const tl = this.gTrails.selectAll<SVGGElement, Trail>('g.cs-trail').data(trailData);
    tl.exit().remove();
    const tlBorn = tl.enter().append('g').attr('class', 'cs-trail').attr('opacity', 0.75);
    tlBorn.append('path').attr('class', 'cs-trail-outline').attr('d', plusPath(TRAIL_ARM)).attr('fill', 'none')
      .attr('stroke', WHITE).attr('stroke-width', 4).attr('stroke-linecap', 'round');
    tlBorn.append('path').attr('class', 'cs-trail-plus').attr('d', plusPath(TRAIL_ARM)).attr('fill', 'none')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');
    tlBorn.append('path').attr('class', 'cs-trail-arrow').attr('fill', 'none').attr('stroke-width', 2);
    const tlAll = tlBorn.merge(tl as never) as unknown as Sel<Trail>;
    tlAll.attr('data-cluster', (_d, i) => i);
    const trPlus = (sel: AnySel): AnySel => sel.attr('transform', (d: Trail) => `translate(${px(d.from)},${py(d.from)})`);
    const trArrow = (sel: AnySel): AnySel => sel.attr('d', (d: Trail) => arrow(px(d.from), py(d.from), px(d.to), py(d.to)));
    trPlus(tlBorn.select('path.cs-trail-outline'));
    trPlus(tlBorn.select('path.cs-trail-plus'));
    trArrow(tlBorn.select('path.cs-trail-arrow'));
    tlAll.select('path.cs-trail-plus').attr('stroke', (_d, i) => colour(i));
    tlAll.select('path.cs-trail-arrow').attr('stroke', (_d, i) => colour(i));
    trPlus(go(tlAll.select('path.cs-trail-outline')));
    trPlus(go(tlAll.select('path.cs-trail-plus')));
    trArrow(go(tlAll.select('path.cs-trail-arrow')));

    // distance lines: point to every centre
    const segs: Seg[] = [];
    for (const l of spec.lines ?? []) if (spec.points[l.point]) centers.forEach((_c, k) => segs.push({ point: l.point, center: k, nearest: k === l.nearest }));
    const ln = this.gLines.selectAll<SVGLineElement, Seg>('line.cs-line').data(segs);
    ln.exit().remove();
    const place = (sel: AnySel): AnySel => sel
      .attr('x1', (d: Seg) => px(spec.points[d.point])).attr('y1', (d: Seg) => py(spec.points[d.point]))
      .attr('x2', (d: Seg) => px(centers[d.center])).attr('y2', (d: Seg) => py(centers[d.center]));
    const lnBorn = ln.enter().append('line').attr('class', 'cs-line');
    place(lnBorn);
    const lnAll = lnBorn.merge(ln as never) as unknown as Sel<Seg, SVGLineElement>;
    place(go(lnAll));
    lnAll.attr('data-point', (d) => d.point).attr('data-center', (d) => d.center)
      .attr('data-nearest', (d) => String(d.nearest))
      .attr('stroke', (d) => (d.nearest ? NAVY : UNASSIGNED))
      .attr('stroke-width', (d) => (d.nearest ? 2.5 : 1))
      .attr('stroke-dasharray', (d) => (d.nearest ? null : '3 3'))
      .attr('opacity', (d) => (d.nearest ? 0.9 : 0.6));

    // rings (one point can carry several kinds)
    const rings: Ring[] = [
      ...(spec.changed ?? []).map((i): Ring => ({ kind: 'changed', i })),
      ...(spec.negative ?? []).map((i): Ring => ({ kind: 'negative', i })),
      ...(spec.selected != null ? [{ kind: 'selected', i: spec.selected } as Ring] : []),
    ].filter((r) => spec.points[r.i]);
    const rg = this.gRings.selectAll<SVGGElement, Ring>('g.cs-ring-g').data(rings);
    rg.exit().remove();
    const rgBorn = rg.enter().append('g').attr('class', 'cs-ring-g');
    rgBorn.append('circle').attr('class', 'cs-ring').attr('fill', 'none');
    rgBorn.append('text').attr('class', 'cs-ring-label').attr('font-size', 12).attr('font-weight', 700)
      .attr('fill', NAVY).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke');
    const rgAll = rgBorn.merge(rg as never) as unknown as Sel<Ring>;
    const ringPos = (sel: AnySel): AnySel => sel
      .attr('cx', (d: Ring) => px(spec.points[d.i])).attr('cy', (d: Ring) => py(spec.points[d.i]));
    ringPos(rgBorn.select('circle.cs-ring'));
    ringPos(go(rgAll.select('circle.cs-ring')));
    rgAll.select('circle.cs-ring')
      .attr('data-kind', (d: Ring) => d.kind).attr('data-i', (d: Ring) => d.i)
      .attr('r', (d: Ring) => (d.kind === 'selected' ? R + 6 : d.kind === 'negative' ? R + 4 : R + 3))
      .attr('stroke', (d: Ring) => (d.kind === 'negative' ? NEGATIVE : NAVY))
      .attr('stroke-width', (d: Ring) => (d.kind === 'changed' ? 1.5 : 2.5))
      .attr('stroke-dasharray', (d: Ring) => (d.kind === 'changed' ? '2 2' : null));
    rgAll.select('text').text((d: Ring) => (d.kind === 'selected' ? `Nokta ${d.i + 1}` : ''));

    this.placeLabels(spec, centers, csAll, rgAll, go, px, py);
  }

  /**
   * Greedy label placement at the target positions: each centre label (in index order), then the
   * selected-point label, takes the first offset whose box covers no centre's plus, no label placed
   * before it and nothing outside the plot area; if every offset collides, the least-covering one.
   */
  private placeLabels(
    spec: ClusterScatterSpec, centers: readonly Pt[], csAll: Sel<Pt>, rgAll: Sel<Ring>,
    go: <S extends AnySel>(sel: S) => S, px: (p: Pt) => number, py: (p: Pt) => number,
  ): void {
    const first = csAll.select<SVGTextElement>('text').node() ?? rgAll.select<SVGTextElement>('text').node();
    const read = first && typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(first).fontSize) : NaN;
    const fs = Number.isFinite(read) && read > 0 ? read : LABEL_FALLBACK_PX;
    const half = ARM + 2;
    const taken: Box[] = centers.map((c) => ({ l: px(c) - half, t: py(c) - half, r: px(c) + half, b: py(c) + half }));
    const m = 6;
    const area: Box = { l: this.rect.left - m, t: this.rect.top - m, r: this.rect.left + this.rect.width + m, b: this.rect.top + this.rect.height + m };
    const outside = (b: Box): number => (b.r - b.l) * (b.b - b.t) - overlap(b, area);
    const choose = (x: number, y: number, chars: number, cands: Offset[]): Offset => {
      let best = cands[0];
      let bestCost = Infinity;
      let bestBox: Box | null = null;
      for (const o of cands) {
        const box = labelBox(x + o.dx, y + o.dy, chars, o.anchor, fs);
        const cost = taken.reduce((sum, t) => sum + overlap(box, t), 0) + outside(box);
        if (cost < bestCost) { best = o; bestCost = cost; bestBox = box; }
        if (cost === 0) break;
      }
      if (bestBox) taken.push(bestBox);
      return best;
    };
    const centreCands = offsets(ARM, 4, fs);
    const placed = centers.map((c, i) => choose(px(c), py(c), `M${i + 1}`.length, centreCands));
    csAll.select('text').attr('x', (_d, i) => placed[i]?.dx ?? ARM + 4).attr('y', (_d, i) => placed[i]?.dy ?? -ARM)
      .attr('text-anchor', (_d, i) => placed[i]?.anchor ?? 'start');

    const sel = spec.selected;
    const ringOff: Offset = sel != null && spec.points[sel]
      ? choose(px(spec.points[sel]), py(spec.points[sel]), `Nokta ${sel + 1}`.length, offsets(R + 4, 4, fs))
      : { dx: R + 8, dy: -R - 6, anchor: 'start' };
    const off = (d: Ring): Offset => (d.kind === 'selected' ? ringOff : { dx: R + 8, dy: -R - 6, anchor: 'start' });
    const texts = rgAll.select('text');
    const at = (t: AnySel): AnySel => t
      .attr('x', (d: Ring) => px(spec.points[d.i]) + off(d).dx).attr('y', (d: Ring) => py(spec.points[d.i]) + off(d).dy);
    texts.attr('text-anchor', (d: Ring) => off(d).anchor);
    at(texts.filter(function (this: BaseType) { return !(this as Element).hasAttribute('x'); }));
    at(go(texts));
  }

  destroy(): void {
    this.root.selectAll('*').interrupt('cs');
    this.root.remove();
    this.last = null;
  }
}

/** Shaft + open arrowhead from (x1,y1) to (x2,y2); empty when the points coincide. */
function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(6, len / 2);
  const c = Math.cos(0.5);
  const s = Math.sin(0.5);
  const wing = (k: number): string => `${r1(x2 - h * (ux * c + k * uy * s))},${r1(y2 - h * (uy * c - k * ux * s))}`;
  return `M${r1(x1)},${r1(y1)}L${r1(x2)},${r1(y2)}M${wing(1)}L${r1(x2)},${r1(y2)}L${wing(-1)}`;
}
