import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { GbParams } from './scenario';
import { deriveGbView } from './view';
import { PanelScene } from './scene-panels';

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/**
 * Scene host of the gradient boosting page: a stage with three view areas
 * (`data-view` = panels, error, compare) above the formula strip. The panels area (steps 1-6)
 * has its scene layer; the error and compare areas are reserved for the next task. Updates
 * coalesce into one frame; controls render without interpolation.
 */
export function mountGbScene(
  el: HTMLElement,
  player: StepPlayer<GbParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'gb-scene';
  const stage = doc.createElement('div');
  stage.className = 'gb-stage';
  const hosts = { panels: doc.createElement('div'), error: doc.createElement('div'), compare: doc.createElement('div') };
  for (const [name, host] of Object.entries(hosts)) {
    host.className = `gb-host gb-${name}-host`;
    host.dataset.host = name;
  }
  stage.append(hosts.panels, hosts.error, hosts.compare);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const panels = new PanelScene(hosts.panels);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<GbParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';

  /** Area of the stage (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const r = stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: Math.floor(r.width), h: Math.floor(r.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  /** One render, timed as the `gb-render` measure for the performance spec. */
  function render(state: PlayerState<GbParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('gb-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('gb-render', 'gb-render-start');
    }
  }

  function draw(state: PlayerState<GbParams>, cause: ChangeCause, instant: boolean): void {
    panels.interrupt();
    const v = deriveGbView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const [name, host] of Object.entries(hosts)) host.hidden = name !== v.kind;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    if (v.panels) {
      const a = area();
      panels.resize(a.w, a.h, mode);
      panels.update(v.panels, ms);
    }
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
      panels.destroy();
      scene.remove();
    },
  };
}
