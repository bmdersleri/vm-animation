import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { SentimentParams } from './scenario';
import type { ViewScene } from './scene-base';
import { CoefScene } from './scene-coef';
import { DebugCodeScene } from './scene-code';
import { FlowScene } from './scene-flow';
import { ResultScene, ScoreScene } from './scene-score';
import { VocabScene } from './scene-vocab';
import { deriveSentimentView, type SentimentKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** Every area the stage can show, in DOM order. */
const KINDS: SentimentKind[] = ['flow', 'coef', 'score', 'result', 'vocab', 'code'];

/**
 * Scene host of the sentiment page: a stage with one area per view kind (`data-view` = flow, coef, score,
 * result, vocab, code) above the formula strip. Steps 1-2 draw the flow area, step 3 the coefficient bars,
 * steps 4, 6, 7, 9 the score panels, step 5 the result, step 8 the vocabulary strip and step 10 the code panel.
 * Updates coalesce into one frame; controls render without interpolation.
 */
export function mountSentimentScene(
  el0: HTMLElement,
  player: StepPlayer<SentimentParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el0.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'sa-scene';
  const stage = doc.createElement('div');
  stage.className = 'sa-stage';
  const hosts = Object.fromEntries(KINDS.map((k) => [k, doc.createElement('div')])) as Record<SentimentKind, HTMLDivElement>;
  for (const k of KINDS) {
    hosts[k].className = `sa-host sa-${k}-host`;
    hosts[k].dataset.host = k;
    stage.append(hosts[k]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el0.append(scene);

  const scenes: Record<SentimentKind, ViewScene> = {
    flow: new FlowScene(hosts.flow),
    coef: new CoefScene(hosts.coef),
    score: new ScoreScene(hosts.score),
    result: new ResultScene(hosts.result),
    vocab: new VocabScene(hosts.vocab),
    code: new DebugCodeScene(hosts.code),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<SentimentParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `sa-render` measure for the performance spec. */
  function render(state: PlayerState<SentimentParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('sa-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('sa-render', 'sa-render-start');
    }
  }

  function draw(state: PlayerState<SentimentParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) sc.interrupt();
    const v = deriveSentimentView(state.index, state.params);
    // control tweaks are instant; steps animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.view = v.kind;
    stage.dataset.step = v.stepId;
    for (const k of KINDS) hosts[k].hidden = k !== v.kind;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    strip.hidden = v.strip === '';
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
      for (const sc of Object.values(scenes)) sc.destroy();
      scene.remove();
    },
  };
}
