import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { renderStrip } from '../../core/plot/strip';
import type { Rect } from '../../core/plot/viewport';
import type { SecimParams } from './scenario';
import { deriveSecimView } from './view';
import { RowsLayer } from './scene-rows';
import { IntersectLayer } from './scene-intersect';

const SVGNS = 'http://www.w3.org/2000/svg';
/** Body font px when layout is unavailable (jsdom); matches theme.css at 1280 px. */

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * `ozellik-secimi` scene: `svg.secim-plot` with the eight column rows (steps 1-9)
 * or the intersection lists (step 10) above, and the calculation strip
 * (`p.formula`) below. Every render interrupts the layers first, so rapid step
 * changes end in the final state; player changes are coalesced to one render per
 * animation frame. Steps and RFE sweep rounds animate; Lab parameter changes draw
 * instantly.
 */
export function mountSecimScene(
  el: HTMLElement, player: StepPlayer<SecimParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const div = (cls: string): HTMLDivElement => {
    const d = doc.createElement('div');
    d.className = cls;
    return d;
  };

  const scene = div('secim-scene');
  const plotHost = div('secim-plot-host');
  const svg = doc.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'secim-plot');
  plotHost.append(svg);
  const strip = doc.createElement('p');
  strip.className = 'formula';
  scene.append(plotHost, strip);
  el.append(scene);

  const rows = new RowsLayer(svg, ds);
  const intersect = new IntersectLayer(plotHost);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<SecimParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;
  let lastStrip = '';
  let laidOut = '';

  /** Size of the plot area (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const pr = plotHost.getBoundingClientRect();
    if (pr.width > 0 && pr.height > 0) return { w: Math.floor(pr.width), h: Math.floor(pr.height) };
    const lines = Math.max(1, lastStrip.split('\n').length);
    const stripH = Math.ceil(Math.max(2, lines) * BODY_FALLBACK[mode] * 1.35 + 12 + 10);
    return { w: size!.w, h: Math.max(120, size!.h - stripH) };
  }

  function layout(): void {
    const { w, h } = area();
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    const key = `${mode} ${w} ${h}`;
    if (key === laidOut) return;
    laidOut = key;
    const full: Rect = { left: 0, top: 0, width: w, height: h };
    rows.layout(full, mode);
  }

  function render(state: PlayerState<SecimParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) performance.mark('secim-render-start');
    try {
      rows.interrupt();
      const v = deriveSecimView(state.index, state.params);
      // Lab slider changes are instant; steps and sweep rounds animate
      const ms = ds > 0 && !instant && cause !== 'param' ? 1 : 0;

      scene.dataset.view = v.mode;
      lastStrip = v.strip;
      renderStrip(strip, v.strip);
      layout();
      rows.update(v, ms);
      intersect.update(v);
      rendered = true;
    } finally {
      if (hasPerf) performance.measure('secim-render', 'secim-render-start');
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
      rows.destroy();
      intersect.destroy();
      scene.remove();
    },
  };
}
