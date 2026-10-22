import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { sepetData } from '../birliktelik/data';
import { itemName } from '../birliktelik/format';
import { aprioriScenario as scenario, type AprioriParams } from './scenario';
import { LEVELS, fpFor } from './view';

type Params = AprioriParams;

const ITEMS = sepetData.items;
const BASKETS = sepetData.transactions.length;

const STEP = {
  level1: stepIndex(scenario, 'seviye1'),
  stop: stepIndex(scenario, 'dur'),
  order: stepIndex(scenario, 'fp-sira'),
  build: stepIndex(scenario, 'fp-agac'),
  base: stepIndex(scenario, 'kosullu'),
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
const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

/** "0,222 · en az 4 fiş": the ratio of a basket count, as the min_support it stands for. */
export const minSupportText = (minCount: number): string => `${formatNumber(minCount / BASKETS, 3)} · en az ${minCount} fiş`;

/**
 * Lab parameter panel. Each step shows only its own controls:
 * 1 none; 2-6 level stepper + min_support; 7 min_support; 8-9 basket slider + min_support;
 * 10 product picker + min_support; 11 min_support. A lattice node is picked in the scene itself.
 */
export function mountAprioriParams(host: HTMLElement, player: StepPlayer<Params>): void {
  const id = `app${++uid}`;

  // ---- min_support: 1..18 baskets ----
  const supIn = el('input', { type: 'range', id: `${id}-sup`, 'data-param': 'minCount', min: '1', max: String(BASKETS), step: '1' });
  const supOut = el('output', { class: 'ap-out', for: supIn.id });
  const support = el('div', { class: 'ctl range', 'data-ctl': 'minCount' }, el('label', { for: supIn.id }, 'min_support'), supIn, supOut);
  supIn.addEventListener('input', () => {
    const v = Number(supIn.value);
    if (Number.isFinite(v)) player.setParams({ minCount: clampInt(v, 1, BASKETS) });
  });

  // ---- level stepper ----
  const levelOut = el('output', { class: 'ap-out', 'data-out': 'level' });
  const button = (act: string, label: string): HTMLButtonElement => el('button', { type: 'button', class: 'ap-btn', 'data-act': act }, label);
  const prev = button('prev', '◀ seviye');
  const next = button('next', 'seviye ▶');
  const last = button('last', 'Sona git');
  const levelTitle = el('span', { class: 'ap-ctl-title' }, 'Seviye');
  const level = el('div', { class: 'ctl ap-level-ctl', 'data-ctl': 'level' }, levelTitle, el('div', { class: 'ap-btns', role: 'group', 'aria-label': 'Seviye' }, prev, next, last, levelOut));
  const goLevel = (to: number): void => player.setParams({ level: clampInt(to, 1, LEVELS) });
  prev.addEventListener('click', () => goLevel(player.state.params.level - 1));
  next.addEventListener('click', () => goLevel(player.state.params.level + 1));
  last.addEventListener('click', () => goLevel(LEVELS));

  // ---- baskets inserted ----
  const insIn = el('input', { type: 'range', id: `${id}-ins`, 'data-param': 'inserted', min: '0', max: String(BASKETS), step: '1' });
  const insOut = el('output', { class: 'ap-out', for: insIn.id });
  const inserted = el('div', { class: 'ctl range', 'data-ctl': 'inserted' }, el('label', { for: insIn.id }, 'Eklenen fiş'), insIn, insOut);
  insIn.addEventListener('input', () => {
    const v = Number(insIn.value);
    if (Number.isFinite(v)) player.setParams({ inserted: clampInt(v, 0, BASKETS) });
  });

  // ---- conditional-base product ----
  const chips = new Map<string, HTMLButtonElement>();
  const baseTitle = el('span', { class: 'ap-ctl-title', id: `${id}-base` }, 'Koşullu taban ürünü');
  const box = el('div', { class: 'ap-chips', role: 'group', 'aria-labelledby': baseTitle.id });
  for (const item of ITEMS) {
    const b = el('button', { type: 'button', class: 'ap-chip', 'data-item': item, 'aria-pressed': 'false' }, itemName(item));
    b.addEventListener('click', () => player.setParams({ baseItem: item }));
    chips.set(item, b);
    box.append(b);
  }
  const base = el('div', { class: 'ctl ap-pick', 'data-ctl': 'baseItem' }, baseTitle, box);

  host.append(el('div', { class: 'ap-params' }, support, level, inserted, base));

  // Only values that differ are written back, so focus and a slider mid-drag are left alone.
  function sync(): void {
    const { index, params } = player.state;
    support.hidden = index < STEP.level1;
    level.hidden = !(index >= STEP.level1 && index <= STEP.stop);
    inserted.hidden = !(index === STEP.order || index === STEP.build);
    base.hidden = index !== STEP.base;

    const min = clampInt(params.minCount, 1, BASKETS);
    if (Number(supIn.value) !== min) supIn.value = String(min);
    setText(supOut, minSupportText(min));

    const lv = clampInt(params.level, 1, LEVELS);
    prev.disabled = lv <= 1;
    next.disabled = lv >= LEVELS;
    last.disabled = lv >= LEVELS;
    setText(levelOut, `seviye ${lv} / ${LEVELS}`);

    const ins = clampInt(params.inserted, 0, BASKETS);
    if (Number(insIn.value) !== ins) insIn.value = String(ins);
    setText(insOut, `${ins} / ${BASKETS} fiş`);

    const order = fpFor(min).order;
    for (const [item, b] of chips) {
      b.setAttribute('aria-pressed', String(params.baseItem === item));
      b.disabled = !order.includes(item);
    }
  }
  sync();
  player.subscribe(sync);
}
