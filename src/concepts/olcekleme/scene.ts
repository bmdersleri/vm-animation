import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { renderStrip } from '../../core/plot/strip';
import type { OlcParams } from './scenario';
import { deriveOlcView } from './view';
import { MOVE_MS, ScatterLayer, type QueryPointer } from './scene-scatter';
import { ScalersLayer } from './scene-scalers';
import { SplitLayer } from './scene-split';

/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };

/** Zero-based steps 3 and 4: same space, different plot frame. */
const FRAME_STEPS: readonly number[] = [2, 3];
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `olcekleme` scene: one of three layers (scatter, three scalers, train/test
 * split) above the calculation strip (`p.formula`). Every render interrupts
 * all running transitions first, so rapid step changes end in the final
 * state; player changes are coalesced to one render per animation frame.
 * Space, unit, scaler and fit changes move over `MOVE_MS × durationScale`
 * (scaled here, once); a drag of the new customer (only `query` changed)
 * renders instantly.
 */
export function mountOlcScene(
  el: HTMLElement, player: StepPlayer<OlcParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle & { onPointer(cb: QueryPointer): void } {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'olc-scene';
  const plotHost = doc.createElement('div');
  plotHost.className = 'olc-plot-host';
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const scatter = new ScatterLayer(plotHost);
  const scalers = new ScalersLayer(plotHost);
  const split = new SplitLayer(plotHost);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<OlcParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';
  let prev: { index: number; params: OlcParams } | null = null;

  // pointer: hover must not move the customer; only a drag that began with 'down' is forwarded
  const cbs: QueryPointer[] = [];
  let dragging = false;
  scatter.onPointer((q, kind) => {
    if (kind === 'down') dragging = true;
    else if (!dragging) return;
    else if (kind === 'up') dragging = false;
    for (const cb of [...cbs]) cb(q, kind);
  });

  /** Area of the plot host (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) return { w: Math.floor(pr.width), h: Math.floor(pr.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  function render(state: PlayerState<OlcParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('olc-render-start');
    try {
      scatter.interrupt();
      scalers.interrupt();
      split.interrupt();
      const v = deriveOlcView(state.index, state.params);
      const p = state.params;
      const before = prev;
      // dragging the new customer changes only `query`: follow the pointer without easing
      const queryOnly = cause === 'param' && !!before && before.index === state.index
        && before.params.unit === p.unit && before.params.scaling === p.scaling && before.params.fit === p.fit;
      // steps 3 <-> 4 only widen or narrow the plot frame (view.ts SHARED_FRAME_STEPS): under reduced motion that is instant
      const frameOnly = !!before && before.index !== state.index && before.params.unit === p.unit
        && FRAME_STEPS.includes(before.index) && FRAME_STEPS.includes(state.index);
      const ms = ds > 0 && !instant && !queryOnly && !(frameOnly && reducedMotion()) ? MOVE_MS * ds : 0;
      prev = { index: state.index, params: p };

      scene.dataset.part = String(v.part);
      scene.dataset.kind = v.kind;
      lastStrip = v.strip;
      renderStrip(strip, v.strip);
      const a = area();
      scatter.resize(a.w, a.h, mode);
      scalers.resize(a.w, a.h, mode);
      split.resize(a.w, a.h, mode);
      scatter.update(v, ms, mode);
      scalers.update(v, ms, mode);
      split.update(v, ms, mode);
      rendered = true;
    } finally {
      if (hasPerf) performance.measure('olc-render', 'olc-render-start');
    }
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
    onPointer(cb: QueryPointer): void { cbs.push(cb); },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      cbs.length = 0;
      scatter.destroy();
      scalers.destroy();
      split.destroy();
      scene.remove();
    },
  };
}
