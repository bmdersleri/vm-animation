import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { renderStrip } from '../../core/plot/strip';
import type { IqrParams } from './scenario';
import { deriveIqrView } from './view';
import { CardsLayer } from './scene-cards';
import { LineLayer } from './scene-line';

/** Base duration of a step's moves, before `durationScale`. */
const MS_STEP = 450;
/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `iqr-aykiri` scene: the bill cards on top (about 30 % of the stage), the
 * number line in the middle and the calculation strip (`p.formula`) below.
 * Every render interrupts all running transitions first, so rapid step
 * changes end in the final state; player changes are coalesced to one render
 * per animation frame. Chained moves total at most 1400 ms × durationScale
 * (cards sort ≤ 600, dots 0.3 + 0.7 of a step, the mean glide 900, the
 * marks fade in after 0.4 of a step).
 */
export function mountIqrScene(
  el: HTMLElement, player: StepPlayer<IqrParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const div = (cls: string): HTMLDivElement => {
    const d = doc.createElement('div');
    d.className = cls;
    return d;
  };

  const scene = div('iqr-scene');
  const cardsHost = div('iqr-cards-host');
  const plotHost = div('iqr-plot-host');
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(cardsHost, plotHost, strip);
  el.append(scene);

  const cards = new CardsLayer(cardsHost);
  const line = new LineLayer(plotHost, ds);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<IqrParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';

  /** Areas of the cards and the line (estimated where layout is unavailable). */
  function areas(): { cw: number; lw: number; lh: number } {
    const cr = cardsHost.getBoundingClientRect();
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) {
      return { cw: Math.floor(cr.width || pr.width), lw: Math.floor(pr.width), lh: Math.floor(pr.height) };
    }
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    const cardsH = Math.round(size!.h * 0.3);
    return { cw: size!.w - 32, lw: size!.w, lh: Math.max(120, size!.h - cardsH - stripH) };
  }

  function render(state: PlayerState<IqrParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('iqr-render-start');
    try {
      cards.interrupt();
      line.interrupt();
      const v = deriveIqrView(state.index, state.params);
      // slider / shortcut tweaks are instant; steps and sweeps animate
      const live = cause === 'param';
      const ms = ds > 0 && !instant && !live ? MS_STEP * ds : 0;

      scene.dataset.part = String(v.part);
      lastStrip = v.strip;
      renderStrip(strip, v.strip);
      const a = areas();
      cards.resize(a.cw, 0, mode);
      line.resize(a.lw, a.lh, mode);
      cards.update(v, ms);
      line.update(v, ms);
      rendered = true;
    } finally {
      if (hasPerf) performance.measure('iqr-render', 'iqr-render-start');
    }
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
      cards.destroy();
      line.destroy();
      scene.remove();
    },
  };
}
