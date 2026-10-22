import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { renderStrip } from '../../core/plot/strip';
import { LEVERAGE } from './anscombe';
import type { KorelParams } from './scenario';
import { deriveKorelView, type PanelView } from './view';
import { HeatLayer, MS_HEAT } from './scene-heat';
import { PanelsLayer, MS_STEP, type PanelsState } from './scene-panels';

const SVGNS = 'http://www.w3.org/2000/svg';
/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };
/** What the strip says once the leverage point is dropped: x is constant, so Pearson is undefined. */
const DROPPED_STRIP = 'nokta çıkarıldı · r tanımsız (x sabit)';
const DROPPED_STATS = 'nokta çıkarıldı · r tanımsız';

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `korelasyon-isi-haritasi` scene: one `svg.kor-plot` that holds either the
 * heat matrix or the step's 1 / 2 / 4 scatter panels, and the strip
 * (`p.formula`) under it. Steps 9 and 10 draw their boxes / rule in the same
 * svg. Every render interrupts all running transitions first, so rapid step
 * changes end in the final state; player changes are coalesced to one render
 * per animation frame. Steps animate over MS_STEP × durationScale; control
 * changes render instantly with the shorter MS_HEAT.
 *
 * Set IV's leverage drag writes `player.setParam('noktaY', y)`, so the range
 * input stays in sync. The drop of the point (Lab, double-click) is scene-local:
 * `dropped` is cleared on every step change and never enters `KorelParams`.
 */
export function mountKorelasyonScene(
  el: HTMLElement, player: StepPlayer<KorelParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'kor-scene';
  const plotHost = doc.createElement('div');
  plotHost.className = 'kor-plot-host';
  const svgEl = doc.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  svgEl.setAttribute('class', 'kor-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', 'Korelasyon, ısı haritası ve Anscombe panelleri');
  plotHost.append(svgEl);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const panels = new PanelsLayer(svgEl);
  const heat = new HeatLayer(svgEl);
  panels.onLeverage((y) => player.setParam('noktaY', y));

  /** Lab-only: the leverage point was removed; x is constant and r undefined. */
  let dropped = false;

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<KorelParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';
  let shownIndex = -1;

  /** Area of the plot host (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) return { w: Math.floor(pr.width), h: Math.floor(pr.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  function panelState(p: PanelView[], stepId: string): PanelsState {
    const hasLever = p.some((panel) => panel.id === 'IV');
    return {
      stepId,
      panels: dropped
        ? p.map((panel) => (panel.id === 'IV' ? { ...panel, stats: DROPPED_STATS } : panel))
        : p,
      leverage: hasLever
        ? { x: LEVERAGE.x, y: player.state.params.noktaY, lab: mode === 'lab', dropped }
        : null,
    };
  }

  function render(state: PlayerState<KorelParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    panels.interrupt();
    heat.interrupt();
    // the drop belongs to one step only
    if (state.index !== shownIndex) {
      dropped = false;
      shownIndex = state.index;
    }
    const view = deriveKorelView(state.index, state.params);
    // control changes are instant; steps animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const heatMs = ds > 0 && !instant && cause !== 'param' ? MS_HEAT * ds : 0;
    lastStrip = view.stepId === 'kaldirac' && dropped ? DROPPED_STRIP : view.strip;
    renderStrip(strip, lastStrip);
    const a = area();
    svgEl.setAttribute('width', String(Math.max(1, a.w)));
    svgEl.setAttribute('height', String(Math.max(1, a.h)));
    panels.update(a.w, a.h, mode, panelState(view.panels, view.stepId), ms);
    heat.update(a.w, a.h, mode, view.heat, heatMs);
    rendered = true;
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
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) flush();
    else if (rafId === null) rafId = raf(flush);
  });

  // Lab-only drop: the circle hides while the scene prints "r tanımsız"; a
  // second double-click anywhere on the plot brings the point back.
  panels.onDrop(() => {
    if (mode !== 'lab') return;
    dropped = !dropped;
    render(player.state, 'param', true);
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
      if (mode !== 'lab') dropped = false;
      if (size) render(player.state, 'step', true);
    },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      dropped = false;
      heat.destroy();
      panels.destroy();
      scene.remove();
    },
  };
}
