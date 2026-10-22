import { stepIndex, type ChangeCause, type PlayerState, type StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { sepetData, type Basket, type Item, type Itemset } from '../birliktelik/data';
import { sortItems } from '../birliktelik/format';
import { rules } from '../birliktelik/rules';
import { drawPanel, type PanelKind, type PanelSpec } from './scene-panel';
import { mountFisTable, type RowFlag, type Role } from './scene-table';
import { FILTER_LIFT, MIN_CONFIDENCE, birliktelikOlculeriScenario as scenario, type BirliktelikOlculeriParams } from './scenario';
import { applyEdits } from './view';

const STEP_LIST = stepIndex(scenario, 'fisler');
const STEP_TABLE = stepIndex(scenario, 'tablo');
const STEP_SUPPORT1 = stepIndex(scenario, 'destek-tek');
const STEP_SUPPORT2 = stepIndex(scenario, 'destek-cift');
const STEP_CONF = stepIndex(scenario, 'guven');
const STEP_DIRECTION = stepIndex(scenario, 'guven-yon');
const STEP_TRAP = stepIndex(scenario, 'tuzak');
const STEP_REAL = stepIndex(scenario, 'gercek');
const STEP_RULES = stepIndex(scenario, 'kurallar');
const STEP_FILTER = stepIndex(scenario, 'suzgec');
const COUNT_STEPS = [STEP_SUPPORT1, STEP_SUPPORT2, STEP_CONF];
const COUNT_MS = 90;
const ROWS = sepetData.transactions.length;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function kindOf(index: number): PanelKind {
  if (index === STEP_LIST) return 'list';
  if (index === STEP_TABLE) return 'table';
  if (index === STEP_SUPPORT1) return 'support1';
  if (index === STEP_SUPPORT2) return 'support2';
  if (index === STEP_CONF || index === STEP_DIRECTION) return 'conf';
  if (index === STEP_TRAP) return 'trap';
  if (index === STEP_REAL) return 'real';
  return 'rules';
}

const known = (items: readonly Item[]): Item[] => sortItems(items.filter((i) => sepetData.items.includes(i)));
const has = (b: Basket, set: Itemset): boolean => set.length > 0 && set.every((i) => b.includes(i));

interface Reading {
  tx: Basket[];
  x: Item[];
  y: Item[];
  kind: PanelKind;
  flags: RowFlag[];
  cols: Map<Item, Role>;
  /** Baskets the count-up counts (numerator rows). */
  total: number;
}

/** Row flags and highlighted columns of a step, from the (edited) baskets and the chosen X and Y. */
function read(index: number, params: BirliktelikOlculeriParams, counted: number | null): Reading {
  const tx = applyEdits(params.edits);
  const x = known(params.x);
  const y = known(params.y).filter((i) => !x.includes(i));
  const kind = kindOf(index);
  const cols = new Map<Item, Role>();
  const flags: RowFlag[] = tx.map(() => ({ x: false, y: false, match: false, dim: false }));
  let isMatch = (_b: Basket): boolean => false;
  if (kind === 'support1') {
    for (const i of x) cols.set(i, 'x');
    isMatch = (b) => has(b, x);
    tx.forEach((b, r) => { flags[r].x = has(b, x); });
  } else if (kind === 'support2' || kind === 'conf' || kind === 'trap' || kind === 'real') {
    for (const i of x) cols.set(i, 'x');
    for (const i of y) cols.set(i, 'y');
    isMatch = (b) => has(b, x) && has(b, y);
    tx.forEach((b, r) => {
      flags[r].x = has(b, x);
      flags[r].y = has(b, y);
      flags[r].dim = kind !== 'support2' && x.length > 0 && y.length > 0 && !has(b, x);
    });
  }
  let rank = 0;
  tx.forEach((b, r) => {
    if (!isMatch(b)) return;
    flags[r].match = counted === null || rank < counted;
    rank++;
  });
  return { tx, x, y, kind, flags, cols, total: rank };
}

const TAGGED: readonly PanelKind[] = ['support2', 'conf', 'trap', 'real'];

export function mountBirliktelikOlculeriScene(host: HTMLElement, player: StepPlayer<BirliktelikOlculeriParams>, initialMode: Mode): SceneHandle {
  const root = el('div', 'bk-scene');
  root.dataset.mode = initialMode;
  const tableHost = el('div', 'bk-table-host');
  // Room for the rule scatter of steps 9-10 (drawn in a later task).
  const rulesSlot = el('div', 'bk-rules-slot');
  rulesSlot.dataset.slot = 'rules';
  const panel = el('aside', 'bk-panel');
  panel.setAttribute('aria-live', 'polite');
  root.append(tableHost, rulesSlot, panel);
  host.append(root);
  const fis = mountFisTable(tableHost, ROWS);

  let destroyed = false;
  /** Step 3-5 count-up: baskets counted so far (null = counting is done or not running). */
  let counted: number | null = null;
  /** Step index of the last emit; play/pause re-emit 'step' with the same index and must not restart the count-up. */
  let lastIndex = player.state.index;
  let countTimer: ReturnType<typeof setInterval> | null = null;

  const stopCount = (): void => {
    if (countTimer !== null) clearInterval(countTimer);
    countTimer = null;
    counted = null;
    panel.setAttribute('aria-live', 'polite');
  };

  function panelSpec(s: PlayerState<BirliktelikOlculeriParams>, r: Reading): PanelSpec {
    const { index, params } = s;
    const spec: PanelSpec = { kind: r.kind, tx: r.tx, x: r.x, y: r.y, counted };
    if (index === STEP_TABLE) spec.code = ['TransactionEncoder().fit(...).transform(...)'];
    if (r.kind === 'rules') {
      const all = rules(r.tx, params.minSupport, params.minConfidence);
      const filtering = params.minLift > 0;
      const kept = filtering ? all.filter((q) => q.lift > params.minLift + 1e-9) : all;
      spec.rules = { total: all.length, kept: kept.length, filtering, minLift: params.minLift };
      if (index === STEP_FILTER) {
        spec.code = [
          `association_rules(..., metric="confidence", min_threshold=${MIN_CONFIDENCE})`,
          `kurallar[kurallar["lift"] > ${FILTER_LIFT}]`,
        ];
      }
    }
    return spec;
  }

  function paint(s: PlayerState<BirliktelikOlculeriParams>, r: Reading): void {
    fis.update({ tx: r.tx, cols: r.cols, rows: r.flags, bars: s.index === STEP_SUPPORT1, tags: TAGGED.includes(r.kind) });
  }

  function render(s: PlayerState<BirliktelikOlculeriParams>): void {
    if (destroyed) return;
    const r = read(s.index, s.params, counted);
    root.dataset.view = s.index === STEP_LIST ? 'list' : s.index >= STEP_RULES ? 'rules' : 'table';
    root.dataset.counting = String(counted !== null);
    drawPanel(panel, panelSpec(s, r));
    paint(s, r);
  }

  /** A count-up tick: the number and the counted rows change in place; the panel is rebuilt only when the count ends. */
  function tickCount(s: PlayerState<BirliktelikOlculeriParams>): void {
    if (destroyed) return;
    const num = panel.querySelector('[data-count]');
    if (!num) {
      render(s);
      return;
    }
    const shown = String(counted ?? 0);
    num.textContent = shown;
    num.setAttribute('data-count', shown);
    paint(s, read(s.index, s.params, counted));
  }

  const startCount = (s: PlayerState<BirliktelikOlculeriParams>): void => {
    stopCount();
    if (!COUNT_STEPS.includes(s.index) || reducedMotion()) return;
    const total = read(s.index, s.params, null).total;
    if (total === 0) return;
    counted = 0;
    // The count-up is silent for screen readers; the panel announces once, with the final count.
    panel.setAttribute('aria-live', 'off');
    countTimer = setInterval(() => {
      counted = (counted ?? 0) + 1;
      if (counted >= total) {
        stopCount();
        render(player.state);
      } else tickCount(player.state);
    }, COUNT_MS);
  };

  const unsubscribe = player.subscribe((s: PlayerState<BirliktelikOlculeriParams>, cause: ChangeCause) => {
    if (cause === 'step') {
      if (s.index !== lastIndex) startCount(s);
    } else if (cause === 'param') stopCount();
    lastIndex = s.index;
    render(s);
  });
  startCount(player.state);
  render(player.state);

  return {
    resize(): void {
      render(player.state);
    },
    setMode(m: Mode): void {
      root.dataset.mode = m;
      render(player.state);
    },
    destroy(): void {
      destroyed = true;
      stopCount();
      unsubscribe();
      root.remove();
    },
  };
}
