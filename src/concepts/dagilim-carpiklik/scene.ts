import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { renderStrip } from '../../core/plot/strip';
import type { DagilimParams } from './scenario';
import { EXTREME_STEPS } from './scenario';
import { deriveDagilimView } from './view';
import { HistLayer, MS_STEP } from './scene-hist';

/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `dagilim-carpiklik` scene: the number line with the dots on top, the histogram
 * with the mean / median marks below it and the calculation strip (`p.formula`)
 * under both. Every render interrupts all running transitions first, so rapid
 * step changes end in the final state; player changes are coalesced to one
 * render per animation frame. Steps animate over MS_STEP × durationScale; slider,
 * select and shortcut changes (cause 'param') render instantly.
 */
export function mountDagilimScene(
  el: HTMLElement, player: StepPlayer<DagilimParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'dag-scene';
  const plotHost = doc.createElement('div');
  plotHost.className = 'dag-plot-host';
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const layer = new HistLayer(plotHost);
  // the outlier drag writes the same param the range input does, so both stay in sync
  layer.onDrag((x) => player.setParam('extreme', x));

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<DagilimParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `dag-render` measure for the performance spec. */
  function render(state: PlayerState<DagilimParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('dag-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('dag-render', 'dag-render-start');
    }
  }

  function draw(state: PlayerState<DagilimParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    const v = deriveDagilimView(state.index, state.params);
    // slider / select / shortcut tweaks are instant; steps animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    layer.resize(a.w, a.h, mode);
    layer.update(v, ms, EXTREME_STEPS.includes(state.index));
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
