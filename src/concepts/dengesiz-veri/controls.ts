import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { METHODS } from './boundary';
import { dengesizVeriScenario as scenario, SHOW_TEST_STEPS, type ImbParams } from './scenario';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. */
export const K_STEPS = indices('sentetik', 'smote-doldur', 'kopyalama', 'sinir', 'karsilastirma');
export const POINT_STEPS = indices('sentetik');
export const SEED_STEPS = indices('smote-doldur', 'kopyalama');
export const RATIO_STEPS = indices('smote-doldur', 'kopyalama', 'sinir', 'karsilastirma');
export const WEIGHT_STEPS_LAB = indices('agirlik', 'sinir', 'karsilastirma');
export const METHOD_STEPS = indices('sinir', 'karsilastirma');

/** Ranges of the sliders: k, target ratio, manual churner weight, threshold. */
export const K_RANGE: readonly [number, number] = [1, 10];
export const RATIO_RANGE: readonly [number, number, number] = [0.1, 1, 0.05];
export const WEIGHT_RANGE: readonly [number, number] = [1, 30];
export const THRESHOLD_RANGE: readonly [number, number, number] = [0.05, 0.95, 0.01];

type SliderKey = 'k' | 'ratio' | 'manualWeight' | 'threshold';
type SelectKey = 'weight' | 'method';

/**
 * Mounts the Lab controls of the imbalanced-data page. Only the current step's controls are shown:
 * the test-points switch (steps 1-4), k with the "another point" button (5), k / target ratio / seed
 * (6-7), the weight choice and manual weight (8), and method, k, ratio, weight, manual weight and
 * threshold (9-10). Every input writes through `player.setParam`; key presses on the controls do not
 * reach the step shortcuts.
 */
export function mountImbParams(host: HTMLElement, player: StepPlayer<ImbParams>): void {
  const doc = host.ownerDocument;
  const prefix = `imb-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'imb-params';
  const rows: { steps: readonly number[]; box: HTMLElement; input: HTMLInputElement | HTMLSelectElement | HTMLButtonElement }[] = [];
  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();
  const selects = new Map<SelectKey, HTMLSelectElement>();

  const box = (cls: string): HTMLElement => {
    const b = doc.createElement('div');
    b.className = `ctl ${cls}`;
    return b;
  };

  const label = (text: string, input: HTMLElement): HTMLLabelElement => {
    const l = doc.createElement('label');
    l.className = 'ctl-label';
    l.htmlFor = input.id;
    l.textContent = text;
    return l;
  };

  const addSlider = (
    key: SliderKey,
    text: string,
    steps: readonly number[],
    range: readonly [number, number] | readonly [number, number, number],
    set: (value: number) => void,
  ): void => {
    const b = box('range');
    const input = doc.createElement('input');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    input.min = String(range[0]);
    input.max = String(range[1]);
    input.step = String(range[2] ?? 1);
    const output = doc.createElement('output');
    output.htmlFor = input.id;
    output.className = 'imb-value';
    b.append(label(text, input), output, input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    sliders.set(key, { input, output });
    input.addEventListener('input', () => set(Number(input.value)));
  };

  const addSelect = (key: SelectKey, text: string, steps: readonly number[], options: readonly { value: string; text: string }[]): void => {
    const b = box('select');
    const input = doc.createElement('select');
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    for (const o of options) {
      const opt = doc.createElement('option');
      opt.value = o.value;
      opt.textContent = o.text;
      input.append(opt);
    }
    b.append(label(text, input), input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    selects.set(key, input);
    input.addEventListener('change', () => player.setParam(key, input.value as never));
  };

  const addButton = (action: string, text: string, steps: readonly number[]): void => {
    const b = box('action');
    const input = doc.createElement('button');
    input.type = 'button';
    input.id = `${prefix}-${action}`;
    input.dataset.action = action;
    input.textContent = text;
    b.append(input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('click', () => player.setParam('seed', player.state.params.seed + 1));
  };

  // test-points switch (steps 1-4)
  const toggleBox = box('toggle');
  const toggle = doc.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = `${prefix}-showTest`;
  toggle.dataset.param = 'showTest';
  toggleBox.append(toggle, label('Test noktalarını göster', toggle));
  wrap.append(toggleBox);
  rows.push({ steps: SHOW_TEST_STEPS, box: toggleBox, input: toggle });
  toggle.addEventListener('change', () => player.setParam('showTest', toggle.checked));

  addSelect(
    'method',
    'Yöntem',
    METHOD_STEPS,
    METHODS.map((m) => ({ value: m.id, text: m.label })),
  );
  addSlider('k', 'Komşu sayısı k', K_STEPS, K_RANGE, (v) => player.setParam('k', v));
  addSlider('ratio', 'Hedef oran (ayrılan / kalan)', RATIO_STEPS, RATIO_RANGE, (v) => player.setParam('ratio', v));
  addButton('seed-point', 'Başka nokta', POINT_STEPS);
  addButton('seed', 'Başka tohum', SEED_STEPS);
  addSelect('weight', 'Sınıf ağırlığı', WEIGHT_STEPS_LAB, [
    { value: 'yok', text: 'yok' },
    { value: 'dengeli', text: 'dengeli' },
    { value: 'elle', text: 'elle' },
  ]);
  addSlider('manualWeight', 'Ayrılanın ağırlığı (elle)', WEIGHT_STEPS_LAB, WEIGHT_RANGE, (v) =>
    player.setParams({ manualWeight: v, weight: 'elle' }),
  );
  addSlider('threshold', 'Karar eşiği', METHOD_STEPS, THRESHOLD_RANGE, (v) => player.setParam('threshold', v));
  host.append(wrap);

  // arrow keys, space and letters on a control belong to the control, not to the step shortcuts
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
  });

  const text = (key: SliderKey, value: number): string => {
    switch (key) {
      case 'k':
      case 'manualWeight':
        return String(value);
      case 'ratio':
      case 'threshold':
        return f(value, 2);
    }
  };

  const sync = (): void => {
    const { index, params: p } = player.state;
    for (const [key, { input, output }] of sliders) {
      const lo = Number(input.min);
      const hi = Number(input.max);
      const value = Math.max(lo, Math.min(hi, p[key]));
      input.value = String(value);
      output.textContent = text(key, value);
    }
    for (const [key, select] of selects) {
      select.value = p[key];
    }
    toggle.checked = p.showTest;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      r.input.disabled = off;
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
