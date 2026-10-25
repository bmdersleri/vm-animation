import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { shapDegerleriScenario, type ShapParams } from './scenario';
import type { ViewScene } from './scene-base';
import { CardScene } from './scene-card';
import { CardsScene } from './scene-cards';
import { ForceScene } from './scene-force';
import { LatticeScene } from './scene-lattice';
import { SwarmScene } from './scene-swarm';
import { deriveShapView, type ShapKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** The scene areas; the card area also draws the bar steps, the force area also draws the waterfall. */
type Area = 'card' | 'lattice' | 'force' | 'swarm' | 'cards';
const AREAS: Area[] = ['card', 'lattice', 'force', 'swarm', 'cards'];
const AREA_OF: Record<ShapKind, Area> = {
  card: 'card',
  bars: 'card',
  lattice: 'lattice',
  waterfall: 'force',
  force: 'force',
  swarm: 'swarm',
  cards: 'cards',
};

/**
 * Scene host of the SHAP page: a stage with five view areas above the formula strip. The card area draws steps 1, 2
 * and 8 (`data-view` card or bars), the lattice area steps 3-5, the force area steps 6 (waterfall) and 7 (force
 * bars), the swarm area step 9 and the cards area step 10. Updates coalesce into one frame; controls
 * render without interpolation.
 */
export function mountShapScene(
  el: HTMLElement,
  player: StepPlayer<ShapParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'shap-scene';
  const stage = doc.createElement('div');
  stage.className = 'shap-stage';
  const hosts = Object.fromEntries(AREAS.map((a) => [a, doc.createElement('div')])) as Record<Area, HTMLDivElement>;
  for (const a of AREAS) {
    hosts[a].className = `shap-host shap-${a}-host`;
    hosts[a].dataset.host = a;
    stage.append(hosts[a]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<Area, ViewScene> = {
    card: new CardScene(hosts.card),
    lattice: new LatticeScene(hosts.lattice),
    force: new ForceScene(hosts.force),
    swarm: new SwarmScene(hosts.swarm),
    cards: new CardsScene(hosts.cards),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<ShapParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `shap-render` measure for the performance spec. */
  function render(state: PlayerState<ShapParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) {
      return;
    }
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) {
      performance.mark('shap-render-start');
    }
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) {
        performance.measure('shap-render', 'shap-render-start');
      }
    }
  }

  function draw(state: PlayerState<ShapParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) {
      sc.interrupt();
    }
    const v = deriveShapView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const target = AREA_OF[v.kind];
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const a of AREAS) {
      hosts[a].hidden = a !== target;
    }
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    scenes[target].resize(a.w, a.h, mode);
    scenes[target].update(v, ms);
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
    const sweep = shapDegerleriScenario.steps[s.index].sweep;
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
      for (const sc of Object.values(scenes)) {
        sc.destroy();
      }
      scene.remove();
    },
  };
}
