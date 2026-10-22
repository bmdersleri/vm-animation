import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { sepetData, type Item } from '../birliktelik/data';
import { itemName, sortItems } from '../birliktelik/format';
import { birliktelikOlculeriScenario as scenario, type BirliktelikOlculeriParams } from './scenario';
import { applyEdits, toggleEdit } from './view';

type Params = BirliktelikOlculeriParams;

const ITEMS = sepetData.items;
const ROWS = sepetData.transactions.length;
const SUPPORT = { min: 0.05, max: 0.6 };
const CONFIDENCE = { min: 0.1, max: 1 };
/** The lift slider's lowest position means "no lift filter". */
const LIFT = { min: 0.5, max: 2 };

const STEP = {
  list: stepIndex(scenario, 'fisler'),
  support1: stepIndex(scenario, 'destek-tek'),
  support2: stepIndex(scenario, 'destek-cift'),
  real: stepIndex(scenario, 'gercek'),
  rules: stepIndex(scenario, 'kurallar'),
  filter: stepIndex(scenario, 'suzgec'),
};

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** Thresholds stay on the 0.05 grid: rounding removes floating error such as 0.15000000000000002. */
const snap = (v: number, lo: number, hi: number): number => clamp(Math.round(v * 20) / 20, lo, hi);
export const snapSupport = (v: number): number => snap(v, SUPPORT.min, SUPPORT.max);
export const snapConfidence = (v: number): number => snap(v, CONFIDENCE.min, CONFIDENCE.max);
/** 0 = filter off (the slider's lowest position); otherwise a lift on the 0.05 grid. */
export const snapLift = (v: number): number => (v <= LIFT.min + 1e-9 ? 0 : snap(v, LIFT.min, LIFT.max));

/**
 * Lab parameter panel. Each step shows only its own controls:
 * receipts, rule steps 9-10: basket editor (the table is not on screen); table steps: cells edit the baskets;
 * step 3: X chips; steps 4-8: X and Y chips; steps 9-10: threshold sliders. "Sıfırla" is always there.
 */
export function mountBirliktelikOlculeriParams(host: HTMLElement, player: StepPlayer<Params>): void {
  const id = `bkp${++uid}`;

  // ---- basket editor ----
  const fisIn = el('input', { type: 'number', id: `${id}-fis`, 'data-param': 'basket', min: '1', max: String(ROWS), step: '1', inputmode: 'numeric', value: '1' });
  const cellBtns = ITEMS.map((item) => {
    const b = el('button', { type: 'button', class: 'bk-chip', 'data-edit-item': item, 'aria-pressed': 'false' }, itemName(item));
    return b;
  });
  const editor = el('div', { class: 'ctl bk-editor', 'data-ctl': 'editor' },
    el('label', { for: fisIn.id }, `Fiş (1–${ROWS})`), fisIn,
    el('div', { class: 'bk-chips', role: 'group', 'aria-label': 'Fişteki ürünler' }, ...cellBtns));
  let basket = 0;
  fisIn.addEventListener('input', () => {
    const v = Math.trunc(Number(fisIn.value));
    if (fisIn.value.trim() === '' || !Number.isFinite(v) || v < 1 || v > ROWS) return;
    basket = v - 1;
    sync();
  });
  cellBtns.forEach((b, col) => b.addEventListener('click', () => {
    player.setParams({ edits: toggleEdit(player.state.params.edits, basket * ITEMS.length + col) });
  }));

  // ---- X / Y chips ----
  const chipGroup = (key: 'x' | 'y', title: string): { group: HTMLElement; title: HTMLElement; chips: Map<Item, HTMLButtonElement> } => {
    const chips = new Map<Item, HTMLButtonElement>();
    const titleEl = el('span', { class: 'bk-ctl-title', id: `${id}-${key}` }, title);
    const box = el('div', { class: 'bk-chips', role: 'group', 'aria-labelledby': titleEl.id });
    for (const item of ITEMS) {
      const b = el('button', { type: 'button', class: 'bk-chip', 'data-chip': key, 'data-item': item, 'aria-pressed': 'false' }, itemName(item));
      b.addEventListener('click', () => {
        const cur = player.state.params[key];
        const next = cur.includes(item) ? cur.filter((i) => i !== item) : sortItems([...cur, item]);
        player.setParams({ [key]: next } as Partial<Params>);
      });
      chips.set(item, b);
      box.append(b);
    }
    return { group: el('div', { class: 'ctl bk-pick', 'data-ctl': key }, titleEl, box), title: titleEl, chips };
  };
  const xPick = chipGroup('x', 'Öncül (X)');
  const yPick = chipGroup('y', 'Sonuç (Y)');

  // ---- threshold sliders ----
  const slider = (key: 'minSupport' | 'minConfidence' | 'minLift', label: string, lo: number, hi: number, onInput: (v: number) => void) => {
    const input = el('input', { type: 'range', id: `${id}-${key}`, 'data-param': key, min: String(lo), max: String(hi), step: '0.05' });
    const out = el('output', { class: 'bk-out', for: input.id });
    const group = el('div', { class: 'ctl range', 'data-ctl': key }, el('label', { for: input.id }, label), input, out);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) onInput(v);
    });
    return { group, input, out };
  };
  const sSup = slider('minSupport', 'min_support', SUPPORT.min, SUPPORT.max, (v) => player.setParams({ minSupport: snapSupport(v) }));
  const sConf = slider('minConfidence', 'min güven', CONFIDENCE.min, CONFIDENCE.max, (v) => player.setParams({ minConfidence: snapConfidence(v) }));
  const sLift = slider('minLift', 'min kaldıraç', LIFT.min, LIFT.max, (v) => player.setParams({ minLift: snapLift(v) }));

  // ---- reset ----
  const reset = el('button', { type: 'button', class: 'bk-reset', 'data-ctl': 'reset' }, 'Sıfırla');
  reset.addEventListener('click', () => player.setParams({ edits: [] }));
  const resetNote = el('span', { class: 'bk-ctl-hint', id: `${id}-reset` }, 'Sepet kitaptaki 18 fişe döner.');
  reset.setAttribute('aria-describedby', resetNote.id);

  host.append(el('div', { class: 'bk-params' }, editor, xPick.group, yPick.group, sSup.group, sConf.group, sLift.group,
    el('div', { class: 'ctl bk-reset-box', 'data-ctl': 'reset-box' }, reset, resetNote)));

  // Only values that differ are written back, so focus and a slider mid-drag are left alone.
  function sync(): void {
    const { index, params } = player.state;
    const baskets = applyEdits(params.edits);
    const editing = index === STEP.list || index >= STEP.rules;
    editor.hidden = !editing;
    xPick.group.hidden = !(index >= STEP.support1 && index <= STEP.real);
    yPick.group.hidden = !(index >= STEP.support2 && index <= STEP.real);
    setText(xPick.title, index === STEP.support1 ? 'Ürün' : 'Öncül (X)');
    const thresholds = index >= STEP.rules;
    for (const g of [sSup, sConf, sLift]) g.group.hidden = !thresholds;

    for (const [item, b] of xPick.chips) {
      const on = params.x.includes(item);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = params.y.includes(item);
    }
    for (const [item, b] of yPick.chips) {
      const on = params.y.includes(item);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = params.x.includes(item);
    }
    cellBtns.forEach((b, col) => b.setAttribute('aria-pressed', String(baskets[basket].includes(ITEMS[col]))));
    if (document.activeElement !== fisIn && fisIn.value !== String(basket + 1)) fisIn.value = String(basket + 1);

    const sup = snapSupport(params.minSupport);
    const conf = snapConfidence(params.minConfidence);
    const lift = snapLift(params.minLift);
    if (Number(sSup.input.value) !== sup) sSup.input.value = String(sup);
    if (Number(sConf.input.value) !== conf) sConf.input.value = String(conf);
    const liftPos = lift === 0 ? LIFT.min : lift;
    if (Number(sLift.input.value) !== liftPos) sLift.input.value = String(liftPos);
    setText(sSup.out, `min_support = ${formatNumber(sup, 2)}`);
    setText(sConf.out, `min güven = ${formatNumber(conf, 2)}`);
    setText(sLift.out, lift === 0 ? 'min kaldıraç: kapalı' : `min kaldıraç = ${formatNumber(lift, 2)}`);
  }
  sync();
  player.subscribe(sync);
}
