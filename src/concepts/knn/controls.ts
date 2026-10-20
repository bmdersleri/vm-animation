import type { StepPlayer } from '../../core/player';
import type { DatasetId } from './data';
import type { Metric, Weighting } from './knn';
import { K_MAX, K_MIN, switchDataset, type KnnParams } from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function select(id: string, param: string, options: [value: string, text: string][]): HTMLSelectElement {
  return el('select', { id, 'data-param': param }, ...options.map(([value, text]) => el('option', { value }, text)));
}

function checkbox(id: string, param: string): HTMLInputElement {
  return el('input', { type: 'checkbox', id, 'data-param': param });
}

/**
 * Parameter panel. Every control writes a manual override; every player
 * notification writes the current params back into the controls, but only
 * values that differ, so focus and a slider mid-drag are left alone.
 */
export function mountKnnParams(host: HTMLElement, p: StepPlayer<KnnParams>): void {
  const id = `knnp${++uid}`;

  const k = el('input', {
    type: 'range', id: `${id}-k`, 'data-param': 'k',
    min: String(K_MIN), max: String(K_MAX), step: '2',
  });
  const kValue = el('output', { class: 'k-value', for: k.id });
  const metric = select(`${id}-metric`, 'metric', [['oklid', 'Öklid'], ['manhattan', 'Manhattan']]);
  const weighting = select(`${id}-weighting`, 'weighting', [['esit', 'Eşit'], ['agirlikli', 'Uzaklığa göre ağırlıklı']]);
  const scaled = checkbox(`${id}-scaled`, 'scaled');
  const dataset = select(`${id}-dataset`, 'dataset', [
    ['aylik', 'Sözleşme × Aylık fatura'], ['toplam', 'Sözleşme × Toplam fatura'],
  ]);
  const datasetNote = el('p', { class: 'note', id: `${id}-dataset-note` }, 'Toplam fatura kısmen süre × aylık faturadan türer.');
  dataset.setAttribute('aria-describedby', datasetNote.id);
  const regions = checkbox(`${id}-regions`, 'regions');
  const instant = checkbox(`${id}-instant`, 'instant');

  const label = (c: HTMLElement, text: string): HTMLLabelElement => el('label', { for: c.id }, text);
  const row = (c: HTMLElement, text: string, ...extra: Node[]): HTMLDivElement =>
    el('div', { class: 'ctl' }, label(c, text), c, ...extra);
  const check = (c: HTMLInputElement, text: string): HTMLDivElement =>
    el('div', { class: 'ctl check' }, c, label(c, text));

  host.append(el(
    'div', { class: 'knn-params' },
    el('div', { class: 'ctl range' }, label(k, 'k (komşu sayısı)'), k, kValue),
    row(metric, 'Uzaklık ölçüsü'),
    row(weighting, 'Oylama'),
    check(scaled, 'Ölçekleme (StandardScaler)'),
    row(dataset, 'Veri seti', datasetNote),
    check(regions, 'Karar bölgeleri'),
    check(instant, 'Anında sonuç'),
  ));

  k.addEventListener('input', () => {
    kValue.textContent = k.value;
    p.setParam('k', Number(k.value));
  });
  metric.addEventListener('change', () => p.setParam('metric', metric.value as Metric));
  weighting.addEventListener('change', () => p.setParam('weighting', weighting.value as Weighting));
  scaled.addEventListener('change', () => p.setParam('scaled', scaled.checked));
  dataset.addEventListener('change', () => switchDataset(p, dataset.value as DatasetId));
  regions.addEventListener('change', () => p.setParam('regions', regions.checked));
  instant.addEventListener('change', () => p.setParam('instant', instant.checked));

  const setValue = (c: HTMLInputElement | HTMLSelectElement, v: string): void => {
    if (c.value !== v) c.value = v;
  };
  const setChecked = (c: HTMLInputElement, v: boolean): void => {
    if (c.checked !== v) c.checked = v;
  };
  const sync = (s: KnnParams): void => {
    setValue(k, String(s.k));
    if (kValue.textContent !== String(s.k)) kValue.textContent = String(s.k);
    setValue(metric, s.metric);
    setValue(weighting, s.weighting);
    setChecked(scaled, s.scaled);
    setValue(dataset, s.dataset);
    setChecked(regions, s.regions);
    setChecked(instant, s.instant);
  };
  sync(p.state.params);
  p.subscribe((s) => sync(s.params));
}
