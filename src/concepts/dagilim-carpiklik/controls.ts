import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import type { BinCount, Seri } from './data';
import {
  BINS_STEPS, EXTREME_STEPS, LOG_STEPS, SERIES_STEPS,
  type DagilimParams,
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

const SERI_OPTIONS: readonly [Seri, string][] = [
  ['002', '002 · kitap'],
  ['003', '003 · uç değerli'],
  ['simetrik', 'Simetrik'],
  ['sol', 'Sol çarpık'],
];
const BIN_OPTIONS: readonly [BinCount, string][] = [[3, '3'], [5, '5'], [10, '10']];

/**
 * Parameter panel of the `dagilim-carpiklik` page: the series, the bin count,
 * the log transform and the outlier slider, each written as a manual override.
 * Every player notification writes the current params back, only where they
 * differ. A control outside its steps is disabled and marked `data-off`, which
 * Lab hides (Ders keeps it greyed).
 */
export function mountDagilimParams(host: HTMLElement, p: StepPlayer<DagilimParams>): void {
  const id = `dagp${++uid}`;

  const slider = el('input', {
    type: 'range', id: `${id}-extreme`, 'data-param': 'extreme', min: '28', max: '60', step: '1',
    'aria-label': 'uç değer',
  });
  const out = el('output', { class: 'dag-value', for: slider.id });
  const rangeBox = el('div', { class: 'ctl range' }, out, slider);

  const seri = el('select', { id: `${id}-seri`, 'data-param': 'seri' },
    ...SERI_OPTIONS.map(([value, label]) => el('option', { value }, label)));
  const seriBox = el('div', { class: 'ctl select' },
    el('label', { class: 'ctl-label', for: seri.id }, 'seri'), seri);

  const bins = el('select', { id: `${id}-bins`, 'data-param': 'bins' },
    ...BIN_OPTIONS.map(([value, label]) => el('option', { value: String(value) }, label)));
  const binsBox = el('div', { class: 'ctl select' },
    el('label', { class: 'ctl-label', for: bins.id }, 'kova sayısı'), bins);

  const log = el('input', { type: 'checkbox', id: `${id}-log`, 'data-param': 'log' });
  const logBox = el('div', { class: 'ctl check' },
    el('label', { class: 'opt', for: log.id }, log, 'log1p'));

  host.append(el('div', { class: 'knn-params dag-params' }, seriBox, binsBox, logBox, rangeBox));

  slider.addEventListener('input', () => p.setParam('extreme', Number(slider.value)));
  seri.addEventListener('change', () => p.setParam('seri', seri.value as Seri));
  bins.addEventListener('change', () => p.setParam('bins', Number(bins.value) as BinCount));
  log.addEventListener('change', () => p.setParam('log', log.checked));

  const rows: readonly { steps: readonly number[]; box: HTMLElement; controls: readonly (HTMLInputElement | HTMLSelectElement)[] }[] = [
    { steps: SERIES_STEPS, box: seriBox, controls: [seri] },
    { steps: BINS_STEPS, box: binsBox, controls: [bins] },
    { steps: LOG_STEPS, box: logBox, controls: [log] },
    { steps: EXTREME_STEPS, box: rangeBox, controls: [slider] },
  ];

  const sync = (index: number, s: DagilimParams): void => {
    const extreme = String(s.extreme);
    if (slider.value !== extreme) slider.value = extreme;
    const readout = `uç değer: ${formatNumber(s.extreme, 0)}`;
    if (out.textContent !== readout) out.textContent = readout;
    if (seri.value !== s.seri) seri.value = s.seri;
    const binText = String(s.bins);
    if (bins.value !== binText) bins.value = binText;
    if (log.checked !== s.log) log.checked = s.log;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      for (const c of r.controls) {
        if (c.disabled !== off) c.disabled = off;
      }
      r.box.toggleAttribute('data-off', off);
    }
    // a step with no control at all (the rule) hides the whole card in Lab instead of an empty box
    host.toggleAttribute('data-off', rows.every((r) => !r.steps.includes(index)));
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
