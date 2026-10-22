import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import {
  CHURN_STEPS, LEVERAGE_STEPS, SET_STEPS,
  type KorelParams,
} from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

/** The panels' names: the Anscombe numerals, so the select matches the scene's `data-set`. */
const SET_OPTIONS: readonly [KorelParams['set'], string][] = [
  [1, 'I'],
  [2, 'II'],
  [3, 'III'],
  [4, 'IV'],
];

/**
 * Parameter panel of the `korelasyon-isi-haritasi` page: the panel set, set
 * IV's leverage point y and the numeric-coded `churn` column. Every player
 * notification writes the current params back, only where they differ, so a
 * scene drag moves the range and its Turkish readout. A control outside its
 * steps is disabled and marked `data-off`, which Lab hides (Ders keeps it
 * greyed), so the Lab card never shows a dead group.
 */
export function mountKorelasyonParams(host: HTMLElement, p: StepPlayer<KorelParams>): void {
  const id = `korp${++uid}`;

  const setSelect = el('select', { 'data-param': 'set', id: `${id}-set` },
    ...SET_OPTIONS.map(([value, text]) => el('option', { value: String(value) }, text)));
  const setBox = el('div', { class: 'ctl select' },
    el('label', { class: 'ctl-label', for: setSelect.id }, 'Set'), setSelect);

  const rangeInput = el('input', {
    type: 'range', 'data-param': 'noktaY', id: `${id}-y`,
    min: '6', max: '20', step: '0.5', value: '12.5',
  });
  const readout = el('output', { class: 'ctl-value', for: rangeInput.id });
  const rangeBox = el('div', { class: 'ctl range' },
    el('label', { class: 'ctl-label', for: rangeInput.id }, 'Kaldıraç noktası y'),
    rangeInput, readout);

  const box = el('input', { type: 'checkbox', 'data-param': 'churn', id: `${id}-churn` });
  const churnBox = el('div', { class: 'ctl check' },
    el('label', { class: 'opt', for: box.id }, box, 'churn sütunu (0/1)'));

  host.append(el('div', { class: 'knn-params kor-params' }, setBox, rangeBox, churnBox));

  setSelect.addEventListener('change', () => {
    p.setParam('set', Number(setSelect.value) as KorelParams['set']);
  });
  rangeInput.addEventListener('input', () => p.setParam('noktaY', Number(rangeInput.value)));
  box.addEventListener('change', () => p.setParam('churn', box.checked));

  const rows: readonly {
    steps: readonly number[];
    box: HTMLElement;
    controls: readonly (HTMLSelectElement | HTMLInputElement)[];
  }[] = [
    { steps: SET_STEPS, box: setBox, controls: [setSelect] },
    { steps: LEVERAGE_STEPS, box: rangeBox, controls: [rangeInput] },
    { steps: CHURN_STEPS, box: churnBox, controls: [box] },
  ];

  const sync = (index: number, s: KorelParams): void => {
    const setValue = String(s.set);
    if (setSelect.value !== setValue) setSelect.value = setValue;
    const rangeValue = String(s.noktaY);
    if (rangeInput.value !== rangeValue) rangeInput.value = rangeValue;
    const label = `y = ${formatNumber(s.noktaY, 1)}`;
    if (readout.textContent !== label) readout.textContent = label;
    if (box.checked !== s.churn) box.checked = s.churn;
    for (const r of rows) {
      // set IV is the only set with a leverage point, so the y slider idles on I–III
      const off = !r.steps.includes(index) || (r.steps === LEVERAGE_STEPS && s.set !== 4);
      for (const c of r.controls) {
        if (c.disabled !== off) c.disabled = off;
      }
      r.box.toggleAttribute('data-off', off);
    }
    // a step with no control at all hides the whole card in Lab
    host.toggleAttribute('data-off', rows.every((r) => !r.steps.includes(index)));
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
