import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { dengesizVeriScenario, type ImbParams } from './scenario';
import { deriveImbView } from './view';
import { BoundaryScene } from './scene-boundary';
import { ScatterScene } from './scene-scatter';
import { SmoteScene, type ViewScene } from './scene-smote';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/**
 * Scene host of the imbalanced-data page: a stage with four view areas (`data-view` = scatter,
 * smote, weight, boundary) above the formula strip. The scatter with its side panel draws
 * steps 1-5, the smote area steps 6-7, the weight area step 8 (the scatter with sized dots) and the
 * boundary area steps 9-10.
 * Updates coalesce into one frame; controls render without interpolation.
 */
export function mountImbScene(
  el: HTMLElement,
  player: StepPlayer<ImbParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'imb-scene';
  const stage = doc.createElement('div');
  stage.className = 'imb-stage';
  const hosts = {
    scatter: doc.createElement('div'),
    smote: doc.createElement('div'),
    weight: doc.createElement('div'),
    boundary: doc.createElement('div'),
  };
  for (const [name, host] of Object.entries(hosts)) {
    host.className = `imb-host imb-${name}-host`;
    host.dataset.host = name;
  }
  stage.append(hosts.scatter, hosts.smote, hosts.weight, hosts.boundary);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<keyof typeof hosts, ViewScene> = {
    scatter: new ScatterScene(hosts.scatter),
    smote: new SmoteScene(hosts.smote),
    weight: new ScatterScene(hosts.weight),
    boundary: new BoundaryScene(hosts.boundary),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<ImbParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `imb-render` measure for the performance spec. */
  function render(state: PlayerState<ImbParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('imb-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('imb-render', 'imb-render-start');
    }
  }

  function draw(state: PlayerState<ImbParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) sc.interrupt();
    const v = deriveImbView(state.index, state.params, mode === 'lab');
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const [name, host] of Object.entries(hosts)) host.hidden = name !== v.kind;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const active = scenes[v.kind];
    const a = area();
    active.resize(a.w, a.h, mode);
    active.update(v, ms);
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
  let lastIndex = player.state.index;
  const unsubscribe = player.subscribe((s, cause) => {
    // Reduced motion: entering a sweep step lands on the sweep's last value at once (this also ends the player's sweep).
    const entered = s.index !== lastIndex;
    lastIndex = s.index;
    const sweep = dengesizVeriScenario.steps[s.index].sweep;
    if (entered && sweep && reducedMotion()) {
      player.setParams({ [sweep.key]: sweep.values[sweep.values.length - 1] });
      return;
    }
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
      for (const sc of Object.values(scenes)) sc.destroy();
      scene.remove();
    },
  };
}
