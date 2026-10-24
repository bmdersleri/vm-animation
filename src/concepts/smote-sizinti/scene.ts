import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { smoteSizintiScenario, type LeakParams } from './scenario';
import type { ViewScene } from './scene-base';
import { FlowScene } from './scene-flow';
import { PrScene } from './scene-pr';
import { deriveLeakView, type LeakKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** A view area whose drawing a later task fills (fold strip, code panel, cards). */
const reserved = (): ViewScene => ({ resize() {}, update() {}, interrupt() {}, destroy() {} });

/**
 * Scene host of the SMOTE-leakage page: a stage with five view areas (`data-view` = flow, pr, folds, code,
 * cards) above the formula strip. The flow area draws steps 1-3, the PR area steps 4, 5, 7 and 8; the other
 * three are reserved for steps 6, 9 and 10.
 * Updates coalesce into one frame; controls render without interpolation.
 */
export function mountLeakScene(
  el: HTMLElement,
  player: StepPlayer<LeakParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'leak-scene';
  const stage = doc.createElement('div');
  stage.className = 'leak-stage';
  const kinds: LeakKind[] = ['flow', 'pr', 'folds', 'code', 'cards'];
  const hosts = Object.fromEntries(kinds.map((k) => [k, doc.createElement('div')])) as Record<LeakKind, HTMLDivElement>;
  for (const k of kinds) {
    hosts[k].className = `leak-host leak-${k}-host`;
    hosts[k].dataset.host = k;
    stage.append(hosts[k]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<LeakKind, ViewScene> = {
    flow: new FlowScene(hosts.flow),
    pr: new PrScene(hosts.pr),
    folds: reserved(),
    code: reserved(),
    cards: reserved(),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<LeakParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `leak-render` measure for the performance spec. */
  function render(state: PlayerState<LeakParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('leak-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('leak-render', 'leak-render-start');
    }
  }

  function draw(state: PlayerState<LeakParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) sc.interrupt();
    const v = deriveLeakView(state.index, state.params);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const k of kinds) hosts[k].hidden = k !== v.kind;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    const a = area();
    scenes[v.kind].resize(a.w, a.h, mode);
    scenes[v.kind].update(v, ms);
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
    const sweep = smoteSizintiScenario.steps[s.index].sweep;
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
