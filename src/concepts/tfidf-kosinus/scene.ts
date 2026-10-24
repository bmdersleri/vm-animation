import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import { tfidfKosinusScenario, type TfidfParams } from './scenario';
import type { ViewScene } from './scene-base';
import { CardsScene } from './scene-cards';
import { TableScene } from './scene-table';
import { TokensScene } from './scene-tokens';
import { VectorsScene } from './scene-vectors';
import { deriveTfidfView, type TfidfKind } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/**
 * Scene host of the TF-IDF page: a stage with four view areas (`data-view` = tokens, table, vectors, cards)
 * above the formula strip. The token area draws steps 1-3, the table area steps 4-7, the vector area steps 8-9
 * and the card area step 10. Updates coalesce into one frame; controls render without interpolation.
 */
export function mountTfidfScene(
  el: HTMLElement,
  player: StepPlayer<TfidfParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'tf-scene';
  const stage = doc.createElement('div');
  stage.className = 'tf-stage';
  const kinds: TfidfKind[] = ['tokens', 'table', 'vectors', 'cards'];
  const hosts = Object.fromEntries(kinds.map((k) => [k, doc.createElement('div')])) as Record<TfidfKind, HTMLDivElement>;
  for (const k of kinds) {
    hosts[k].className = `tf-host tf-${k}-host`;
    hosts[k].dataset.host = k;
    stage.append(hosts[k]);
  }
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(stage, strip);
  el.append(scene);

  const scenes: Record<TfidfKind, ViewScene> = {
    tokens: new TokensScene(hosts.tokens),
    table: new TableScene(hosts.table),
    vectors: new VectorsScene(hosts.vectors),
    cards: new CardsScene(hosts.cards),
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<TfidfParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `tf-render` measure for the performance spec. */
  function render(state: PlayerState<TfidfParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('tf-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) performance.measure('tf-render', 'tf-render-start');
    }
  }

  function draw(state: PlayerState<TfidfParams>, cause: ChangeCause, instant: boolean): void {
    for (const sc of Object.values(scenes)) sc.interrupt();
    const v = deriveTfidfView(state.index, state.params);
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
    const sweep = tfidfKosinusScenario.steps[s.index].sweep;
    if (entered && sweep && reducedMotion()) {
      const n = sweep.count ? Math.max(1, Math.min(sweep.values.length, sweep.count(s.params))) : sweep.values.length;
      player.setParams({ [sweep.key]: sweep.values[n - 1] });
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
