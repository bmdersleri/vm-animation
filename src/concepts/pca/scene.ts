import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { Rect } from '../../core/plot/viewport';
import { THETA_SWEEP, type PcaParams } from './scenario';
import { derivePcaView, type PcaKind } from './view';
import { ScatterLayer, type ThetaPointer } from './scene-scatter';
import { GaugeLayer } from './scene-gauge';
import { ScreeLayer } from './scene-scree';
import { PanelsLayer } from './scene-panels';

const SVGNS = 'http://www.w3.org/2000/svg';
/** Room inside the scatter square for the tick labels and axis titles (left, bottom) and the top / right gap. */
const MARGIN: Record<Mode, { left: number; bottom: number }> = {
  ders: { left: 118, bottom: 72 },
  lab: { left: 84, bottom: 54 },
};
const EDGE = 8;
/** Gap between the scatter square and the gauge column. */
const SIDE_GAP = 40;
/** The scatter square is at most this share of the stage width. */
const SQUARE_SHARE = 0.52;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };
/** Index of step 3, whose sweep draws the variance curve. */
const SWEEP_STEP = 2;

/**
 * `pca` scene: one `svg.pca-plot` with the scatter + gauge (part 1), the
 * explained-variance bars (part 2) or the two panels (part 3), and the
 * calculation strip (`p.formula`) below. Only the layer of `view.kind` is shown.
 * Every render interrupts all layers first, so rapid step changes end in the
 * final state; player changes are coalesced to one render per animation frame.
 * Slider drags and sweeps draw instantly; steps animate, and so does a
 * perplexity change in part 3. Chained moves total at most 1400 ms ×
 * durationScale (t-SNE glide 900 + the new customer fade 350).
 */
export function mountPcaScene(
  el: HTMLElement, player: StepPlayer<PcaParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle & { onPointer(cb: ThetaPointer): void } {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const div = (cls: string): HTMLDivElement => {
    const d = doc.createElement('div');
    d.className = cls;
    return d;
  };

  const scene = div('pca-scene');
  const plotHost = div('pca-plot-host');
  const svg = doc.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'pca-plot');
  plotHost.append(svg);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const scatter = new ScatterLayer(svg, ds);
  const gauge = new GaugeLayer(svg, ds);
  const scree = new ScreeLayer(svg, ds);
  const panels = new PanelsLayer(svg, plotHost, ds);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<PcaParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';
  let reached = 0;
  let trackedIndex = player.state.index;
  /** Last rect each layer was laid out with; a layer redraws on layout, so unchanged rects are skipped. */
  const laidOut = new Map<string, string>();
  const lay = (name: string, rect: Rect, l: { layout(r: Rect, m: Mode): void }): void => {
    const key = `${mode} ${rect.left} ${rect.top} ${rect.width} ${rect.height}`;
    if (laidOut.get(name) === key) return;
    laidOut.set(name, key);
    l.layout(rect, mode);
  };

  /** Size of the plot area (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) return { w: Math.floor(pr.width), h: Math.floor(pr.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(Math.max(2, lines) * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  /** Lays every layer out in the plot area; the scatter takes a square on the left, the gauge the column on its right. */
  function layout(kind: PcaKind): void {
    const { w, h } = area();
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    const full: Rect = { left: 0, top: 0, width: w, height: h };
    if (kind === 'scatter') {
      const s = Math.floor(Math.min(h, SQUARE_SHARE * w));
      const m = MARGIN[mode];
      lay('scatter', { left: m.left, top: EDGE, width: s - m.left - EDGE, height: s - EDGE - m.bottom }, scatter);
      lay('gauge', { left: s + SIDE_GAP, top: 0, width: w - s - SIDE_GAP, height: h }, gauge);
    }
    lay('scree', full, scree);
    lay('panels', full, panels);
  }

  function render(state: PlayerState<PcaParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('pca-render-start');
    try {
      scatter.interrupt();
      gauge.interrupt();
      scree.interrupt();
      panels.interrupt();
      const v = derivePcaView(state.index, state.params, { reached: state.index === SWEEP_STEP ? reached : 0 });
      // slider and sweep ticks are instant; steps animate, and so does a perplexity change
      const live = cause === 'sweep' || (cause === 'param' && v.kind !== 'panels');
      const ms = ds > 0 && !instant && !live ? 1 : 0;

      scene.dataset.kind = v.kind;
      lastStrip = v.strip;
      renderStrip(strip, v.strip);
      layout(v.kind);
      scatter.update(v.scatter, ms);
      gauge.update(v.scatter?.side ?? null, ms);
      scree.update(v.scree, ms);
      panels.update(v.panels, ms);
      rendered = true;
    } finally {
      if (hasPerf) performance.measure('pca-render', 'pca-render-start');
    }
  }

  /**
   * Largest θ the step 3 curve has been drawn to in this visit of the step, so a
   * drag after the sweep does not cut the curve short. Every notification counts
   * (renders are coalesced); a new visit, or the sweep restarting at 0°, starts over.
   */
  function track(s: PlayerState<PcaParams>, cause: ChangeCause): void {
    if (s.index !== SWEEP_STEP || s.index !== trackedIndex || (cause === 'sweep' && s.params.theta === THETA_SWEEP[0])) reached = 0;
    trackedIndex = s.index;
    if (s.index === SWEEP_STEP) reached = Math.max(reached, Math.min(180, Math.max(0, s.params.theta)));
  }

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
    track(s, cause);
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) flush();
    else if (rafId === null) rafId = raf(flush);
  });

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      // the first draw animates in; later resizes are instant
      render(player.state, 'step', rendered);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      if (size) render(player.state, 'step', true);
    },
    onPointer(cb: ThetaPointer): void { scatter.onPointer(cb); },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      scatter.destroy();
      gauge.destroy();
      scree.destroy();
      panels.destroy();
      scene.remove();
    },
  };
}
