import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { circlesPath, segmentsPath } from '../../core/plot/dots-path';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitAspect, type Rect, type Scales } from '../../core/plot/viewport';
import { footOn, meanOf, normDeg, pairFit, projections } from './pca2';
import type { ScatterView } from './view';

const SVGNS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const HANDLE_R = 22;
/** Durations before `durationScale`. */
const UNIT_MS = 900;
const ROTATE_MS = 900;
const THETA_MS = 900;
const COLLAPSE_MS = 700;
const DROP_DELAY_MS = 700;
const DROP_FADE_MS = 500;
const FADE_MS = 350;
/** Transition names; all are interrupted on every update. */
const NAMES = ['pca-pts', 'pca-theta', 'pca-rot', 'pca-drop', 'pca-fade', 'axes'];

/** Whole-degree direction in [0, 180); `kind` tells a press from a move or a release. */
export type ThetaPointer = (deg: number, kind: 'down' | 'move' | 'up') => void;

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

interface Lay { plot: Rect; fonts: { tick: number; axis: number }; gap: number; yTickW: number }
interface Drawn { birim: number; collapsed: boolean; rot: number; dir: boolean; dir2: boolean }

const r2 = (n: number): number => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Shortest way from angle a to b on the 180°-periodic direction circle. */
const towards = (a: number, b: number): number => a + ((((b - a + 90) % 180) + 180) % 180 - 90);
const wholeDeg = (d: number): number => Math.round(normDeg(d)) % 180;

/**
 * The scatter of the `pca` page: the 500-point cloud (one path), the direction
 * lines PC1 / PC2 with their labels and the Lab handle, the projections (two
 * paths), the rotation of the cloud (one group transform), the collapse onto
 * PC1 and the ×1000 rescale. Every point set is a single `path`; text sizes come
 * from the CSS tokens only. `update(v, ms)` animates when `ms > 0` (the durations
 * are fixed here and multiplied by `ds`), `ms = 0` is instant.
 */
export class ScatterLayer {
  private readonly root: G;
  private readonly clipRect: El<SVGRectElement>;
  private readonly axes: AxesLayer;
  private readonly measure: TextMeasure;
  private readonly cloud: G;
  private readonly pts: El<SVGPathElement>;
  private readonly projLines: El<SVGPathElement>;
  private readonly projPts: El<SVGPathElement>;
  private readonly dropLines: El<SVGPathElement>;
  private readonly dir: El<SVGLineElement>;
  private readonly dir2: El<SVGLineElement>;
  private readonly cross: G;
  private readonly crossPath: El<SVGPathElement>;
  private readonly label: El<SVGTextElement>;
  private readonly label2: El<SVGTextElement>;
  private readonly handle: El<SVGCircleElement>;
  private readonly hit: El<SVGRectElement>;

  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: ScatterView | null = null;
  private sc: Scales | null = null;
  private drawn: Drawn | null = null;
  private cbs: ThetaPointer[] = [];
  private dragging = false;
  /** Animated scalars: the current angles of the two lines and of the cloud (data degrees). */
  private st = { dir: 0, dir2: 90, rot: 0 };
  /** Current dot positions (unrotated), the plain positions and the feet. */
  private curX = new Float64Array(0);
  private curY = new Float64Array(0);
  private bx = new Float64Array(0);
  private by = new Float64Array(0);
  private px = new Float64Array(0);
  private py = new Float64Array(0);

  constructor(private readonly svgEl: SVGSVGElement, private readonly ds: number) {
    const svg = select(svgEl);
    this.root = svg.append('g').attr('class', 'pca-scatter');
    this.clipRect = this.root.append('defs').append('clipPath').attr('id', 'pca-clip').append('rect');
    this.axes = new AxesLayer(this.root.append('g').attr('class', 'axes'));
    const clipped = this.root.append('g').attr('class', 'clipped').attr('clip-path', 'url(#pca-clip)').attr('pointer-events', 'none');
    this.cloud = clipped.append('g').attr('class', 'cloud');
    this.projLines = this.cloud.append('path').attr('class', 'proj-lines');
    this.dropLines = this.cloud.append('path').attr('class', 'drop-lines').attr('opacity', 0);
    this.pts = this.cloud.append('path').attr('class', 'pts');
    this.projPts = this.cloud.append('path').attr('class', 'proj-pts');
    this.dir2 = this.cloud.append('line').attr('class', 'dir2');
    this.dir = this.cloud.append('line').attr('class', 'dir');
    this.cross = this.root.append('g').attr('class', 'center-cross').attr('pointer-events', 'none');
    this.crossPath = this.cross.append('path').attr('class', 'cross');
    this.label = this.root.append('text').attr('class', 'dir-label').attr('text-anchor', 'middle').attr('pointer-events', 'none');
    this.label2 = this.root.append('text').attr('class', 'dir2-label').attr('text-anchor', 'middle').attr('pointer-events', 'none');
    this.hit = this.root.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
    this.handle = this.root.append('circle').attr('class', 'handle').attr('r', HANDLE_R).attr('pointer-events', 'none').attr('display', 'none');
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);

    this.hit.on('pointerdown', (ev: PointerEvent) => {
      if (ev.button > 0) return;
      this.dragging = true;
      try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
      this.emit(ev, 'down');
    });
    this.hit.on('pointermove', (ev: PointerEvent) => this.emit(ev, 'move'));
    const up = (ev: PointerEvent): void => {
      if (!this.dragging) return;
      this.dragging = false;
      try { (ev.target as Element).releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
      this.emit(ev, 'up');
    };
    this.hit.on('pointerup', up);
    this.hit.on('pointercancel', up);
  }

  onPointer(cb: ThetaPointer): void { this.cbs.push(cb); }

  layout(rect: Rect, mode: Mode): void {
    this.mode = mode;
    const fonts = this.measure.fonts(mode);
    const gap = Math.round(fonts.tick * 0.45);
    this.lay = { plot: rect, fonts, gap, yTickW: this.measure.width('−5.000', 'tick', fonts.tick) };
    if (this.view) {
      this.cancel();
      this.draw(this.view, false);
    }
  }

  update(v: ScatterView | null, ms: number): void {
    this.cancel();
    const prev = this.view;
    this.view = v;
    if (!v) {
      this.root.style('display', 'none');
      this.drawn = null;
      return;
    }
    if (!this.lay) return;
    this.draw(v, ms > 0 && this.ds > 0 && prev !== null);
  }

  /** Cancels running transitions and snaps every element to its final state. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, false);
  }

  destroy(): void {
    this.cancel();
    this.cbs = [];
    this.root.remove();
  }

  private cancel(): void {
    for (const n of NAMES) this.root.selectAll('*').interrupt(n);
    for (const n of NAMES) this.root.interrupt(n);
  }

  // ------------------------------------------------------------- pointer
  private emit(ev: PointerEvent, kind: 'down' | 'move' | 'up'): void {
    if (!this.sc || !this.view) return;
    const box = this.svgEl.getBoundingClientRect();
    const dx = ev.clientX - box.left - this.sc.x(0);
    const dy = ev.clientY - box.top - this.sc.y(0);
    const deg = wholeDeg(Math.atan2(-dy, dx) / RAD);
    for (const cb of [...this.cbs]) cb(deg, kind);
  }

  // ------------------------------------------------------------- draw
  private draw(v: ScatterView, animate: boolean): void {
    const L = this.lay!;
    const { plot, fonts, gap } = L;
    const ds = this.ds;
    const prev = this.drawn;
    const sc = fitAspect(v.domain, plot, 1);
    this.sc = sc;
    const cx = sc.x(0);
    const cy = sc.y(0);
    const right = plot.left + plot.width;
    const bottom = plot.top + plot.height;
    const n = v.points.length;

    this.root.style('display', '').attr('data-birim', v.birim);
    for (const r of [this.clipRect, this.hit]) {
      r.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    }

    // ---- axes
    const xTickY = bottom + gap + fonts.tick * 0.9;
    const unitChanged = !!prev && prev.birim !== v.birim;
    this.axes.draw(sc, plot, {
      xTickCount: Math.max(2, Math.round(plot.width / (fonts.tick * 7))),
      yTickCount: Math.max(2, Math.round(plot.height / (fonts.tick * 3.2))),
      xTickY, yTickX: plot.left - gap,
      xTitle: { x: plot.left + plot.width / 2, y: xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95, text: v.axisTitles.x },
      yTitle: { x: Math.max(fonts.axis * 0.6, plot.left - 2 * gap - L.yTickW - fonts.axis * 0.25), y: plot.top + plot.height / 2, lines: [v.axisTitles.y] },
    }, animate && unitChanged ? UNIT_MS * ds : 0, String(v.birim));

    // ---- centre cross
    const cr = 9;
    this.crossPath.attr('d', `M${r1(cx - cr)},${r1(cy)}L${r1(cx + cr)},${r1(cy)}M${r1(cx)},${r1(cy - cr)}L${r1(cx)},${r1(cy + cr)}`);
    const fadeMs = animate ? FADE_MS * ds : 0;
    const show = (sel: Selection<any, any, any, any>, on: boolean): void => {
      tr(sel, 'pca-fade', fadeMs).attr('opacity', on ? 1 : 0);
    };
    this.cross.attr('display', null);
    show(this.cross, v.center);

    // ---- the dots: one path, positions tween from wherever they are now
    const feetPx = new Float64Array(n);
    const feetPy = new Float64Array(n);
    if (this.bx.length !== n) {
      this.bx = new Float64Array(n); this.by = new Float64Array(n);
      this.px = new Float64Array(n); this.py = new Float64Array(n);
    }
    for (let i = 0; i < n; i++) {
      this.bx[i] = sc.x(v.points[i][0]);
      this.by[i] = sc.y(v.points[i][1]);
    }
    if (v.collapsed || v.dropLines) {
      const feet = footOn(v.points, pairFit(v.birim).pc1Deg);
      for (let i = 0; i < n; i++) { feetPx[i] = sc.x(feet[i][0]); feetPy[i] = sc.y(feet[i][1]); }
    }
    const tx = v.collapsed ? feetPx : this.bx;
    const ty = v.collapsed ? feetPy : this.by;
    const ptsMs = !animate || !prev || this.curX.length !== n ? 0
      : (prev.birim !== v.birim ? UNIT_MS : prev.collapsed !== v.collapsed ? COLLAPSE_MS : 0) * ds;
    this.pts.attr('data-n', n);
    this.cloud.attr('data-collapsed', v.collapsed ? '1' : '0');
    if (ptsMs > 0) {
      const x0 = Float64Array.from(this.curX);
      const y0 = Float64Array.from(this.curY);
      const x1 = Float64Array.from(tx);
      const y1 = Float64Array.from(ty);
      this.root.transition('pca-pts').duration(ptsMs).ease(easeCubicInOut).tween('pts', () => (t: number) => {
        for (let i = 0; i < n; i++) { this.curX[i] = lerp(x0[i], x1[i], t); this.curY[i] = lerp(y0[i], y1[i], t); }
        this.paintPts();
      });
    } else {
      this.curX = Float64Array.from(tx);
      this.curY = Float64Array.from(ty);
    }
    this.paintPts();

    // ---- drop lines: from the dots to their feet; drawn at full strength while collapsing, then faded away
    this.dropLines.attr('d', v.dropLines ? segmentsPath(this.bx, this.by, feetPx, feetPy) : '').attr('data-n', v.dropLines ? n : 0);
    this.dropLines.attr('opacity', 0);
    if (v.dropLines && animate && prev && !prev.collapsed && v.collapsed) {
      this.dropLines.attr('opacity', 1);
      this.dropLines.transition('pca-drop').delay(DROP_DELAY_MS * ds).duration(DROP_FADE_MS * ds).ease(easeCubicInOut).attr('opacity', 0);
    }

    // ---- rotation: one group transform, the angle itself is tweened
    const rotStr = (a: number): string => `rotate(${r2(-a)},${r1(cx)},${r1(cy)})`;
    this.cloud.attr('data-rot', Math.round(v.rotate) || 0);
    if (animate && prev && prev.rot !== v.rotate) {
      const a0 = this.st.rot;
      const a1 = v.rotate;
      this.cloud.attr('transform', rotStr(a0));
      this.cloud.transition('pca-rot').duration(ROTATE_MS * ds).ease(easeCubicInOut)
        .attrTween('transform', () => (t: number) => {
          this.st.rot = lerp(a0, a1, t);
          this.paintDir();
          return rotStr(this.st.rot);
        });
    } else {
      this.st.rot = v.rotate;
      this.cloud.attr('transform', rotStr(v.rotate));
    }

    // ---- direction lines: the angles tween when the line stays visible across the step
    const d1 = v.dir?.deg ?? null;
    const d2 = v.dir2?.deg ?? null;
    const from = { dir: this.st.dir, dir2: this.st.dir2 };
    const to = {
      dir: d1 !== null && animate && prev?.dir ? towards(from.dir, d1) : d1 ?? from.dir,
      dir2: d2 !== null && animate && prev?.dir2 ? towards(from.dir2, d2) : d2 ?? from.dir2,
    };
    const moves = animate && (Math.abs(to.dir - from.dir) > 1e-6 || Math.abs(to.dir2 - from.dir2) > 1e-6);
    if (moves) {
      this.root.transition('pca-theta').duration(THETA_MS * ds).ease(easeCubicInOut).tween('theta', () => (t: number) => {
        this.st.dir = t >= 1 && d1 !== null ? d1 : lerp(from.dir, to.dir, t);
        this.st.dir2 = t >= 1 && d2 !== null ? d2 : lerp(from.dir2, to.dir2, t);
        this.paintDir();
      });
    } else {
      this.st.dir = d1 ?? from.dir;
      this.st.dir2 = d2 ?? from.dir2;
    }
    this.drawn = { birim: v.birim, collapsed: v.collapsed, rot: v.rotate, dir: d1 !== null, dir2: d2 !== null };
    show(this.dir, d1 !== null);
    show(this.label, d1 !== null);
    show(this.dir2, d2 !== null);
    show(this.label2, d2 !== null);
    show(this.projLines, v.projections);
    show(this.projPts, v.projections);
    this.label.text(v.dir?.label ?? '');
    this.label2.text(v.dir2?.label ?? '');
    const handleOn = this.mode === 'lab' && d1 !== null && v.projections;
    this.handle.attr('display', handleOn ? null : 'none');
    show(this.handle, handleOn);
    this.paintDir();
  }

  private paintPts(): void {
    this.pts.attr('d', circlesPath(this.curX, this.curY, this.mode === 'ders' ? 3.5 : 3));
  }

  /** Everything that follows the angles: the lines, their labels, the handle and the projections. */
  private paintDir(): void {
    const v = this.view;
    const sc = this.sc;
    const L = this.lay;
    if (!v || !sc || !L) return;
    const { plot, fonts } = L;
    const cx = sc.x(0);
    const cy = sc.y(0);
    const diag = Math.hypot(plot.width, plot.height);
    const line = (sel: El<SVGLineElement>, deg: number): void => {
      const ux = Math.cos(deg * RAD);
      const uy = -Math.sin(deg * RAD);
      sel.attr('x1', r1(cx - ux * diag)).attr('y1', r1(cy - uy * diag))
        .attr('x2', r1(cx + ux * diag)).attr('y2', r1(cy + uy * diag))
        .attr('data-theta', wholeDeg(deg));
    };
    line(this.dir, this.st.dir);
    line(this.dir2, this.st.dir2);

    const left = plot.left;
    const right = plot.left + plot.width;
    const top = plot.top;
    const bottom = plot.top + plot.height;
    const lh = fonts.tick * 1.2;
    /** Upper end of a line (screen angle after the cloud rotation) where it leaves the plot, and its unit vector. */
    const endOf = (deg: number): { x: number; y: number; ux: number; uy: number } => {
      const s = (deg + this.st.rot) * RAD;
      let ux = Math.cos(s);
      let uy = -Math.sin(s);
      if (uy > 1e-9 || (Math.abs(uy) <= 1e-9 && ux < 0)) { ux = -ux; uy = -uy; }
      const tx = ux > 1e-9 ? (right - cx) / ux : ux < -1e-9 ? (left - cx) / ux : Infinity;
      const ty = uy > 1e-9 ? (bottom - cy) / uy : uy < -1e-9 ? (top - cy) / uy : Infinity;
      const t = Math.min(tx, ty);
      return { x: cx + ux * t, y: cy + uy * t, ux, uy };
    };
    const place = (text: El<SVGTextElement>, deg: number, inset: number): void => {
      const e = endOf(deg);
      const w = this.measure.width(text.text() || 'M', text.attr('class'), fonts.tick);
      const back = inset + (w / 2) * Math.abs(e.ux) + (lh / 2) * Math.abs(e.uy);
      const side = lh * 0.75;
      let x = e.x - e.ux * back + e.uy * side;
      let y = e.y - e.uy * back - e.ux * side;
      x = Math.min(right - w / 2 - 2, Math.max(left + w / 2 + 2, x));
      y = Math.min(bottom - lh * 0.3, Math.max(top + lh * 0.9, y));
      text.attr('x', r1(x)).attr('y', r1(y));
    };
    const handleOn = this.handle.attr('display') !== 'none';
    place(this.label, this.st.dir, handleOn ? 2 * HANDLE_R + 4 : 10);
    place(this.label2, this.st.dir2, 10);
    if (handleOn) {
      const e = endOf(this.st.dir);
      this.handle.attr('cx', r1(e.x - e.ux * (HANDLE_R + 2))).attr('cy', r1(e.y - e.uy * (HANDLE_R + 2)));
    }

    // projections: perpendicular feet of every dot on the line through the mean
    if (!v.projections) {
      this.projLines.attr('d', '').attr('data-n', 0);
      this.projPts.attr('d', '').attr('data-n', 0);
      return;
    }
    const n = v.points.length;
    const m = meanOf(v.points);
    const u = this.st.dir * RAD;
    const ux = Math.cos(u);
    const uy = Math.sin(u);
    const t = projections(v.points, this.st.dir);
    for (let i = 0; i < n; i++) {
      this.px[i] = sc.x(m[0] + t[i] * ux);
      this.py[i] = sc.y(m[1] + t[i] * uy);
    }
    this.projLines.attr('d', segmentsPath(this.bx, this.by, this.px, this.py)).attr('data-n', n);
    this.projPts.attr('d', circlesPath(this.px, this.py, this.mode === 'ders' ? 3 : 2.5)).attr('data-n', n);
  }
}
