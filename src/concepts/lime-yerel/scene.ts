import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { limeYerelScenario, type LimeParams } from './scenario';
import type { ViewScene } from './scene-base';
import { BinsScene } from './scene-bins';
import { CloudScene } from './scene-cloud';
import { CodeScene } from './scene-code';
import { CompareScene } from './scene-compare';
import { FlowScene } from './scene-flow';
import { KernelScene } from './scene-kernel';
import { StabilityScene } from './scene-stability';
import { SurrogateScene } from './scene-surrogate';
import { deriveLimeView, type LimeKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** The scene areas: one per view kind. */
type Area = LimeKind;
const AREAS: Area[] = ['flow', 'bins', 'cloud', 'kernel', 'surrogate', 'stability', 'compare', 'code'];

/**
 * Scene host of the LIME page: a stage with view areas above the formula strip. Step 1 is the flow area, step 2
 * the bins area, steps 3-4 the cloud area, step 5 the kernel area, steps 6-7 the surrogate area, step 8 the stability strip, step 9 the SHAP / LIME panels and step 10 the code panel. Updates coalesce
 * into one frame; controls render without interpolation.
 */
export function mountLimeScene(
  el: HTMLElement,
  player: StepPlayer<LimeParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'lime-scene';
  const stage = doc.createElement('div');
  stage.className = 'lime-stage';
  const hosts = Object.fromEntries(AREAS.map((a) => [a, doc.createElement('div')])) as Record<Area, HTMLDivElement>;
  for (const a of AREAS) {
    hosts[a].className = `lime-host lime-${a}-host`;
    hosts[a].dataset.host = a;
    stage.append(hosts[a]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<Area, ViewScene> = {
    flow: new FlowScene(hosts.flow),
    bins: new BinsScene(hosts.bins),
    cloud: new CloudScene(hosts.cloud),
    kernel: new KernelScene(hosts.kernel),
    surrogate: new SurrogateScene(hosts.surrogate),
    stability: new StabilityScene(hosts.stability),
    compare: new CompareScene(hosts.compare),
    code: new CodeScene(hosts.code),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<LimeParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `lime-render` measure for the performance spec. */
  function render(state: PlayerState<LimeParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) {
      return;
    }
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) {
      performance.mark('lime-render-start');
    }
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) {
        performance.measure('lime-render', 'lime-render-start');
      }
    }
  }

  function draw(state: PlayerState<LimeParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) {
      sc.interrupt();
    }
    const v = deriveLimeView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const target: Area = v.kind;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const a of AREAS) {
      hosts[a].hidden = a !== target;
    }
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    stage.dataset.avail = String(a.h);
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
    const sweep = limeYerelScenario.steps[s.index].sweep;
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
