import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { BOOTS } from '../topluluk/data';
import { ID_STEPS, METHOD_STEPS, MF_STEPS, NEST_STEPS, RHO_M_STEPS, TREES_STEPS, type RfParams } from './scenario';

let uid = 0;

type SliderKey = 'maxFeatures' | 'rho' | 'trees' | 'nEstimators';

/** Largest M of the variance curves (step 3); the OOB steps have the bootstrap trees only. */
const M_MAX = 250;

/**
 * Mounts the Lab controls of the Random Forest page: the max_features slider (steps 2 and 4), rho and M (step 3),
 * the tree count M (steps 5-6), the OOB tree count n_estimators (step 8), the "musteriNo ekle" toggle (step 9)
 * and the "MDI / permütasyon" selector (step 10). Only the current step's controls are shown; every input writes
 * through `player.setParam(s)`.
 */
export function mountRfParams(host: HTMLElement, player: StepPlayer<RfParams>): void {
  const doc = host.ownerDocument;
  const prefix = `rf-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'knn-params rf-params';
  const rows: { steps: readonly number[]; box: HTMLElement; inputs: (HTMLInputElement | HTMLSelectElement)[] }[] = [];
  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();

  const fmt: Record<SliderKey, (x: number) => string> = {
    maxFeatures: (x) => String(x),
    rho: (x) => formatNumber(x, 2),
    trees: (x) => String(x),
    nEstimators: (x) => String(x),
  };

  const addSlider = (key: SliderKey, label: string, steps: readonly number[]) => {
    const box = doc.createElement('div');
    box.className = 'ctl range';
    const input = doc.createElement('input');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    const title = doc.createElement('label');
    title.className = 'ctl-label';
    title.htmlFor = input.id;
    title.textContent = label;
    const output = doc.createElement('output');
    output.htmlFor = input.id;
    output.className = 'rf-value';
    box.append(title, output, input);
    wrap.append(box);
    rows.push({ steps, box, inputs: [input] });
    sliders.set(key, { input, output });
    input.addEventListener('input', () => {
      const x = Number(input.value);
      player.setParam(key, key === 'rho' ? Math.round(x * 100) / 100 : x);
    });
  };

  addSlider('maxFeatures', 'max_features', MF_STEPS);
  addSlider('rho', 'Ağaçlar arası korelasyon ρ', RHO_M_STEPS);
  addSlider('trees', 'Ağaç sayısı M', [...RHO_M_STEPS, ...TREES_STEPS]);
  addSlider('nEstimators', 'Ağaç sayısı (n_estimators)', NEST_STEPS);

  // step 9: the id column joins the model
  const idBox = doc.createElement('div');
  idBox.className = 'ctl check';
  const idInput = doc.createElement('input');
  idInput.type = 'checkbox';
  idInput.id = `${prefix}-withId`;
  idInput.dataset.param = 'withId';
  const idLabel = doc.createElement('label');
  idLabel.htmlFor = idInput.id;
  idLabel.textContent = 'musteriNo ekle';
  idBox.append(idInput, idLabel);
  wrap.append(idBox);
  rows.push({ steps: ID_STEPS, box: idBox, inputs: [idInput] });
  idInput.addEventListener('change', () => player.setParam('withId', idInput.checked));

  // step 10: which importance method is highlighted
  const methodBox = doc.createElement('div');
  methodBox.className = 'ctl pick';
  const methodSel = doc.createElement('select');
  methodSel.id = `${prefix}-method`;
  methodSel.dataset.param = 'method';
  for (const [value, text] of [
    ['mdi', 'MDI'],
    ['perm', 'permütasyon'],
  ]) {
    const o = doc.createElement('option');
    o.value = value;
    o.textContent = text;
    methodSel.append(o);
  }
  const methodLabel = doc.createElement('label');
  methodLabel.className = 'ctl-label';
  methodLabel.htmlFor = methodSel.id;
  methodLabel.textContent = 'Öne çıkan yöntem';
  methodBox.append(methodLabel, methodSel);
  wrap.append(methodBox);
  rows.push({ steps: METHOD_STEPS, box: methodBox, inputs: [methodSel] });
  methodSel.addEventListener('change', () => player.setParam('method', methodSel.value === 'perm' ? 'perm' : 'mdi'));

  host.append(wrap);

  const range = (key: SliderKey, index: number): [number, number, number] => {
    switch (key) {
      case 'maxFeatures':
        return [1, 8, 1];
      case 'rho':
        return [0, 1, 0.01];
      case 'trees':
        return RHO_M_STEPS.includes(index) ? [1, M_MAX, 1] : [1, BOOTS.length, 1];
      case 'nEstimators':
        return [10, 500, 10];
    }
  };

  const sync = (): void => {
    const { index, params: p } = player.state;
    // the OOB steps have only the bootstrap trees; coming back from the variance curve pulls M into range
    const [, tMax] = range('trees', index);
    if (TREES_STEPS.includes(index) && p.trees > tMax) {
      player.setParam('trees', tMax);
      return;
    }
    for (const [key, { input, output }] of sliders) {
      const [min, max, step] = range(key, index);
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(p[key]);
      output.textContent = fmt[key](p[key]);
    }
    idInput.checked = p.withId;
    methodSel.value = p.method;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      for (const input of r.inputs) input.disabled = off;
      r.box.toggleAttribute('data-off', off);
    }
    wrap.toggleAttribute(
      'data-off',
      rows.every((r) => !r.steps.includes(index)),
    );
  };
  sync();
  player.subscribe(sync);
}
