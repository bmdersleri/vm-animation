import { select, type Selection } from 'd3-selection';
import { CLUSTER, NAVY, NEGATIVE, UNASSIGNED, WHITE, r1 } from './marks';
import { tr } from './transition';
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
const MS = 450;
const colour = (c: number | undefined): string => (c === undefined || c < 0 ? UNASSIGNED : CLUSTER[c % CLUSTER.length]);
const plusPath = (arm: number): string => `M${-arm},0H${arm}M0,${-arm}V${arm}`;

type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<D, E extends Element = SVGGElement> = Selection<E, D, SVGGElement, unknown>;
type Ring = { kind: 'changed' | 'negative' | 'selected'; i: number };
type Trail = { from: Pt; to: Pt };
type Seg = { point: number; center: number; nearest: boolean };

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
    this.gTrails = sub('cs-trails');
    this.gLines = sub('cs-lines');
    this.gPoints = sub('cs-points');
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
    tr(ptsAll, 'cs', ms)
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
    born.append('text').attr('class', 'cs-center-label').attr('x', ARM + 4).attr('y', -ARM)
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', NAVY)
      .attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke');
    const csAll = born.merge(cs as never) as unknown as Sel<Pt>;
    csAll.attr('data-cluster', (_d, i) => i);
    csAll.select('path.cs-plus').attr('stroke', (_d, i) => colour(i));
    csAll.select('text').text((_d, i) => `M${i + 1}`);
    tr(csAll, 'cs', ms).attr('transform', (d: Pt) => `translate(${px(d)},${py(d)})`);

    // trails
    const trailData: Trail[] = [];
    (spec.trails ?? []).forEach((from, i) => { if (centers[i]) trailData.push({ from, to: centers[i] }); });
    const tl = this.gTrails.selectAll<SVGGElement, Trail>('g.cs-trail').data(trailData);
    tl.exit().remove();
    const tlBorn = tl.enter().append('g').attr('class', 'cs-trail').attr('opacity', 0.55);
    tlBorn.append('path').attr('class', 'cs-trail-plus').attr('d', plusPath(5)).attr('fill', 'none')
      .attr('stroke-width', 2).attr('stroke-linecap', 'round');
    tlBorn.append('path').attr('class', 'cs-trail-arrow').attr('fill', 'none').attr('stroke-width', 1.5);
    const tlAll = tlBorn.merge(tl as never) as unknown as Sel<Trail>;
    tlAll.attr('data-cluster', (_d, i) => i);
    tlAll.select('path.cs-trail-plus').attr('stroke', (_d, i) => colour(i))
      .attr('transform', (d: Trail) => `translate(${px(d.from)},${py(d.from)})`);
    tlAll.select('path.cs-trail-arrow').attr('stroke', (_d, i) => colour(i))
      .attr('d', (d: Trail) => arrow(px(d.from), py(d.from), px(d.to), py(d.to)));

    // distance lines: point to every centre
    const segs: Seg[] = [];
    for (const l of spec.lines ?? []) centers.forEach((_c, k) => segs.push({ point: l.point, center: k, nearest: k === l.nearest }));
    const ln = this.gLines.selectAll<SVGLineElement, Seg>('line.cs-line').data(segs);
    ln.exit().remove();
    const lnAll = ln.enter().append('line').attr('class', 'cs-line').merge(ln as never) as unknown as Sel<Seg, SVGLineElement>;
    lnAll.attr('data-point', (d) => d.point).attr('data-center', (d) => d.center)
      .attr('data-nearest', (d) => String(d.nearest))
      .attr('x1', (d) => px(spec.points[d.point])).attr('y1', (d) => py(spec.points[d.point]))
      .attr('x2', (d) => px(centers[d.center])).attr('y2', (d) => py(centers[d.center]))
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
    rgAll.select('circle.cs-ring')
      .attr('data-kind', (d: Ring) => d.kind).attr('data-i', (d: Ring) => d.i)
      .attr('cx', (d: Ring) => px(spec.points[d.i])).attr('cy', (d: Ring) => py(spec.points[d.i]))
      .attr('r', (d: Ring) => (d.kind === 'selected' ? R + 6 : d.kind === 'negative' ? R + 4 : R + 3))
      .attr('stroke', (d: Ring) => (d.kind === 'negative' ? NEGATIVE : NAVY))
      .attr('stroke-width', (d: Ring) => (d.kind === 'changed' ? 1.5 : 2.5))
      .attr('stroke-dasharray', (d: Ring) => (d.kind === 'changed' ? '2 2' : null));
    rgAll.select('text').text((d: Ring) => (d.kind === 'selected' ? `Nokta ${d.i + 1}` : ''))
      .attr('x', (d: Ring) => px(spec.points[d.i]) + R + 8).attr('y', (d: Ring) => py(spec.points[d.i]) - R - 6);
  }

  destroy(): void {
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
