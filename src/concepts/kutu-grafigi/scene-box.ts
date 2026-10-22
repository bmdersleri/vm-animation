import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { diamondPath } from '../../core/plot/dots-path';
import { formatNumber } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, stackLevels, type LineScale } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import type { GroupId } from './data';
import { boxStats, kde, type BoxStats } from './kutu';
import type { GroupView, KutuView } from './view';

/** Base duration of a step's moves, before `durationScale`. */
export const MS_STEP = 450;
/** First step whose groups can be dragged (step 6, `aykiri`), and only in Lab. */
export const DRAG_FROM = 5;
/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'kutu-box';
const SVGNS = 'http://www.w3.org/2000/svg';
/** One shared x scale for every row: the spec's 40–100 mark axis. */
const AXIS_MIN = 40;
const AXIS_MAX = 100;
const TITLE = 'Sınav notu (puan)';
/** The draggable extreme of a group, with the Lab range from the spec. */
interface DragSpec {
  dir: 'min' | 'max';
  min: number;
  max: number;
}
const DRAG: Partial<Record<GroupId, DragSpec>> = {
  bilgisayar: { dir: 'max', min: 60, max: 100 },
  elektrik: { dir: 'min', min: 40, max: 90 },
};

type G = Selection<SVGGElement, unknown, null, undefined>;

interface Lay {
  w: number; h: number;
  tick: number; axis: number;
  pad: number;
  plotL: number; plotR: number;
  titleY: number; axisY: number; tickY: number;
  rowsTop: number; rowsBottom: number;
  dotR: number;
}

/** One group's drawn row: the view's values, the drag override applied and the five-number summary. */
interface RowD {
  id: GroupId;
  name: string;
  color: string;
  /** The view's sorted values (before the drag), for the handle's origin. */
  base: number[];
  /** The drawn values: the dragged observation moved, then sorted again. */
  values: number[];
  stats: BoxStats;
  dots: boolean;
  y: number;
  band: number;
  half: number;
}
interface FenceD { row: RowD; side: 'lo' | 'hi'; value: number }
interface WhiskD { row: RowD; side: 'lo' | 'hi'; from: number; to: number }
interface DotD { row: RowD; value: number; x: number; y: number }
interface OutD { row: RowD; value: number; x: number }
interface VioD { row: RowD; d: string }
interface AltD { row: RowD; stats: BoxStats }
interface ClipD { row: RowD; side: 'lo' | 'hi'; value: number }
interface HandleD { row: RowD; spec: DragSpec; value: number }
interface LinkD { href: string; label: string }

/** Step 8 sends the reader to the deep dive on the same rule. */
const LINK: LinkD = { href: '../iqr-aykiri/', label: 'IQR ve aykırı değer →' };

/** Everything the scene owns outside the view: the step index, k, the drag and the groups drawn. */
export interface LayerState {
  index: number;
  k: number;
  /** The view's groups with the drag applied: exactly what this draw shows. */
  groups: readonly GroupView[];
  dragValues: ReadonlyMap<GroupId, number>;
  dragOrigins: ReadonlyMap<GroupId, number>;
  /** Lab any step, Ders from step 6: the handles are live. */
  dragOn: boolean;
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const extremeOf = (values: readonly number[], dir: DragSpec['dir']): number =>
  dir === 'max' ? Math.max(...values) : Math.min(...values);

/** Up to two decimals with trailing zeros trimmed: "74", "63,5", "106". */
function trim(x: number): string {
  return formatNumber(x, 2).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
}

/** Rows in view order, with the drag-applied groups the scene computed. */
function rowsOf(v: KutuView, st: LayerState): RowD[] {
  return v.groups.map((g) => {
    const eff = st.groups.find((e) => e.id === g.id) ?? g;
    return {
      id: g.id, name: g.name, color: g.color,
      // the handle's origin is the view's own observation, never the dragged one
      base: g.values, values: eff.values, stats: eff.stats, dots: g.dots,
      y: 0, band: 0, half: 0,
    };
  });
}

/**
 * The plot of the `kutu-grafigi` page: one shared 40–100 mark axis on top and
 * one horizontal row per group below it, with the whiskers, the dashed fences,
 * the quartile box, the median, the raw dots and the hollow outlier diamonds.
 * Every node keeps its key, so a row that moves is the same node; `rect.box`
 * exists from the first draw with opacity 0 and only shows from step 4, so a
 * READY selector can rely on it at every step. `update(v, st, ms)` moves what
 * changed over `ms` (0 = instantly). Text sizes come from the CSS tokens only.
 */
export class BoxLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly nl: NumberLineLayer;
  private readonly measure: TextMeasure;
  private readonly gViolin: G;
  private readonly gFence: G;
  private readonly gAlt: G;
  private readonly gWhisk: G;
  private readonly gBox: G;
  private readonly gMedian: G;
  private readonly gDots: G;
  private readonly gOutlier: G;
  private readonly gLabel: G;
  private readonly gLink: G;
  private readonly gDrag: G;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: KutuView | null = null;
  private state: LayerState | null = null;
  private rows: RowD[] = [];
  private lastIndex = -1;
  /** The group being dragged right now; a step change ends it. */
  private dragging: GroupId | null = null;
  private lastDrag: number | null = null;
  /** The current axis domain and px range, for turning a pointer x back into a mark. */
  private inv: { d0: number; d1: number; r0: number; r1: number } | null = null;
  private onDragCb: ((id: GroupId, value: number, origin: number) => void) | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'kutu-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Grupların kutu grafiği');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    const g = (cls: string): G => svg.append('g').attr('class', cls);

    this.nl = new NumberLineLayer(svg.append('g').attr('class', 'axis-layer'));
    this.gViolin = g('violin-layer');
    this.gFence = g('fence-layer');
    this.gAlt = g('fence-alt-layer');
    this.gWhisk = g('whisker-layer');
    this.gBox = g('box-layer');
    this.gMedian = g('median-layer');
    this.gDots = g('dot-layer');
    this.gOutlier = g('outlier-layer');
    this.gLabel = g('label-layer');
    this.gLink = g('link-layer');
    this.gDrag = g('drag-layer');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.mode = mode;
    this.svgEl.setAttribute('width', String(Math.max(1, w)));
    this.svgEl.setAttribute('height', String(Math.max(1, h)));
    this.lay = this.layout(w, h);
    if (this.view && this.state) {
      this.cancel();
      this.draw(this.view, this.state, 0);
    }
  }

  update(v: KutuView, st: LayerState, ms: number): void {
    this.cancel();
    this.view = v;
    this.state = st;
    if (this.lay) this.draw(v, st, ms);
  }

  /** Registers the drag sink: the scene keeps the dragged value, never the params. */
  onDrag(cb: (id: GroupId, value: number, origin: number) => void): void {
    this.onDragCb = cb;
  }

  /** Cancels running transitions so the next draw starts from the settled state. */
  interrupt(): void {
    this.cancel();
  }

  destroy(): void {
    this.cancel();
    this.svgEl.remove();
  }

  private cancel(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('*').interrupt('axes');
  }

  // ------------------------------------------------------------- layout
  private layout(w: number, h: number): Lay {
    const f = this.measure.fonts(this.mode);
    const tick = f.tick;
    const axis = f.axis;
    const pad = Math.max(12, Math.round(tick * 0.7));
    const labelW = Math.round(this.measure.maxWidth(['Bilgisayar', 'Elektrik', 'Makine'], 'group-label', axis));
    // the group labels own the left column; a narrow stage keeps at least 58% for the plot
    const plotL = Math.min(Math.round(w * 0.42), Math.max(Math.round(w * 0.16), labelW + pad + 8));
    const plotR = Math.max(plotL + 60, w - pad - Math.round(tick * 2.2));
    const titleY = Math.round(axis * 1.15);
    const axisY = titleY + Math.round(tick * 0.5 + 8);
    const tickY = axisY + Math.round(tick * 0.95 + 4);
    const rowsTop = tickY + Math.round(tick * 1.5);
    const rowsBottom = Math.max(rowsTop + 60, h - Math.round(tick * 0.9));
    return {
      w, h, tick, axis, pad, plotL, plotR, titleY, axisY, tickY, rowsTop, rowsBottom,
      dotR: Math.max(4, Math.round(tick * 0.32)),
    };
  }

  // ------------------------------------------------------------- draw
  private draw(v: KutuView, st: LayerState, ms: number): void {
    const L = this.lay!;
    // a step change ends any drag that was still open
    if (!st.dragOn || st.index !== this.lastIndex) {
      this.dragging = null;
      this.lastDrag = null;
    }
    this.lastIndex = st.index;

    const rows = rowsOf(v, st);
    const rowH = (L.rowsBottom - L.rowsTop) / Math.max(1, rows.length);
    const band = Math.max(24, rowH * 0.76);
    const half = Math.max(8, Math.min(rowH * 0.24, L.tick * 1.4));
    rows.forEach((r, i) => {
      r.y = L.rowsTop + (i + 0.5) * rowH;
      r.band = band;
      r.half = half;
    });
    this.rows = rows;

    const showMedian = st.index >= 1;
    const showBox = st.index >= 3;
    const showFences = v.fences;
    const showOutliers = st.index >= 5;
    const showViolin = v.showViolin;

    const sc = lineScale({ min: AXIS_MIN, max: AXIS_MAX }, [L.plotL, L.plotR]);
    this.inv = { d0: AXIS_MIN, d1: AXIS_MAX, r0: L.plotL, r1: L.plotR };
    this.nl.draw(
      sc, L.axisY,
      { tickCount: 7, tickY: L.tickY, title: TITLE, titleY: L.titleY },
      ms, 'kutu',
    );

    // ---- violin: the density of the five marks, behind the rest of the row
    const violins: VioD[] = showViolin ? rows.map((row) => ({ row, d: this.violinPath(row, sc) })) : [];
    const vio = this.join(this.gViolin, 'path.violin', violins, (d) => d.row.id, 'path', 'violin');
    vio.all.attr('data-group', (d: VioD) => d.row.id)
      .style('fill', (d: VioD) => d.row.color).style('stroke', (d: VioD) => d.row.color)
      .attr('d', (d: VioD) => d.d);

    // ---- fences: one dashed line per side, from the five-number summary
    const fences: FenceD[] = rows.flatMap((row): FenceD[] => [
      { row, side: 'lo', value: row.stats.lo },
      { row, side: 'hi', value: row.stats.hi },
    ]);
    const fence = this.join(this.gFence, 'line.fence', fences, (d) => `${d.row.id}:${d.side}`, 'line', 'fence');
    fence.all.attr('data-group', (d: FenceD) => d.row.id).attr('data-side', (d: FenceD) => d.side)
      .style('stroke', (d: FenceD) => d.row.color);
    const placeFence = (s: AnySel): void => {
      s.attr('x1', (d: FenceD) => r1(sc(d.value))).attr('x2', (d: FenceD) => r1(sc(d.value)))
        .attr('y1', (d: FenceD) => r1(d.row.y - d.row.band / 2))
        .attr('y2', (d: FenceD) => r1(d.row.y + d.row.band / 2));
    };
    placeFence(fence.enter);
    placeFence(tr(fence.upd, TN, ms));
    this.fade(fence.all, showFences ? 1 : 0, ms);
    this.drawClips(this.gFence, fences.filter((f) => f.value < AXIS_MIN || f.value > AXIS_MAX), false, showFences, ms);

    // ---- step 8: the other k as a secondary, dashed fence pair with a small label
    const otherK = st.k === 1.5 ? 3 : 1.5;
    const alts: AltD[] = showViolin ? rows.map((row) => ({ row, stats: boxStats(row.values, otherK) })) : [];
    const altFences: FenceD[] = alts.flatMap((a): FenceD[] => [
      { row: a.row, side: 'lo', value: a.stats.lo },
      { row: a.row, side: 'hi', value: a.stats.hi },
    ]);
    const alt = this.join(this.gAlt, 'line.fence.alt', altFences, (d) => `${d.row.id}:${d.side}`, 'line', 'fence alt');
    alt.all.attr('data-group', (d: FenceD) => d.row.id).attr('data-side', (d: FenceD) => d.side);
    const placeAlt = (s: AnySel): void => {
      s.attr('x1', (d: FenceD) => r1(sc(d.value))).attr('x2', (d: FenceD) => r1(sc(d.value)))
        .attr('y1', (d: FenceD) => r1(d.row.y - d.row.band / 2))
        .attr('y2', (d: FenceD) => r1(d.row.y + d.row.band / 2));
    };
    placeAlt(alt.enter);
    placeAlt(tr(alt.upd, TN, ms));
    const altLabel = `k = ${formatNumber(otherK, 1)}`;
    const altLabels = this.gAlt.selectAll<SVGTextElement, AltD>('text.fence-alt-label')
      .data(alts, (d) => d.row.id)
      .join(
        (enter) => enter.append('text').attr('class', 'fence-alt-label'),
        (update) => update,
        (exit) => exit.remove(),
      );
    altLabels.text(altLabel)
      .attr('x', (d: AltD) => r1(Math.min(sc(d.stats.hi) + 6, L.w - 8 - this.measure.width(altLabel, 'fence-alt-label', L.tick))))
      .attr('y', (d: AltD) => r1(d.row.y - d.row.band * 0.3));
    this.drawClips(this.gAlt, altFences.filter((f) => f.value < AXIS_MIN || f.value > AXIS_MAX), true, showViolin, ms);

    // ---- whiskers: from the box edge to the outermost observation inside the fence
    const whisks: WhiskD[] = rows.flatMap((row): WhiskD[] => [
      { row, side: 'lo', from: row.stats.q1.value, to: row.stats.wLo },
      { row, side: 'hi', from: row.stats.q3.value, to: row.stats.wHi },
    ]);
    const whisk = this.join(this.gWhisk, 'line.whisker', whisks, (d) => `${d.row.id}:${d.side}`, 'line', 'whisker');
    whisk.all.attr('data-group', (d: WhiskD) => d.row.id).attr('data-side', (d: WhiskD) => d.side)
      .style('stroke', (d: WhiskD) => d.row.color);
    const placeWhisk = (s: AnySel): void => {
      s.attr('x1', (d: WhiskD) => r1(sc(d.from))).attr('x2', (d: WhiskD) => r1(sc(d.to)))
        .attr('y1', (d: WhiskD) => r1(d.row.y)).attr('y2', (d: WhiskD) => r1(d.row.y));
    };
    placeWhisk(whisk.enter);
    placeWhisk(tr(whisk.upd, TN, ms));
    this.fade(whisk.all, showFences ? 1 : 0, ms);

    const cap = Math.min(band / 2, Math.round(L.tick * 0.7));
    const caps = this.join(this.gWhisk, 'line.whisker-cap', whisks, (d) => `${d.row.id}:${d.side}`, 'line', 'whisker-cap');
    caps.all.attr('data-group', (d: WhiskD) => d.row.id).attr('data-side', (d: WhiskD) => d.side)
      .style('stroke', (d: WhiskD) => d.row.color);
    const placeCap = (s: AnySel): void => {
      s.attr('x1', (d: WhiskD) => r1(sc(d.to))).attr('x2', (d: WhiskD) => r1(sc(d.to)))
        .attr('y1', (d: WhiskD) => r1(d.row.y - cap)).attr('y2', (d: WhiskD) => r1(d.row.y + cap));
    };
    placeCap(caps.enter);
    placeCap(tr(caps.upd, TN, ms));
    this.fade(caps.all, showFences ? 1 : 0, ms);

    // ---- box: Q1–Q3, one rect per group
    const box = this.join(this.gBox, 'rect.box', rows, (d) => d.id, 'rect', 'box');
    box.all.attr('data-group', (d: RowD) => d.id)
      .style('fill', (d: RowD) => d.color).style('stroke', (d: RowD) => d.color);
    const placeBox = (s: AnySel): void => {
      s.attr('x', (d: RowD) => r1(sc(d.stats.q1.value)))
        .attr('width', (d: RowD) => r1(Math.max(1, sc(d.stats.q3.value) - sc(d.stats.q1.value))))
        .attr('y', (d: RowD) => r1(d.y - d.half))
        .attr('height', (d: RowD) => r1(2 * d.half));
    };
    placeBox(box.enter);
    placeBox(tr(box.upd, TN, ms));
    this.fade(box.all, showBox ? 1 : 0, ms);

    // ---- median: the line inside the box
    const med = this.join(this.gMedian, 'line.median', rows, (d) => d.id, 'line', 'median');
    med.all.attr('data-group', (d: RowD) => d.id).style('stroke', (d: RowD) => d.color);
    const placeMed = (s: AnySel): void => {
      s.attr('x1', (d: RowD) => r1(sc(d.stats.median.value)))
        .attr('x2', (d: RowD) => r1(sc(d.stats.median.value)))
        .attr('y1', (d: RowD) => r1(d.y - d.half))
        .attr('y2', (d: RowD) => r1(d.y + d.half));
    };
    placeMed(med.enter);
    placeMed(tr(med.upd, TN, ms));
    this.fade(med.all, showMedian ? 1 : 0, ms);

    // ---- dots: one circle per observation, stacked only where two marks collide
    const gap = 2 * L.dotR + 2;
    const dots: DotD[] = [];
    for (const row of rows) {
      const px = row.values.map((value) => sc(value));
      const levels = stackLevels(px, gap);
      row.values.forEach((value, i) => {
        dots.push({ row, value, x: px[i], y: row.y - levels[i] * gap });
      });
    }
    const dot = this.join(this.gDots, 'circle.dot', dots, (d) => `${d.row.id}:${d.value}`, 'circle', 'dot');
    dot.all.attr('data-group', (d: DotD) => d.row.id).attr('data-value', (d: DotD) => d.value)
      .style('fill', (d: DotD) => d.row.color);
    const placeDot = (s: AnySel): void => {
      s.attr('cx', (d: DotD) => r1(d.x)).attr('cy', (d: DotD) => r1(d.y)).attr('r', r1(L.dotR));
    };
    placeDot(dot.enter);
    placeDot(tr(dot.upd, TN, ms));
    if (ms > 0) tr(dot.all, TN, ms).attr('opacity', (d: DotD) => (d.row.dots ? 1 : 0));
    else dot.all.attr('opacity', (d: DotD) => (d.row.dots ? 1 : 0));

    // ---- outliers: a hollow diamond per observation outside the fences (dots off keeps them)
    const outliers: OutD[] = showOutliers
      ? rows.flatMap((row): OutD[] => row.stats.outliers.map((value) => ({ row, value, x: sc(value) })))
      : [];
    const out = this.join(this.gOutlier, 'path.outlier', outliers, (d) => `${d.row.id}:${d.value}`, 'path', 'outlier');
    out.all.attr('data-group', (d: OutD) => d.row.id)
      .attr('data-value', (d: OutD) => d.value)
      .attr('data-x', (d: OutD) => r1(d.x))
      .style('stroke', (d: OutD) => d.row.color);
    const placeOut = (s: AnySel): void => {
      s.attr('d', (d: OutD) => diamondPath(d.x, d.row.y, L.dotR * 1.25));
    };
    placeOut(out.enter);
    placeOut(tr(out.upd, TN, ms));

    // ---- group names in the left column
    const labels = this.gLabel.selectAll<SVGTextElement, RowD>('text.group-label')
      .data(rows, (d) => d.id)
      .join(
        (enter) => enter.append('text').attr('class', 'group-label'),
        (update) => update,
        (exit) => exit.remove(),
      );
    labels.attr('data-group', (d) => d.id).text((d) => d.name)
      .attr('x', L.pad).attr('y', (d: RowD) => r1(d.y + L.axis * 0.35));

    // ---- step 8: a real link to the deep dive, bottom right
    const link = this.gLink.selectAll<HTMLAnchorElement, LinkD>('a.kutu-link')
      .data(v.showViolin ? [LINK] : [], (d) => d.href)
      .join(
        (enter) => {
          const a = enter.append('a').attr('class', 'kutu-link');
          a.append('text').attr('class', 'kutu-link-text');
          return a;
        },
        (update) => update,
        (exit) => exit.remove(),
      );
    link.attr('href', (d) => d.href);
    link.select<SVGTextElement>('text.kutu-link-text')
      .attr('x', r1(L.plotR)).attr('y', r1(L.rowsBottom + 2)).attr('text-anchor', 'end')
      .text((d) => d.label);

    // ---- drag handles: the Lab-only extreme of Bilgisayar and Elektrik
    const handles: HandleD[] = st.dragOn
      ? rows.flatMap((row): HandleD[] => {
        const spec = DRAG[row.id];
        if (!spec) return [];
        return [{ row, spec, value: st.dragValues.get(row.id) ?? extremeOf(row.base, spec.dir) }];
      })
      : [];
    const handle = this.join(this.gDrag, 'circle.drag-handle', handles, (d) => d.row.id, 'circle', 'drag-handle');
    const hEnter = handle.enter.attr('role', 'slider')
      .attr('tabindex', '0')
      .attr('aria-orientation', 'horizontal')
      .attr('aria-valuemin', (d: HandleD) => d.spec.min)
      .attr('aria-valuemax', (d: HandleD) => d.spec.max)
      .attr('aria-label', (d: HandleD) => `${d.row.name} uç değeri`)
      .on('keydown', (ev: KeyboardEvent, d: HandleD) => this.key(ev, d))
      .on('pointerdown', (ev: PointerEvent, d: HandleD) => this.down(ev, d.row.id))
      .on('pointermove', (ev: PointerEvent, d: HandleD) => this.move(ev, d.row.id))
      .on('pointerup', (ev: PointerEvent, d: HandleD) => this.up(ev, d.row.id))
      .on('pointercancel', (ev: PointerEvent, d: HandleD) => this.up(ev, d.row.id));
    const allHandles = hEnter.merge(handle.upd) as AnySel;
    allHandles.attr('data-group', (d: HandleD) => d.row.id)
      .attr('aria-valuenow', (d: HandleD) => Math.round(d.value))
      .attr('cx', (d: HandleD) => r1(sc(d.value)))
      .attr('cy', (d: HandleD) => r1(d.row.y))
      .attr('r', r1(L.dotR + 7));

    // ---- the live drag values, published for the e2e
    if (st.dragOn && handles.length > 0) {
      const published: Record<string, number> = {};
      for (const h of handles) published[h.row.id] = h.value;
      this.svg.attr('data-drag', JSON.stringify(published));
    } else this.svg.attr('data-drag', null);
  }

  /**
   * The density silhouette of one row: Gaussian KDE over the shared axis. A flat
   * fallback (n < 2 or s = 0) gets its own constant band, never the density
   * branch's normalised y-scale, so a degenerate row cannot pretend to resolve
   * the marks.
   */
  private violinPath(row: RowD, sc: LineScale): string {
    const pts = kde(row.values, AXIS_MIN, AXIS_MAX, 40);
    const ys = pts.map((p) => p.y);
    const max = Math.max(...ys);
    const min = Math.min(...ys);
    const flat = max - min < 1e-9;
    const amp = (p: { y: number }): number => (flat ? row.band * 0.16 : (p.y / max) * row.band * 0.42);
    const top = pts.map((p) => `${r1(sc(p.x))},${r1(row.y - amp(p))}`);
    const bottom = [...pts].reverse().map((p) => `${r1(sc(p.x))},${r1(row.y + amp(p))}`);
    return `M${top.join('L')}L${bottom.join('L')}Z`;
  }

  /** Keyed join: exit nodes drop, enter nodes get the class, both come back merged. */
  private join<D>(
    g: G, sel: string, data: D[], key: (d: D) => string, tag: string, cls: string,
  ): { enter: AnySel; upd: AnySel; all: AnySel } {
    const s = g.selectAll<SVGElement, D>(sel).data(data, key);
    s.exit().remove();
    const enter = s.enter().append(tag).attr('class', cls) as unknown as AnySel;
    const upd = s as unknown as AnySel;
    return { enter, upd, all: enter.merge(upd) as AnySel };
  }

  private fade(s: AnySel, to: number, ms: number): void {
    if (ms > 0) tr(s, TN, ms).attr('opacity', to);
    else s.attr('opacity', to);
  }

  /**
   * A fence outside the fixed 40–100 axis must not sit silently on the edge
   * tick: a caret at the clipped end plus the fence's own value tells the
   * reader that the fence leaves the axis. The dashed step-8 pair uses the
   * muted variant.
   */
  private drawClips(g: G, clips: ClipD[], alt: boolean, show: boolean, ms: number): void {
    const L = this.lay!;
    const caret = this.join(
      g, alt ? 'path.fence-clip.alt' : 'path.fence-clip', show ? clips : [],
      (d) => `${d.row.id}:${d.side}`, 'path', alt ? 'fence-clip alt' : 'fence-clip',
    );
    caret.all.attr('data-group', (d: ClipD) => d.row.id).attr('data-side', (d: ClipD) => d.side)
      .attr('data-value', (d: ClipD) => trim(d.value))
      .style('fill', (d: ClipD) => (alt ? 'var(--muted)' : d.row.color));
    const s = Math.max(5, Math.round(L.tick * 0.5));
    const place = (x: AnySel): void => {
      x.attr('d', (d: ClipD) => {
        const edge = d.side === 'lo' ? L.plotL : L.plotR;
        const y = d.row.y;
        // the tip sits on the axis edge and points out of the plot
        return d.side === 'lo'
          ? `M${r1(edge)},${r1(y)}L${r1(edge + s)},${r1(y - s)}L${r1(edge + s)},${r1(y + s)}Z`
          : `M${r1(edge)},${r1(y)}L${r1(edge - s)},${r1(y - s)}L${r1(edge - s)},${r1(y + s)}Z`;
      });
    };
    place(caret.enter);
    place(tr(caret.upd, TN, ms));
    if (ms > 0) tr(caret.all, TN, ms).attr('opacity', 1);
    else caret.all.attr('opacity', 1);

    const labels = g.selectAll<SVGTextElement, ClipD>(alt ? 'text.fence-clip-label.alt' : 'text.fence-clip-label')
      .data(show ? clips : [], (d) => `${d.row.id}:${d.side}`)
      .join(
        (enter) => enter.append('text').attr('class', alt ? 'fence-clip-label alt' : 'fence-clip-label'),
        (update) => update,
        (exit) => exit.remove(),
      );
    labels.attr('data-group', (d: ClipD) => d.row.id).attr('data-side', (d: ClipD) => d.side)
      .text((d: ClipD) => trim(d.value))
      .attr('text-anchor', (d: ClipD) => (d.side === 'lo' ? 'start' : 'end'))
      .attr('x', (d: ClipD) => r1(d.side === 'lo' ? L.plotL + s + 6 : L.plotR - s - 6))
      .attr('y', (d: ClipD) => r1(d.row.y + L.tick * 0.45));
  }

  /** Arrow keys move the focused handle through the same clamp/set path as the pointer. */
  private key(ev: KeyboardEvent, d: HandleD): void {
    const dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (dir === 0) return;
    ev.preventDefault();
    const next = clamp(d.value + dir * (ev.shiftKey ? 5 : 1), d.spec.min, d.spec.max);
    if (next === d.value) return;
    this.lastDrag = next;
    this.onDragCb?.(d.row.id, next, extremeOf(d.row.base, d.spec.dir));
  }

  // ------------------------------------------------------------- pointer drag
  private down(ev: PointerEvent, id: GroupId): void {
    if (ev.button > 0) return;
    this.dragging = id;
    this.lastDrag = null;
    try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
  }

  /** Pointer x → mark through the shared axis, snapped to 1 point and clamped to the group's range. */
  private move(ev: PointerEvent, id: GroupId): void {
    if (this.dragging !== id || !this.inv) return;
    const spec = DRAG[id];
    const row = this.rows.find((r) => r.id === id);
    if (!spec || !row) return;
    const box = this.svgEl.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const { d0, d1, r0, r1: r1px } = this.inv;
    const raw = d0 + ((px - r0) / (r1px - r0)) * (d1 - d0);
    const value = clamp(Math.round(raw), spec.min, spec.max);
    if (value === this.lastDrag) return;
    this.lastDrag = value;
    this.onDragCb?.(id, value, extremeOf(row.base, spec.dir));
  }

  private up(ev: PointerEvent, id: GroupId): void {
    if (this.dragging !== id) return;
    this.dragging = null;
    this.lastDrag = null;
    try { (ev.target as Element).releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
  }
}
