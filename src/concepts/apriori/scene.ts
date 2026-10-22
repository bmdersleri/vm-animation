import { stepIndex, type ChangeCause, type PlayerState, type StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { sepetData } from '../birliktelik/data';
import { itemAbbr, itemName } from '../birliktelik/format';
import { mountLattice, STATE_NAME, type Lattice } from './scene-lattice';
import { aprioriScenario as scenario, type AprioriParams } from './scenario';
import { TOTAL, analyse, counters, paintLattice, pruneReasons, rareNotes, scanKeys, thresholdText, type NodeState } from './view';

const STEP_L1 = stepIndex(scenario, 'seviye1');
const STEP_PROPERTY = stepIndex(scenario, 'ozellik');
const STEP_L2 = stepIndex(scenario, 'seviye2');
const STEP_FP = stepIndex(scenario, 'fp-sira');
/** Steps whose level is counted candidate by candidate, and which level that is. */
const SCAN_LEVEL = new Map<number, number>([[STEP_L1, 1], [STEP_L2, 2]]);
const SCAN_MS = 260;
/** Scene width from which the legend sits beside the lattice; narrower scenes stack it below. */
const WIDE_FROM = 1000;
const ASIDE_WIDTH = 230;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};

const KEY_STATES: NodeState[] = ['unseen', 'candidate', 'frequent', 'infrequent', 'pruned'];

export function mountAprioriScene(host: HTMLElement, player: StepPlayer<AprioriParams>, initialMode: Mode): SceneHandle {
  const root = el('div', 'ap-scene');
  root.dataset.mode = initialMode;
  const head = el('header', 'ap-head');
  const threshold = el('p', 'ap-threshold');
  const countersEl = el('p', 'ap-counters');
  const counted = el('span', 'ap-counter');
  counted.dataset.counter = 'counted';
  const frequent = el('span', 'ap-counter');
  frequent.dataset.counter = 'frequent';
  countersEl.append(counted, frequent);
  head.append(threshold, countersEl);

  const latticeHost = el('div', 'ap-lattice-host');
  const fpSlot = el('div', 'ap-fp-slot');
  fpSlot.dataset.slot = 'fptree';

  const aside = el('aside', 'ap-aside');
  aside.setAttribute('aria-live', 'polite');
  const letters = el('p', 'ap-letters');
  letters.append(...sepetData.items.map((i) => el('span', 'ap-letter', `${itemAbbr(i)} ${itemName(i)}`)));
  const key = el('ul', 'ap-key');
  for (const st of KEY_STATES) {
    const li = el('li', 'ap-key-item');
    const swatch = el('span', 'ap-swatch');
    swatch.dataset.state = st;
    li.append(swatch, el('span', 'ap-key-text', STATE_NAME[st] + (st === 'unseen' ? '' : st === 'candidate' ? ' (aday)' : '')));
    key.append(li);
  }
  const notes = el('ul', 'ap-notes');
  aside.append(letters, key, notes);

  root.append(head, latticeHost, fpSlot, aside);
  host.append(root);
  const lattice: Lattice = mountLattice(latticeHost);
  let size = { w: 900, h: 560 };

  let destroyed = false;
  /** Candidates of the scanned level counted so far; null = not scanning. */
  let scanned: number | null = null;
  /** Step index of the last emit; play/pause re-emit 'step' with the same index and must not restart the scan. */
  let lastIndex = player.state.index;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopScan = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    scanned = null;
    aside.setAttribute('aria-live', 'polite');
  };

  function render(s: PlayerState<AprioriParams>): void {
    if (destroyed) return;
    const { minCount, level } = s.params;
    const fpView = s.index >= STEP_FP;
    const wide = size.w >= WIDE_FROM;
    root.dataset.view = fpView ? 'fptree' : 'lattice';
    root.dataset.layout = wide ? 'wide' : 'narrow';
    root.style.setProperty('--ap-aside', `${ASIDE_WIDTH}px`);
    const scanLevel = SCAN_LEVEL.get(s.index);
    const scan = scanned !== null && scanLevel !== undefined ? { level: scanLevel, scanned } : null;
    const painted = paintLattice({ minCount, level, pruneSingles: s.index >= STEP_PROPERTY, scan });
    const c = counters(painted);
    setText(threshold, thresholdText(minCount));
    setText(counted, `sayılan aday: ${c.counted} / ${TOTAL}`);
    setText(frequent, `sık küme: ${c.frequent}`);
    root.dataset.counting = String(scan !== null);

    const reasons = s.index >= STEP_PROPERTY ? pruneReasons(minCount, level).map((r) => r.text) : [];
    const rare = s.index >= STEP_PROPERTY && level >= 1 ? rareNotes(minCount) : [];
    const lines = [...rare, ...reasons];
    const sig = lines.join('\n');
    if (notes.dataset.sig !== sig) {
      notes.dataset.sig = sig;
      notes.replaceChildren(...lines.map((t) => el('li', 'ap-note', t)));
    }

    if (fpView) return;
    latticeHost.style.minHeight = '';
    const w = latticeHost.clientWidth || Math.max(240, size.w - (wide ? ASIDE_WIDTH + 24 : 12));
    const h = latticeHost.clientHeight || Math.max(240, size.h - (wide ? 70 : 230));
    lattice.update({ painted, width: w, height: h, compact: w < 520 });
    if (lattice.needed > h + 1) latticeHost.style.minHeight = `${Math.ceil(lattice.needed)}px`;
  }

  const startScan = (s: PlayerState<AprioriParams>): void => {
    stopScan();
    const lv = SCAN_LEVEL.get(s.index);
    if (lv === undefined || reducedMotion()) return;
    const total = scanKeys(analyse(s.params.minCount), lv).length;
    if (total === 0) return;
    scanned = 0;
    // The scan is silent for screen readers.
    aside.setAttribute('aria-live', 'off');
    timer = setInterval(() => {
      scanned = (scanned ?? 0) + 1;
      if (scanned >= total) stopScan();
      render(player.state);
    }, SCAN_MS);
  };

  const unsubscribe = player.subscribe((s: PlayerState<AprioriParams>, cause: ChangeCause) => {
    // A jump onto a sweep step emits 'sweep', not 'step', so the index decides, whatever the cause.
    if (s.index !== lastIndex) startScan(s);
    else if (cause === 'param') stopScan();
    lastIndex = s.index;
    render(s);
  });
  startScan(player.state);
  render(player.state);

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      render(player.state);
    },
    setMode(m: Mode): void {
      root.dataset.mode = m;
      render(player.state);
    },
    destroy(): void {
      destroyed = true;
      stopScan();
      unsubscribe();
      lattice.destroy();
      root.remove();
    },
  };
}
