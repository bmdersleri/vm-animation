import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { renderStrip } from '../../core/plot/strip';
import type { GroupId } from './data';
import type { KutuParams } from './scenario';
import { deriveKutuView, stripFor, withDrag } from './view';
import { BoxLayer, DRAG_FROM, MS_STEP } from './scene-box';

/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `kutu-grafigi` scene: one shared mark axis over one horizontal row per group
 * and the calculation strip (`p.formula`) under them. Every render interrupts
 * all running transitions first, so rapid step changes end in the final state;
 * player changes are coalesced to one render per animation frame. Steps animate
 * over MS_STEP × durationScale; control changes render instantly.
 *
 * The Lab drag is scene-local: `dragValues` / `dragOrigins` hold the dragged
 * observation, are cleared on every step change and never enter `KutuParams`.
 */
export function mountKutuScene(
  el: HTMLElement, player: StepPlayer<KutuParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'kutu-scene';
  const plotHost = doc.createElement('div');
  plotHost.className = 'kutu-plot-host';
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const layer = new BoxLayer(plotHost);
  /** The observation the teacher moved, per group, and the value it started from. */
  const dragValues = new Map<GroupId, number>();
  const dragOrigins = new Map<GroupId, number>();

  layer.onDrag((id, value, origin) => {
    if (!dragOrigins.has(id)) dragOrigins.set(id, origin);
    dragValues.set(id, value);
    // the drag is live feedback: redraw without easing and without a player change
    render(player.state, 'param', true);
  });

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<KutuParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `kutu-render` measure for the performance spec. */
  function render(state: PlayerState<KutuParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('kutu-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('kutu-render', 'kutu-render-start');
    }
  }

  function draw(state: PlayerState<KutuParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    // the drag belongs to one step only
    if (state.index !== shownIndex) {
      dragValues.clear();
      dragOrigins.clear();
      shownIndex = state.index;
    }
    const view = deriveKutuView(state.index, state.params);
    // the groups actually drawn: the scene-local drag applied, so the strip agrees with the fences
    const groups = withDrag(view.groups, { values: dragValues, origins: dragOrigins }, state.params.k);
    const stripText = stripFor(view.stepId, state.params, groups);
    // control changes are instant; steps animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    lastStrip = stripText;
    renderStrip(strip, stripText);
    const a = area();
    layer.resize(a.w, a.h, mode);
    layer.update(view, {
      index: state.index,
      k: state.params.k,
      groups,
      dragValues,
      dragOrigins,
      // the Lab spec does not gate the drag by step; Ders offers it from step 6
      dragOn: mode === 'lab' || state.index >= DRAG_FROM,
    }, ms);
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
      dragValues.clear();
      dragOrigins.clear();
      layer.destroy();
      scene.remove();
    },
  };
}
