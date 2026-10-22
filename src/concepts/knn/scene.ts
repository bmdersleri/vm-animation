import { select } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import type { RawPoint } from './data';
import type { Neighbor } from './knn';
import type { KnnParams } from './scenario';
import type { FeatureSpace } from './space';
import { deriveKnnView, type KnnView } from './view';
import { fitViewport, type Domain, type Scales } from '../../core/plot/viewport';
import { REGION_ALPHA, RegionsLayer } from './scene-regions';
import { placeBadges, placeQueryLabel, type P } from './scene-labels';
import { computeLayout, voteLabel, type Layout } from './scene-layout';
import { AxesLayer } from '../../core/plot/axes';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { GRID, MARK, NAVY, TEXT, WHITE, r1, trianglePath } from '../../core/plot/marks';
import { boundaryShape, lerpShape, shapePath, type Shape } from './scene-shapes';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MS_STEP = 450;
const MS_DOMAIN = 900;
const MS_SWEEP = 250;
const MS_FADE = 250;
const NAMES = ['axes', 'pts', 'lines', 'boundary', 'ranks', 'query', 'vote'] as const;

export type PointerKind = 'down' | 'move' | 'up';
export type KnnSceneHandle = SceneHandle & {
  onPointer(cb: (raw: RawPoint, kind: PointerKind) => void): void;
  /**
   * Feature-space extent of the plot rect as last drawn (the scale domains,
   * which for equal-aspect spaces can be wider than the data domain), or null
   * before the first draw.
   */
  visibleDomain(): Domain | null;
};

interface Pt { i: number; x: number; y: number }
interface Rank { r: number; i: number; x: number; y: number }

function onlyQueryChanged(a: KnnParams, b: KnnParams): boolean {
  for (const k of Object.keys(b) as (keyof KnnParams)[]) if (k !== 'query' && a[k] !== b[k]) return false;
  return true;
}

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };
let uid = 0;

export function mountKnnScene(
  el: HTMLElement, player: StepPlayer<KnnParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): KnnSceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'regions';
  const svgEl = doc.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('class', 'plot knn-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', 'k-NN saçılım grafiği');
  el.append(canvas, svgEl);

  const regions = new RegionsLayer(canvas, REGION_ALPHA[initialMode]);
  const svg = select(svgEl);
  const clipId = `knn-clip-${++uid}`;
  const clipRect = svg.append('defs').append('clipPath').attr('id', clipId).append('rect');
  const gAxes = svg.append('g').attr('class', 'axes');
  const axes = new AxesLayer(gAxes);
  const hit = svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
  const gClip = svg.append('g').attr('class', 'clipped').attr('clip-path', `url(#${clipId})`).attr('pointer-events', 'none');
  const gLines = gClip.append('g').attr('class', 'lines');
  const gPts = svg.append('g').attr('class', 'points').attr('pointer-events', 'none');
  const gRanks = svg.append('g').attr('class', 'ranks').attr('pointer-events', 'none');
  const gQuery = svg.append('g').attr('class', 'query-layer').attr('pointer-events', 'none');
  const gVoteLayer = svg.append('g').attr('class', 'vote-layer');
  const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  const measure = new TextMeasure(probe.node()!);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let layout: Layout | null = null;
  let layoutKey = '';
  let scales: Scales | null = null;
  let space: FeatureSpace | null = null;
  let pts: Pt[] = [];
  let lastParams: KnnParams | null = null;
  let lastIndex = -1;
  let lastPhase = -1;
  let rendered = false;
  let busyUntil = 0; // transitions may be running until this time (ms, performance.now)
  let axesKey = '';
  let shapeNow: Shape | null = null;
  let pending: { s: PlayerState<KnnParams>; cause: ChangeCause } | null = null;
  let queryLabelPick = 0; // last chosen query-label spot (kept on ties: no flicker while dragging)
  let rafId: number | null = null;

  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function interruptAll(): void {
    for (const n of NAMES) svg.selectAll('*').interrupt(n);
    select(canvas).interrupt('regions');
  }

  // ---------------------------------------------------------------- render
  function render(state: PlayerState<KnnParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const v = deriveKnnView(state.index, state.params);
    const key = `${size.w}x${size.h}|${mode}|${v.space.dataset}|${v.space.scaled}|${v.weighting}`;
    if (key !== layoutKey || !layout) {
      layout = computeLayout(size.w, size.h, mode, v.space, v.weighting, measure);
      layoutKey = key;
    }
    const L = layout;
    const sc = fitViewport(v.space.domain, L.plot, v.space.scaled);
    const spaceChanged = space !== null && space !== v.space;
    if (space !== v.space) pts = v.space.points.map((p, i) => ({ i, x: p.x, y: p.y }));
    const queryOnly = cause === 'param' && lastParams !== null && state.index === lastIndex
      && onlyQueryChanged(lastParams, state.params);
    let ms = 0;
    if (ds > 0 && !instant && !queryOnly) {
      ms = spaceChanged ? MS_DOMAIN * ds : cause === 'sweep' ? MS_SWEEP * ds : MS_STEP * ds;
    }
    const interrupted = now() < busyUntil;
    if (interrupted) interruptAll();
    // stagger delays below add at most ~600 ms × ds
    busyUntil = ms > 0 ? now() + ms + 700 * ds + MS_FADE * ds : busyUntil;

    // axes depend only on layout and scales: skip them on drag frames
    const ak = `${layoutKey}|${sc.x.domain()}|${sc.y.domain()}`;
    if (ak !== axesKey || interrupted || ms > 0) {
      drawAxes(v, sc, L, ms);
      axesKey = ak;
    }
    drawLines(v, sc, ms);
    drawBoundary(v, sc, ms);
    drawPoints(v, sc, L, ms);
    const ranks = rankBadges(v, sc, L);
    drawRanks(ranks, L, ms);
    drawQuery(v, sc, L, ranks, ms);
    drawVote(v, L, ms);

    regions.update(v, sc, L.plot);
    const c = select(canvas);
    if (spaceChanged && ms > 0) {
      c.style('opacity', '0').transition('regions').delay(ms).duration(MS_FADE * ds).style('opacity', '1');
    } else c.style('opacity', '1');

    scales = sc;
    space = v.space;
    lastParams = state.params;
    lastIndex = state.index;
    lastPhase = v.phase;
    rendered = true;
  }

  function drawAxes(v: KnnView, sc: Scales, L: Layout, ms: number): void {
    const { plot } = L;
    clipRect.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    hit.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    axes.draw(sc, plot, L, ms, `${v.space.dataset}${v.space.scaled}`);
  }

  function drawLines(v: KnnView, sc: Scales, ms: number): void {
    const data: Neighbor[] = v.showLines === 'all' ? v.distances : v.showLines === 'neighbors' ? v.neighbors : [];
    const qx = r1(sc.x(v.query.x));
    const qy = r1(sc.y(v.query.y));
    const all = v.showLines === 'all';
    const sel = gLines.selectAll<SVGLineElement, Neighbor>('line.dist').data(data, (d) => d.index).join(
      (enter) => enter.append('line').attr('class', 'dist').attr('stroke', NAVY)
        .attr('x1', qx).attr('y1', qy).attr('x2', qx).attr('y2', qy),
      (update) => update,
      (exit) => { tr(exit, 'lines', ms).attr('opacity', 0).remove(); },
    );
    const grow = all && lastPhase < 2 && ms > 0;
    tr(sel, 'lines', ms, grow ? (_d, i) => i * 6 * ds : undefined)
      .attr('x1', qx).attr('y1', qy)
      .attr('x2', (d) => r1(sc.x(pts[d.index].x)))
      .attr('y2', (d) => r1(sc.y(pts[d.index].y)))
      .attr('opacity', 1)
      .attr('stroke-opacity', all ? 0.3 : 0.6)
      .attr('stroke-width', all ? 1.5 : 2);
  }

  function drawBoundary(v: KnnView, sc: Scales, ms: number): void {
    const show = v.phase >= 3 && v.showQuery;
    let isNew = false;
    const sel = gClip.selectAll<SVGPathElement, number>('path.boundary').data(show ? [0] : []).join(
      (enter) => {
        isNew = !enter.empty();
        return enter.insert('path', ':first-child').attr('class', 'boundary')
          .attr('fill', NAVY).attr('fill-opacity', 0.05)
          .attr('stroke', NAVY).attr('stroke-opacity', 0.55).attr('stroke-width', 2).attr('stroke-dasharray', '7 6');
      },
      (update) => update,
      (exit) => { tr(exit, 'boundary', ms).attr('opacity', 0).remove(); },
    );
    if (!show) return;
    const cx = sc.x(v.query.x);
    const cy = sc.y(v.query.y);
    const rx = Math.abs(sc.x(v.radius) - sc.x(0));
    const ry = Math.abs(sc.y(0) - sc.y(v.radius));
    const target = boundaryShape(v.metric, cx, cy, rx, ry);
    if (ms <= 0) {
      sel.attr('d', shapePath(target)).attr('opacity', 1);
      shapeNow = target;
      return;
    }
    const from = isNew || !shapeNow ? { ...target, rx: 0, ry: 0 } : shapeNow;
    sel.attr('opacity', 1).transition('boundary').duration(ms).ease(easeCubicInOut)
      .attrTween('d', () => (t) => {
        const s = t >= 1 ? target : lerpShape(from, target, t);
        shapeNow = s;
        return shapePath(s);
      });
  }

  function drawPoints(v: KnnView, sc: Scales, L: Layout, ms: number): void {
    const nb = v.phase >= 3 ? new Set(v.neighbors.map((n) => n.index)) : null;
    const isNb = (d: Pt): boolean => nb !== null && nb.has(d.i);
    const pos = (d: Pt): string => `translate(${r1(sc.x(d.x))},${r1(sc.y(d.y))})`;
    const labels = v.space.labels;
    const join = <E extends SVGElement>(tag: 'circle' | 'path', cls: 0 | 1) =>
      gPts.selectAll<E, Pt>(`${tag}.pt`).data(pts.filter((d) => labels[d.i] === cls), (d) => d.i).join(
        (enter) => enter.append<E>(tag).attr('class', cls ? 'pt ayrildi' : 'pt kaldi')
          .attr('data-i', (d) => d.i).attr('fill', MARK[cls]).attr('transform', pos).attr('opacity', 0),
      );
    const circles = join<SVGCircleElement>('circle', 0).attr('r', L.ptR);
    const tris = join<SVGPathElement>('path', 1).attr('d', trianglePath(L.ptR));
    for (const s of [circles, tris] as AnySel[]) {
      tr(s, 'pts', ms)
        .attr('transform', pos)
        .attr('opacity', (d: Pt) => (nb && !isNb(d) ? 0.35 : 1))
        .attr('stroke', (d: Pt) => (isNb(d) ? NAVY : WHITE))
        .attr('stroke-width', (d: Pt) => (isNb(d) ? 2.5 : 1));
    }
  }

  /** Rank badge centres (px) for the k neighbours, placed away from the query and from each other. */
  /** Offset (px, from its point) of each badge in the last frame, by point index. */
  const badgeOffsets = new Map<number, P>();

  function rankBadges(v: KnnView, sc: Scales, L: Layout): Rank[] {
    if (v.phase < 3) {
      badgeOffsets.clear();
      return [];
    }
    const at = v.neighbors.map((n): P => ({ x: sc.x(pts[n.index].x), y: sc.y(pts[n.index].y) }));
    const q = { x: sc.x(v.query.x), y: sc.y(v.query.y) };
    const off = (L.ptR * 0.7 + L.badgeR * 0.75) * Math.SQRT2;
    // each badge starts from the offset it had on its own point last frame (keyed by point, not by rank)
    const pos = placeBadges(at, q, off, L.badgeR, (L.querySide * Math.SQRT2) / 2, L.ptR, v.neighbors.map((n) => badgeOffsets.get(n.index)));
    badgeOffsets.clear();
    v.neighbors.forEach((n, r) => badgeOffsets.set(n.index, { x: pos[r].x - at[r].x, y: pos[r].y - at[r].y }));
    return v.neighbors.map((n, r) => ({ r: r + 1, i: n.index, x: pos[r].x, y: pos[r].y }));
  }

  function drawRanks(data: Rank[], L: Layout, ms: number): void {
    const pos = (d: Rank): string => `translate(${r1(d.x)},${r1(d.y)})`;
    const sel = gRanks.selectAll<SVGGElement, Rank>('g.rank').data(data, (d) => d.i).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'rank').attr('opacity', 0).attr('transform', pos);
        g.append('circle').attr('fill', NAVY).attr('stroke', WHITE).attr('stroke-width', 1.5);
        g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'ranks', ms).attr('opacity', 0).remove(); },
    );
    sel.select('circle').attr('r', r1(L.badgeR));
    sel.select('text').text((d) => d.r);
    const stagger = ms > 0 && lastPhase < 3 ? Math.min(60, 600 / Math.max(1, data.length)) * ds : 0;
    tr(sel, 'ranks', ms, stagger ? (d: Rank) => (d.r - 1) * stagger : undefined)
      .attr('transform', pos).attr('opacity', 1);
  }

  function drawQuery(v: KnnView, sc: Scales, L: Layout, ranks: Rank[], ms: number): void {
    const qx = r1(sc.x(v.query.x));
    const qy = r1(sc.y(v.query.y));
    const sel = gQuery.selectAll<SVGGElement, number>('g.q').data(v.showQuery ? [0] : []).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'q').attr('opacity', 0).attr('transform', `translate(${qx},${qy})`);
        g.append('rect').attr('class', 'query').attr('transform', 'rotate(45)')
          .attr('stroke', NAVY).attr('stroke-width', 2.5).attr('fill', WHITE);
        g.append('text').attr('class', 'query-label').text('Yeni müşteri');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'query', ms).attr('opacity', 0).remove(); },
    );
    if (!v.showQuery) return;
    const s = L.querySide;
    const half = (s * Math.SQRT2) / 2;
    // the label goes where it covers the fewest rank badges and points
    const label = placeQueryLabel(
      { x: qx, y: qy }, half, L.queryLabelW, L.fonts.tick,
      ranks.map((b) => ({ x: b.x, y: b.y, r: L.badgeR })),
      pts.map((p) => ({ x: sc.x(p.x), y: sc.y(p.y), r: L.ptR })),
      L.plot, queryLabelPick,
    );
    queryLabelPick = label.index;
    sel.select('rect.query').attr('x', r1(-s / 2)).attr('y', r1(-s / 2)).attr('width', r1(s)).attr('height', r1(s));
    sel.select('text.query-label')
      .attr('text-anchor', label.pos.anchor)
      .attr('x', r1(label.pos.x))
      .attr('y', r1(label.pos.y));
    tr(sel, 'query', ms).attr('transform', `translate(${qx},${qy})`).attr('opacity', 1);
    tr(sel.select<SVGRectElement>('rect.query'), 'query', ms)
      .attr('fill', v.prediction ? MARK[v.prediction.cls] : WHITE);
  }

  function drawVote(v: KnnView, L: Layout, ms: number): void {
    const V = L.vote;
    const sel = gVoteLayer.selectAll<SVGGElement, KnnView>('g.vote').data(v.vote && v.prediction ? [v] : []).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'vote').attr('opacity', 0);
        g.append('rect').attr('class', 'track').attr('fill', GRID).attr('rx', 4);
        g.append('rect').attr('class', 'seg kaldi').attr('fill', MARK[0]).attr('rx', 4)
          .attr('x', V.barX).attr('width', 0);
        g.append('rect').attr('class', 'seg ayrildi').attr('fill', MARK[1]).attr('rx', 4)
          .attr('x', V.barX + V.barW).attr('width', 0);
        g.append('text').attr('class', 'vote-label kaldi').attr('fill', TEXT[0]).attr('text-anchor', 'end');
        g.append('text').attr('class', 'vote-label ayrildi').attr('fill', TEXT[1]);
        const p = g.append('text').attr('class', 'prediction');
        p.append('tspan').attr('class', 'pred-head').attr('fill', NAVY).text('Tahmin: ');
        p.append('tspan').attr('class', 'pred-label');
        p.append('tspan').attr('class', 'pred-detail').attr('fill', NAVY);
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'vote', ms).attr('opacity', 0).remove(); },
    );
    if (!v.vote || !v.prediction) return;
    const [s0, s1] = v.vote.scores;
    const total = s0 + s1;
    const w0 = total > 0 ? (V.barW * s0) / total : 0;
    sel.select('rect.track').attr('x', r1(V.barX)).attr('y', r1(V.barY)).attr('width', r1(V.barW)).attr('height', V.barH);
    sel.selectAll('rect.seg').attr('y', r1(V.barY)).attr('height', V.barH);
    tr(sel.select('rect.seg.kaldi'), 'vote', ms).attr('x', r1(V.barX)).attr('width', r1(w0));
    tr(sel.select('rect.seg.ayrildi'), 'vote', ms).attr('x', r1(V.barX + w0)).attr('width', r1(V.barW - w0));
    sel.select('text.vote-label.kaldi').attr('x', r1(V.leftLabelX)).attr('y', r1(V.labelY))
      .text(voteLabel(0, s0, v.weighting));
    sel.select('text.vote-label.ayrildi').attr('x', r1(V.rightLabelX)).attr('y', r1(V.labelY))
      .text(voteLabel(1, s1, v.weighting));
    const p = sel.select('text.prediction').attr('x', r1(V.predX)).attr('y', r1(V.predY))
      .attr('text-anchor', V.predAnchor);
    p.select('tspan.pred-label').attr('fill', TEXT[v.prediction.cls]).text(v.prediction.label);
    const detail = p.select('tspan.pred-detail').text(` (${v.prediction.detail})`);
    if (V.predDetailDy > 0) detail.attr('x', r1(V.predX)).attr('dy', r1(V.predDetailDy));
    else detail.attr('x', null).attr('dy', null);
    tr(sel, 'vote', ms).attr('opacity', 1);
  }

  // ---------------------------------------------------------------- player → render
  function flush(): void {
    rafId = null;
    const p = pending;
    pending = null;
    if (p) render(p.s, p.cause, false);
  }

  const raf = (cb: () => void): number =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
  const cancelRaf = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };

  const unsubscribe = player.subscribe((s, cause) => {
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) flush();
    else if (rafId === null) rafId = raf(flush);
  });

  // ---------------------------------------------------------------- pointer
  const pointerCbs = new Set<(raw: RawPoint, kind: PointerKind) => void>();
  let captured: number | null = null;

  function locate(ev: PointerEvent): { raw: RawPoint; inside: boolean } | null {
    if (!scales || !space || !layout) return null;
    const box = svgEl.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const { plot } = layout;
    const inside = px >= plot.left && px <= plot.left + plot.width && py >= plot.top && py <= plot.top + plot.height;
    return { raw: space.toRaw({ x: scales.x.invert(px), y: scales.y.invert(py) }), inside };
  }
  const emit = (raw: RawPoint, kind: PointerKind): void => { for (const cb of [...pointerCbs]) cb(raw, kind); };

  const onDown = (ev: PointerEvent): void => {
    if (ev.button > 0) return;
    const at = locate(ev);
    if (!at || !at.inside) return;
    captured = ev.pointerId ?? 0;
    try { svgEl.setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
    emit(at.raw, 'down');
  };
  const onMove = (ev: PointerEvent): void => {
    const at = locate(ev);
    if (at && (captured !== null || at.inside)) emit(at.raw, 'move');
  };
  const onUp = (ev: PointerEvent): void => {
    const at = locate(ev);
    const wasCaptured = captured !== null;
    if (wasCaptured) {
      try { svgEl.releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
      captured = null;
    }
    if (at && (wasCaptured || at.inside)) emit(at.raw, 'up');
  };
  const onLost = (): void => { captured = null; };
  svgEl.addEventListener('pointerdown', onDown);
  svgEl.addEventListener('pointermove', onMove);
  svgEl.addEventListener('pointerup', onUp);
  svgEl.addEventListener('pointercancel', onUp);
  svgEl.addEventListener('lostpointercapture', onLost);

  // ---------------------------------------------------------------- handle
  return {
    resize(w: number, h: number): void {
      size = { w, h };
      svg.attr('width', w).attr('height', h);
      regions.resize(w, h);
      layoutKey = '';
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      // the very first draw animates the points in; later resizes are instant
      render(player.state, 'step', rendered);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      layoutKey = '';
      regions.setAlpha(REGION_ALPHA[m]);
      if (size) render(player.state, 'step', true);
    },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      interruptAll();
      svgEl.removeEventListener('pointerdown', onDown);
      svgEl.removeEventListener('pointermove', onMove);
      svgEl.removeEventListener('pointerup', onUp);
      svgEl.removeEventListener('pointercancel', onUp);
      svgEl.removeEventListener('lostpointercapture', onLost);
      pointerCbs.clear();
      canvas.remove();
      svgEl.remove();
    },
    onPointer(cb): void {
      pointerCbs.add(cb);
    },
    visibleDomain(): Domain | null {
      if (!scales) return null;
      const [x0, x1] = scales.x.domain();
      const [y0, y1] = scales.y.domain();
      return { x: [Math.min(x0, x1), Math.max(x0, x1)], y: [Math.min(y0, y1), Math.max(y0, y1)] };
    },
  };
}
