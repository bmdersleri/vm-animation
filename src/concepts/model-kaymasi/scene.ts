import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { allowCodeBreaks, renderStrip } from '../../core/plot/strip';
import { modelKaymasiScenario, type KaymaParams } from './scenario';
import { NARROW, TALL, TALL_BUDGET, type ViewScene } from './scene-base';
import { CodeScene } from './scene-code';
import { DriftScene } from './scene-drift';
import { FlowScene } from './scene-flow';
import { LineScene } from './scene-line';
import { MonitorScene } from './scene-monitor';
import { PsiScene } from './scene-psi';
import { SpreadScene } from './scene-spread';
import { TimelineScene } from './scene-timeline';
import { deriveKaymaView, type KaymaKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

const KINDS: KaymaKind[] = ['timeline', 'line', 'drift', 'monitor', 'spread', 'psi', 'flow', 'code'];

/**
 * Scene host of the model drift page: a stage with one view area per kind (`.kayma-host[data-host]`, only the current
 * step's is shown) above the formula strip. Updates coalesce into one frame; Lab control changes render without
 * interpolation. The stage's own width (not the window's) decides the layout: `data-narrow` below 900 px, `data-tall`
 * below 600 px, where the stage grows to its content and the page scrolls.
 */
export function mountKaymaScene(
  el: HTMLElement,
  player: StepPlayer<KaymaParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'kayma-scene';
  const stage = doc.createElement('div');
  stage.className = 'kayma-stage';
  const hosts = Object.fromEntries(KINDS.map((k) => [k, doc.createElement('div')])) as Record<KaymaKind, HTMLDivElement>;
  for (const k of KINDS) {
    hosts[k].className = 'kayma-host';
    hosts[k].dataset.host = k;
    stage.append(hosts[k]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<KaymaKind, ViewScene> = {
    timeline: new TimelineScene(hosts.timeline),
    line: new LineScene(hosts.line),
    drift: new DriftScene(hosts.drift),
    monitor: new MonitorScene(hosts.monitor),
    spread: new SpreadScene(hosts.spread),
    psi: new PsiScene(hosts.psi),
    flow: new FlowScene(hosts.flow),
    code: new CodeScene(hosts.code),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<KaymaParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `kayma-render` measure for the performance spec. */
  function render(state: PlayerState<KaymaParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) {
      return;
    }
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) {
      performance.mark('kayma-render-start');
    }
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) {
        performance.measure('kayma-render', 'kayma-render-start');
      }
    }
  }

  function draw(state: PlayerState<KaymaParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) {
      sc.interrupt();
    }
    const v = deriveKaymaView(state.index, state.params, mode === 'lab');
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const k of KINDS) {
      hosts[k].hidden = k !== v.kind;
    }
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    allowCodeBreaks(strip);
    const a = area();
    // the layout follows the stage's own width, not the window: the Lab stage is narrow in a wide window
    const tall = a.w < TALL;
    stage.toggleAttribute('data-narrow', a.w < NARROW);
    stage.toggleAttribute('data-tall', tall);
    scenes[v.kind].resize(a.w, tall ? TALL_BUDGET : a.h, mode, tall);
    scenes[v.kind].update(v, ms);
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
    const sweep = modelKaymasiScenario.steps[s.index].sweep;
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
