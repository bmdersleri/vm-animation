import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { NormalParams } from './scenario';
import { deriveNormalView } from './view';
import { CurveLayer, MS_STEP } from './scene-curve';

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Density scene and formula strip. Step updates coalesce into one frame;
 * controls render without interpolation and every update interrupts the reveal.
 */
export function mountNormalScene(
  el: HTMLElement,
  player: StepPlayer<NormalParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'normal-scene';
  const plotHost = doc.createElement('div');
  plotHost.className = 'normal-plot-host';
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const layer = new CurveLayer(plotHost);
  // the outlier drag writes the same param the range input does, so both stay in sync

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<NormalParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';

  /** Area of the plot host (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) return { w: Math.floor(pr.width), h: Math.floor(pr.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  /** One render, timed as the `normal-render` measure for the performance spec. */
  function render(state: PlayerState<NormalParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('normal-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('normal-render', 'normal-render-start');
    }
  }

  function draw(state: PlayerState<NormalParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    const v = deriveNormalView(state.index, state.params);
    // slider / select / shortcut tweaks are instant; steps animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    layer.resize(a.w, a.h, mode);
    layer.update(v, ms, state.params.k);
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
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      layer.destroy();
      scene.remove();
    },
  };
}
