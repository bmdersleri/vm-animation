import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { BaggingParams } from './scenario';
import { deriveBaggingView } from './view';
import { BagScene, MS_STEP } from './scene-bag';
import { RegionScene } from './scene-regions';
import { ChartScene } from './scene-charts';

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * Scene host of the bootstrap and bagging page: a stage with three view areas
 * (`data-view` = bag, regions, charts) above the formula strip. The bag
 * (steps 1-4), region (steps 5-7) and chart (steps 8-10) areas each have their
 * own scene layer. Updates coalesce into one frame; controls render without
 * interpolation.
 */
export function mountBaggingScene(
  el: HTMLElement,
  player: StepPlayer<BaggingParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'bagging-scene';
  const stage = doc.createElement('div');
  stage.className = 'bagging-stage';
  const hosts = { bag: doc.createElement('div'), regions: doc.createElement('div'), charts: doc.createElement('div') };
  for (const [name, host] of Object.entries(hosts)) {
    host.className = `bagging-host bagging-${name}-host`;
    host.dataset.host = name;
  }
  stage.append(hosts.bag, hosts.regions, hosts.charts);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const bag = new BagScene(hosts.bag);
  const regions = new RegionScene(hosts.regions);
  const charts = new ChartScene(hosts.charts);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<BaggingParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `bagging-render` measure for the performance spec. */
  function render(state: PlayerState<BaggingParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('bagging-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('bagging-render', 'bagging-render-start');
    }
  }

  function draw(state: PlayerState<BaggingParams>, cause: ChangeCause, instant: boolean): void {
    bag.interrupt();
    regions.interrupt();
    charts.interrupt();
    const v = deriveBaggingView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const view = v.regions ? 'regions' : v.charts ? 'charts' : 'bag';
    stage.dataset.view = view;
    stage.dataset.step = v.stepId;
    for (const [name, host] of Object.entries(hosts)) host.hidden = name !== view;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    if (view === 'bag') {
      const a = area();
      bag.resize(a.w, a.h, mode);
      bag.update(v, ms);
    } else if (view === 'regions') {
      const a = area();
      regions.resize(a.w, a.h, mode);
      regions.update(v, ms);
    } else {
      const a = area();
      charts.resize(a.w, a.h, mode);
      charts.update(v, ms);
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
      bag.destroy();
      regions.destroy();
      charts.destroy();
      scene.remove();
    },
  };
}
