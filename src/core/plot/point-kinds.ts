import { select, type Selection } from 'd3-selection';
import { LABEL_FALLBACK_PX, chooseOffset, labelArea, offsets, type Box } from './label-place';
import { ACCENT, CLUSTER, NAVY, UNASSIGNED, WHITE, r1 } from './marks';
import { tr, type AnySel } from './transition';
import { fitEqualAspect, type Domain, type Rect, type Scales } from './viewport';

/** Same shapes as the Chapter 7 data types; defined here so core does not import from concepts. */
export type Pt = readonly [number, number];
export type Kind = 'core' | 'border' | 'noise';

export interface PointKindsSpec {
  points: readonly Pt[];
  /** null: no point shows a kind (plain dots). */
  kind: readonly Kind[] | null;
  /** Cluster per point, -1 = none; null: every point is UNASSIGNED. */
  label: readonly number[] | null;
  /** With `order`: only order[0..colouredUpTo) show their label colour and kind; the rest are plain grey dots. */
  colouredUpTo?: number;
  order?: readonly number[];
  /** Dashed circle of radius r (data units) around a point. */
  eps?: { center: number; r: number } | null;
  /** Thin navy rings on these points (the selected point itself is skipped). */
  neighbours?: readonly number[];
  /** Dashed accent ring on one point, e.g. the core a border point hangs on. */
  via?: number | null;
  /** Thick navy ring and "Nokta N" label. */
  selected?: number | null;
}

const R = 4;
const ARM = 4;
const MS = 450;
const TR = 'pk';
const CROSS = `M${-ARM},${-ARM}L${ARM},${ARM}M${-ARM},${ARM}L${ARM},${-ARM}`;
const colour = (c: number | undefined): string => (c === undefined || c < 0 ? UNASSIGNED : CLUSTER[c % CLUSTER.length]);
let clipId = 0;

type G = Selection<SVGGElement, unknown, null, undefined>;
type Sel<D, E extends Element = SVGGElement> = Selection<E, D, SVGGElement, unknown>;

/**
 * DBSCAN point kinds: core = filled circle in the cluster colour, border = hollow ring in the
 * cluster colour, noise = grey cross (shape, not colour, carries the kind). Plus the eps circle
 * around one point, thin rings on its neighbours and a labelled ring on the selected point.
 */
export class PointKindsLayer {
  private readonly root: G;
  private readonly gEps: G;
  private readonly gPoints: G;
  private readonly gNbr: G;
  private readonly gSel: G;
  private readonly clip: Selection<SVGRectElement, unknown, null, undefined>;
  private rect: Rect = { left: 0, top: 0, width: 100, height: 100 };
  private scales: Scales;
  private last: PointKindsSpec | null = null;
  private fsCache: number | null = null;

  constructor(parent: SVGGElement, private readonly domain: Domain) {
    this.root = select(parent).append('g').attr('class', 'pk-layer') as unknown as G;
    const id = `pk-clip-${++clipId}`;
    this.clip = this.root.append('clipPath').attr('id', id).append('rect');
    const sub = (c: string): G => this.root.append('g').attr('class', c) as unknown as G;
    this.gEps = sub('pk-eps-g').attr('clip-path', `url(#${id})`);
    this.gPoints = sub('pk-points');
    this.gNbr = sub('pk-nbrs');
    this.gSel = sub('pk-sel-g');
    this.scales = fitEqualAspect(domain, this.rect);
  }

  resize(rect: Rect): void {
    this.rect = rect;
    this.fsCache = null;
    this.scales = fitEqualAspect(this.domain, rect);
    this.clip.attr('x', rect.left).attr('y', rect.top).attr('width', rect.width).attr('height', rect.height);
    if (this.last) this.update(this.last, false);
  }

  update(s: PointKindsSpec, animate: boolean): void {
    this.last = s;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = animate && !reduce ? MS : 0;
    const go = <S extends AnySel>(sel: S): S => (ms > 0 ? tr(sel, TR, ms) : (sel.interrupt(TR) as S));
    const { x, y } = this.scales;
    const px = (p: Pt): number => r1(x(p[0]));
    const py = (p: Pt): number => r1(y(p[1]));

    // Points that have been reached show their kind and colour; the rest stay plain grey dots.
    const reached = s.order && s.colouredUpTo !== undefined ? new Set(s.order.slice(0, Math.max(0, s.colouredUpTo))) : null;
    const shownKind = (i: number): Kind | null => (s.kind && (!reached || reached.has(i)) ? s.kind[i] : null);
    const shownLabel = (i: number): number => (s.label && (!reached || reached.has(i)) ? s.label[i] : -1);

    // points
    const pts = this.gPoints.selectAll<SVGGElement, Pt>('g.pk-point').data(s.points as Pt[]);
    pts.exit().remove();
    const born = pts.enter().append('g').attr('class', 'pk-point');
    born.append('circle').attr('r', R);
    born.append('path').attr('d', CROSS).attr('fill', 'none').attr('stroke-width', 2).attr('stroke-linecap', 'round');
    const all = born.merge(pts as never) as unknown as Sel<Pt>;
    all.attr('transform', (d) => `translate(${px(d)},${py(d)})`)
      .attr('data-i', (_d, i) => i)
      .attr('data-kind', (_d, i) => shownKind(i) ?? '-')
      .attr('data-cluster', (_d, i) => { const c = shownLabel(i); return c < 0 ? '-' : String(c); });
    const circle = all.select<SVGCircleElement>('circle');
    const cross = all.select<SVGPathElement>('path');
    circle.attr('display', (_d, i) => (shownKind(i) === 'noise' ? 'none' : null));
    cross.attr('display', (_d, i) => (shownKind(i) === 'noise' ? null : 'none')).attr('stroke', UNASSIGNED);
    const border = (i: number): boolean => shownKind(i) === 'border';
    go(circle)
      .attr('fill', (_d: Pt, i: number) => (border(i) ? WHITE : colour(shownLabel(i))))
      .attr('stroke', (_d: Pt, i: number) => (border(i) ? colour(shownLabel(i)) : WHITE))
      .attr('stroke-width', (_d: Pt, i: number) => (border(i) ? 2 : 0.8));

    // eps circle: the radius in px is the same on both axes (equal aspect)
    const e = s.eps && s.points[s.eps.center] ? s.eps : null;
    const eps = this.gEps.selectAll<SVGCircleElement, NonNullable<typeof e>>('circle.pk-eps').data(e ? [e] : []);
    eps.exit().remove();
    eps.enter().append('circle').attr('class', 'pk-eps').attr('fill', NAVY).attr('fill-opacity', 0.08)
      .attr('stroke', NAVY).attr('stroke-width', 2).attr('stroke-dasharray', '6 4')
      .merge(eps as never)
      .attr('cx', (d) => px(s.points[(d as NonNullable<typeof e>).center]))
      .attr('cy', (d) => py(s.points[(d as NonNullable<typeof e>).center]))
      .attr('r', (d) => r1(Math.abs(x((d as NonNullable<typeof e>).r) - x(0))))
      .attr('data-r', (d) => (d as NonNullable<typeof e>).r);

    // neighbour rings
    const nbr = (s.neighbours ?? []).filter((i) => s.points[i] && i !== s.selected);
    const nb = this.gNbr.selectAll<SVGCircleElement, number>('circle.pk-nbr').data(nbr);
    nb.exit().remove();
    nb.enter().append('circle').attr('class', 'pk-nbr').attr('fill', 'none').attr('stroke', NAVY)
      .attr('stroke-width', 1.2).attr('r', R + 3)
      .merge(nb as never)
      .attr('data-i', (d) => d as number)
      .attr('cx', (d) => px(s.points[d as number])).attr('cy', (d) => py(s.points[d as number]));

    // via + selected
    const via = s.via != null && s.points[s.via] ? [s.via] : [];
    const vi = this.gSel.selectAll<SVGCircleElement, number>('circle.pk-via').data(via);
    vi.exit().remove();
    vi.enter().append('circle').attr('class', 'pk-via').attr('fill', 'none').attr('stroke', ACCENT)
      .attr('stroke-width', 2.5).attr('stroke-dasharray', '3 2').attr('r', R + 5)
      .merge(vi as never)
      .attr('data-i', (d) => d as number)
      .attr('cx', (d) => px(s.points[d as number])).attr('cy', (d) => py(s.points[d as number]));

    const sel = s.selected != null && s.points[s.selected] ? [s.selected] : [];
    const sg = this.gSel.selectAll<SVGGElement, number>('g.pk-sel-item').data(sel);
    sg.exit().remove();
    const sBorn = sg.enter().append('g').attr('class', 'pk-sel-item');
    sBorn.append('circle').attr('class', 'pk-sel').attr('fill', 'none').attr('stroke', NAVY)
      .attr('stroke-width', 2.5).attr('r', R + 6);
    sBorn.append('text').attr('class', 'pk-sel-label').attr('font-size', LABEL_FALLBACK_PX).attr('font-weight', 700)
      .attr('fill', NAVY).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke');
    const sAll = sBorn.merge(sg as never) as unknown as Sel<number>;
    sAll.select('circle.pk-sel').attr('data-i', (d) => d as number)
      .attr('cx', (d) => px(s.points[d as number])).attr('cy', (d) => py(s.points[d as number]));
    sAll.select('text').text((d) => `Nokta ${(d as number) + 1}`);
    this.placeLabel(s, sAll, px, py);
  }

  private labelFont(sAll: Sel<number>): number {
    if (this.fsCache !== null) return this.fsCache;
    const t = sAll.select<SVGTextElement>('text').node();
    const read = t && typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(t).fontSize) : NaN;
    this.fsCache = Number.isFinite(read) && read > 0 ? read : LABEL_FALLBACK_PX;
    return this.fsCache;
  }

  /** The selected label takes the first offset that stays inside the plot and off the mark. */
  private placeLabel(s: PointKindsSpec, sAll: Sel<number>, px: (p: Pt) => number, py: (p: Pt) => number): void {
    if (sAll.empty()) return;
    const i = s.selected as number;
    const fs = this.labelFont(sAll);
    const cx = px(s.points[i]);
    const cy = py(s.points[i]);
    const half = R + 6;
    const taken: Box[] = [{ l: cx - half, t: cy - half, r: cx + half, b: cy + half }];
    if (s.via != null && s.points[s.via]) {
      const vx = px(s.points[s.via]);
      const vy = py(s.points[s.via]);
      taken.push({ l: vx - half, t: vy - half, r: vx + half, b: vy + half });
    }
    const o = chooseOffset({
      x: cx, y: cy, chars: `Nokta ${i + 1}`.length, cands: offsets(R + 6, 4, fs), fs, taken, area: labelArea(this.rect),
    });
    sAll.select('text').attr('x', cx + o.dx).attr('y', cy + o.dy).attr('text-anchor', o.anchor);
  }

  destroy(): void {
    this.root.selectAll('*').interrupt(TR);
    this.root.remove();
    this.last = null;
  }
}
