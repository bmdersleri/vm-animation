import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { boostingAyarlariScenario, type TuneParams } from './scenario';
import { deriveTuneView } from './view';
import { CurveScene } from './scene-curves';
import { GrowScene } from './scene-grow';
import { SearchScene } from './scene-search';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** Which host draws which view kind: the dot plot and the curves share one scene. */
const HOST_OF = { points: 'curves', curves: 'curves', grow: 'grow', search: 'search' } as const;

/**
 * Scene host of the boosting settings page: a stage with three view areas above the formula strip.
 * `curves` draws steps 1-5 and 8 (the leaf-limit chart), `grow` steps 6-7 and `search` steps 9-10. The stage's `data-view` is the view kind. Updates coalesce into one frame; controls render
 * without interpolation.
 */
export function mountTuneScene(
  el: HTMLElement,
  player: StepPlayer<TuneParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'tune-scene';
  const stage = doc.createElement('div');
  stage.className = 'tune-stage';
  const hosts = { curves: doc.createElement('div'), grow: doc.createElement('div'), search: doc.createElement('div') };
  for (const [name, host] of Object.entries(hosts)) {
    host.className = `tune-host tune-${name}-host`;
    host.dataset.host = name;
  }
  stage.append(hosts.curves, hosts.grow, hosts.search);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const curves = new CurveScene(hosts.curves);
  const grow = new GrowScene(hosts.grow);
  const search = new SearchScene(hosts.search);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<TuneParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';

  /** Area of the stage (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const r = stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { w: Math.floor(r.width), h: Math.floor(r.height) };
    }
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  /** One render, timed as the `tune-render` measure for the performance spec. */
  function render(state: PlayerState<TuneParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) {
      return;
    }
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) {
      performance.mark('tune-render-start');
    }
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) {
        performance.measure('tune-render', 'tune-render-start');
      }
    }
  }

  function draw(state: PlayerState<TuneParams>, cause: ChangeCause, instant: boolean): void {
    curves.interrupt();
    grow.interrupt();
    search.interrupt();
    const v = deriveTuneView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const [name, host] of Object.entries(hosts)) {
      host.hidden = name !== HOST_OF[v.kind];
    }
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    if (v.kind === 'grow') {
      grow.resize(a.w, a.h, mode);
      grow.update(v, ms);
    } else if (v.kind === 'search') {
      search.resize(a.w, a.h, mode);
      search.update(v, ms);
    } else if (v.chart) {
      curves.resize(a.w, a.h, mode);
      // sweep frames redraw faster than the axes can fade, so the axes jump instead of leaving half-faded ticks behind
      curves.update(v, cause === 'sweep' ? 0 : ms);
    }
    rendered = true;
  }

  function flush(): void {
    rafId = null;
    const p = pending;
    pending = null;
    if (p) {
      render(p.s, p.cause, false);
    }
  }
  const raf = (cb: () => void): number =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
  const cancelRaf = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  };
  let lastIndex = player.state.index;
  const unsubscribe = player.subscribe((s, cause) => {
    // Reduced motion: entering a sweep step lands on the sweep's last value at once (this also ends the player's sweep).
    const entered = s.index !== lastIndex;
    lastIndex = s.index;
    const sweep = boostingAyarlariScenario.steps[s.index].sweep;
    if (entered && sweep && reducedMotion()) {
      player.setParams({ [sweep.key]: sweep.values[sweep.values.length - 1] });
      return;
    }
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) {
      flush();
    } else if (rafId === null) {
      rafId = raf(flush);
    }
  });

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      if (rafId !== null) {
        cancelRaf(rafId);
      }
      rafId = null;
      pending = null;
      // the first draw animates in; later resizes are instant
      render(player.state, 'step', rendered);
    },
    setMode(m: Mode): void {
      if (m === mode) {
        return;
      }
      mode = m;
      if (size) {
        render(player.state, 'step', true);
      }
    },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) {
        cancelRaf(rafId);
      }
      rafId = null;
      pending = null;
      curves.destroy();
      grow.destroy();
      search.destroy();
      scene.remove();
    },
  };
}
