import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import type { NbParams } from './scenario';
import { deriveNbView, type NbPart, type NbView } from './view';
import { IconsLayer } from './scene-icons';
import { BarLayer } from './scene-bar';
import { GaussLayer, type QueryPointer } from './scene-gauss';

const MS_STEP = 450;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

export type NbSceneHandle = SceneHandle & {
  /** Lab drags of the new customer in part 3, already clamped (scene-gauss.ts). */
  onPointer(cb: QueryPointer): void;
};

/**
 * One part's layer inside `div.nb-main`: it gets the area it may fill and the
 * view on every render while its part shows.
 */
export interface NbPartLayer {
  resize(w: number, h: number, mode: Mode): void;
  update(v: NbView, ms: number): void;
  interrupt(): void;
  /** Optional: the part was hidden, so its next update is an entry. */
  leave?(): void;
  destroy(): void;
}

/**
 * Naive Bayes scene. Part 1 is the 1.000-person icon table (scene-icons.ts),
 * part 2 the sliding posterior bar with its trail (scene-bar.ts), part 3 the
 * GaussianNB scatter with bell curves and regions (scene-gauss.ts). Under every part the
 * calculation strip is an HTML `p.formula` (one `span.line` per line, wrapping
 * between terms, never shrinking). Every render interrupts all running
 * transitions first, so rapid step changes end in the final state; player
 * changes are coalesced to one render per animation frame.
 */
export function mountNbScene(
  el: HTMLElement, player: StepPlayer<NbParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): NbSceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const div = (cls: string): HTMLDivElement => {
    const d = doc.createElement('div');
    d.className = cls;
    return d;
  };

  // ---- DOM: the part hosts stacked in div.nb-main, the strip below them
  const scene = div('nb-scene');
  const main = div('nb-main');
  const hosts: Record<NbPart, HTMLDivElement> = { 1: div('nb-icons'), 2: div('nb-bar'), 3: div('nb-gauss') };
  main.append(hosts[1], hosts[2], hosts[3]);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(main, strip);
  el.append(scene);

  const gaussLayer = new GaussLayer(hosts[3]);
  const layers: Record<NbPart, NbPartLayer> = {
    1: new IconsLayer(hosts[1]),
    2: new BarLayer(hosts[2]),
    3: gaussLayer,
  };

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let shownPart: NbPart | null = null;
  let stripText: string | null = null;
  let pending: { s: PlayerState<NbParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;

  function interruptAll(): void {
    for (const l of Object.values(layers)) l.interrupt();
  }

  /** One `span.line` per "\n"-separated line, one nowrap `span.term` per term so long lines wrap between terms. */
  function setStrip(text: string): void {
    if (text === stripText) return;
    stripText = text;
    strip.replaceChildren(...text.split('\n').map((line) => {
      const l = doc.createElement('span');
      l.className = 'line';
      l.append(...line.split(/(?= = | → | {2}vs {2})/).map((t) => {
        const s = doc.createElement('span');
        s.className = 'term';
        s.textContent = t.trim();
        return s;
      }));
      return l;
    }));
  }

  /** Area left for the part layer above the strip (estimated where layout is unavailable). */
  function mainSize(part: NbPart): { w: number; h: number } {
    const r = main.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: Math.floor(r.width), h: Math.floor(r.height) };
    const lines = part === 1 ? 2 : Math.max(1, (stripText ?? '').split('\n').length);
    const stripH = Math.ceil(lines * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(40, size!.h - stripH) };
  }

  // ---------------------------------------------------------------- render
  function render(state: PlayerState<NbParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    interruptAll();
    const v = deriveNbView(state.index, state.params);
    // part 1 and 3 params come from sliders and drags: instant; part 2's word and α toggles slide
    const live = cause === 'param' && v.part !== 2;
    const ms = ds > 0 && !instant && !live ? MS_STEP * ds : 0;

    scene.dataset.part = String(v.part);
    for (const p of [1, 2, 3] as const) hosts[p].hidden = p !== v.part;
    if (shownPart !== null && shownPart !== v.part) layers[shownPart].leave?.();
    shownPart = v.part;
    setStrip(v.strip);
    const layer = layers[v.part];
    const a = mainSize(v.part);
    layer.resize(a.w, a.h, mode);
    layer.update(v, ms);
    rendered = true;
  }

  // ---------------------------------------------------------------- player → render
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

  // ---------------------------------------------------------------- handle
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
      interruptAll();
      for (const l of Object.values(layers)) l.destroy();
      scene.remove();
    },
    onPointer(cb: QueryPointer): void {
      gaussLayer.onPointer(cb);
    },
  };
}
