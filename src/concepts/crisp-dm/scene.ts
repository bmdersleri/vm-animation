import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { BODY_FALLBACK } from '../../core/plot/text-measure';
import { allowCodeBreaks, renderStrip } from '../../core/plot/strip';
import { GroupsPlot, resultsCard } from './card-results';
import { cleanCard, goalCard, highlightOf, introCard, leakCard, summaryCard, tableCard } from './card-tables';
import { cellOf } from './data';
import { crispDmScenario, type CrispParams } from './scenario';
import { CycleScene, pathReason } from './scene-cycle';
import { CodeSection } from './scene-code';
import { el, NARROW } from './scene-base';
import { deriveCrispView, type CrispView } from './view';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;

/** Gap between the cycle and the card, and the share of a narrow area the cycle may take. */
const GAP = 12;
const NARROW_CYCLE_SHARE = 0.48;
/** A narrow cycle is at least this tall (px): the two decisions need the height to clear their neighbours; the card takes the rest and scrolls. */
const NARROW_CYCLE_MIN = 340;
/** Below this stage width (px) the stage is tall: it grows to its content (cycle, then the whole card) and the page scrolls. */
const TALL = 600;
/** A stacked cycle on a stage that cannot grow (the Lab beside its controls): flat rhombi keep it low. */
const STACKED_CYCLE_MIN = 250;
/** Share of a wide stage's width the cycle takes. */
const WIDE_CYCLE_SHARE = 0.5;
/** Side padding of the card (CSS: .phase-card padding). */
const CARD_PAD = 12;

/** The card area: generic cards are rebuilt when their data changes; the bars and the code panel persist. */
class PhaseCard {
  readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly groups: GroupsPlot;
  private readonly code: CodeSection;
  private lastKey = '';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'phase-card');
    this.body = el(doc, 'div', 'card-body');
    this.root.append(this.body);
    this.groups = new GroupsPlot(this.root);
    this.code = new CodeSection(this.root);
    host.append(this.root);
  }

  resize(w: number, mode: Mode): void {
    this.groups.resize(w - 2 * CARD_PAD, mode);
  }

  interrupt(): void {
    this.groups.interrupt();
  }

  destroy(): void {
    this.groups.destroy();
    this.code.destroy();
    this.root.remove();
  }

  update(v: CrispView, ms: number): void {
    const doc = this.root.ownerDocument;
    this.groups.root.hidden = v.card !== 'groups';
    this.code.root.hidden = v.card !== 'code';
    this.body.hidden = v.card === 'groups' || v.card === 'code';
    const key = JSON.stringify([v.stepId, v.card, v.hypothetical, v[v.card as keyof CrispView] ?? null]);
    if (v.card === 'groups') {
      this.body.replaceChildren();
      this.lastKey = '';
      this.groups.update(v.groups!, ms);
      return;
    }
    if (v.card === 'code') {
      this.body.replaceChildren();
      this.lastKey = '';
      this.code.update(v.code!);
      return;
    }
    if (key === this.lastKey) {
      return;
    }
    this.lastKey = key;
    let content: HTMLElement;
    switch (v.card) {
      case 'intro':
        content = introCard(doc, v.intro!.lines);
        break;
      case 'goal':
        content = goalCard(doc, v.goal!);
        break;
      case 'table':
        content = tableCard(doc, v.table!, highlightOf(v));
        break;
      case 'summary':
        content = summaryCard(doc, v.summary!);
        break;
      case 'clean':
        content = cleanCard(doc, v.clean!);
        break;
      case 'leak':
        content = leakCard(doc, v.leak!);
        break;
      default:
        content = resultsCard(doc, v.results!, v.hypothetical, v.stepId === 'ikinci-tur');
        break;
    }
    this.body.replaceChildren(content);
  }
}

/**
 * Scene host of the CRISP-DM page: a stage with the cycle (left; narrow: on top, at most 48 percent of the area)
 * and the phase card (right; narrow: below, scrolling inside itself) above the formula strip. Updates coalesce into
 * one frame; Lab control changes render without interpolation.
 */
export function mountCrispScene(
  el0: HTMLElement,
  player: StepPlayer<CrispParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = el0.ownerDocument;
  const scene = el(doc, 'div', 'crisp-scene');
  const stage = el(doc, 'div', 'crisp-stage');
  const cycleHost = el(doc, 'div', 'crisp-cycle-host');
  const cardHost = el(doc, 'div', 'crisp-card-host');
  stage.append(cycleHost, cardHost);
  const strip = el(doc, 'p', 'formula');
  scene.append(stage, strip);
  el0.append(scene);

  const cycle = new CycleScene(cycleHost);
  const card = new PhaseCard(cardHost);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<CrispParams>; cause: ChangeCause } | null = null;
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

  /** One render, timed as the `crisp-render` measure for the performance spec. */
  function render(state: PlayerState<CrispParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) {
      return;
    }
    const hasPerf = typeof performance !== 'undefined' && typeof performance.mark === 'function';
    if (hasPerf) {
      performance.mark('crisp-render-start');
    }
    try {
      draw(state, cause, instant);
    } finally {
      if (hasPerf) {
        performance.measure('crisp-render', 'crisp-render-start');
      }
    }
  }

  function draw(state: PlayerState<CrispParams>, cause: ChangeCause, instant: boolean): void {
    cycle.interrupt();
    card.interrupt();
    const lab = mode === 'lab';
    const p = state.params;
    const v = deriveCrispView(state.index, p, lab);
    // slider and shortcut tweaks are instant; steps and sweep stops animate
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    stage.dataset.step = v.stepId;
    stage.dataset.card = v.card;
    lastStrip = v.strip;
    renderStrip(strip, v.strip);
    allowCodeBreaks(strip);
    const a = area();
    // the layout follows the stage's own width, not the window: the Lab stage is narrow in a wide window
    const narrow = a.w < NARROW;
    const tall = a.w < TALL;
    stage.toggleAttribute('data-narrow', narrow);
    stage.toggleAttribute('data-tall', tall);
    const cycleW = narrow ? a.w : Math.floor((a.w - GAP) * WIDE_CYCLE_SHARE);
    // a tall stage takes its height from the content, so the cycle's height must not depend on the area's
    let cycleH = a.h;
    if (tall) {
      cycleH = NARROW_CYCLE_MIN;
    } else if (narrow) {
      cycleH = Math.max(STACKED_CYCLE_MIN, Math.floor(a.h * NARROW_CYCLE_SHARE));
    }
    stage.style.setProperty('--cycle-w', `${cycleW}px`);
    stage.style.setProperty('--cycle-h', `${cycleH}px`);
    cycle.resize(cycleW, cycleH, mode);
    card.resize(narrow ? a.w : a.w - cycleW - GAP, mode);
    cycle.update(v, ms, lab && v.route ? pathReason(cellOf(p.days, p.missing, p.stock, p.leak)) : null);
    card.update(v, ms);
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
    const sweep = crispDmScenario.steps[s.index].sweep;
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
      cycle.destroy();
      card.destroy();
      scene.remove();
    },
  };
}
