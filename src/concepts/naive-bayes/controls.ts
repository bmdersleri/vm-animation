import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { spam } from './data';
import type { NbParams } from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

interface PctSlider {
  input: HTMLInputElement;
  out: HTMLOutputElement;
  row: HTMLElement;
}

/** A percent slider (values in percent; the param is a fraction). */
function pctSlider(
  id: string, key: 'prior' | 'sens' | 'fpr', label: string, min: number, max: number, step: number,
): PctSlider {
  const input = el('input', {
    type: 'range', id, 'data-param': key, min: String(min), max: String(max), step: String(step),
  });
  const out = el('output', { class: 'k-value', for: id });
  const row = el('div', { class: 'ctl range' }, el('label', { for: id }, label), input, out);
  return { input, out, row };
}

/** Fraction → slider position in percent (one decimal at most, no float noise). */
const toPercent = (x: number): number => Math.round(x * 1000) / 10;
/** Slider position in percent → fraction. */
const toFraction = (v: number): number => Math.round(v * 10) / 1000;
const percentText = (x: number): string => `%${formatNumber(toPercent(x), 1)}`.replace(/,0$/, '');

/**
 * Parameter panel. Every control writes a manual override; every player
 * notification writes the current params back, but only values that differ,
 * so focus and a slider mid-drag are left alone.
 */
export function mountNbParams(host: HTMLElement, p: StepPlayer<NbParams>): void {
  const id = `nbp${++uid}`;

  const prior = pctSlider(`${id}-prior`, 'prior', 'Öncül', 0.1, 50, 0.1);
  const sens = pctSlider(`${id}-sens`, 'sens', 'Duyarlılık', 50, 99, 1);
  const fpr = pctSlider(`${id}-fpr`, 'fpr', 'Yanlış pozitif oranı', 1, 50, 1);
  const sliders = [['prior', prior], ['sens', sens], ['fpr', fpr]] as const;

  const wordBtns = spam.words.map((x) => el('button', {
    type: 'button', class: 'word-btn', 'data-word': x.w, 'aria-pressed': 'false',
  }, x.w));
  const wordsId = `${id}-words`;
  const words = el('div', { class: 'ctl words', role: 'group', 'aria-labelledby': wordsId },
    el('span', { id: wordsId, class: 'ctl-label' }, 'E-postadaki kelimeler'),
    el('div', { class: 'word-list' }, ...wordBtns));

  const laplace = el('input', { type: 'checkbox', id: `${id}-alpha`, 'data-param': 'alpha' });
  const regions = el('input', { type: 'checkbox', id: `${id}-regions`, 'data-param': 'regions' });

  host.append(el(
    'div', { class: 'knn-params nb-params' },
    prior.row, sens.row, fpr.row, words,
    el('div', { class: 'ctl check' }, laplace, el('label', { for: laplace.id }, 'Laplace düzeltmesi')),
    el('div', { class: 'ctl check' }, regions, el('label', { for: regions.id }, 'Karar bölgeleri')),
  ));

  for (const [key, s] of sliders) {
    s.input.addEventListener('input', () => {
      const x = key === 'prior' ? toFraction(Number(s.input.value)) : Number(s.input.value) / 100;
      s.out.textContent = percentText(x);
      p.setParam(key, x);
    });
  }
  for (const b of wordBtns) {
    b.addEventListener('click', () => {
      const w = b.dataset.word!;
      const cur = p.state.params.words;
      p.setParam('words', cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]);
    });
  }
  laplace.addEventListener('change', () => p.setParam('alpha', laplace.checked ? 1 : 0));
  regions.addEventListener('change', () => p.setParam('regions', regions.checked));

  const sync = (s: NbParams): void => {
    for (const [key, sl] of sliders) {
      const pos = String(toPercent(s[key]));
      if (sl.input.value !== pos) sl.input.value = pos;
      const text = percentText(s[key]);
      if (sl.out.textContent !== text) sl.out.textContent = text;
    }
    for (const b of wordBtns) {
      const on = String(s.words.includes(b.dataset.word!));
      if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    }
    const a = s.alpha === 1;
    if (laplace.checked !== a) laplace.checked = a;
    if (regions.checked !== s.regions) regions.checked = s.regions;
  };
  sync(p.state.params);
  p.subscribe((s) => sync(s.params));
}
