import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { LEAK } from '../dengesiz/data';
import { smoteSizintiScenario as scenario, type LeakParams } from './scenario';
import { MODEL_NAMES } from './view';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. */
export const ORDER_STEPS = indices('iki-sira', 'once-smote', 'testte-ne-var', 'pr-taban', 'iki-skor');
export const FOLD_STEPS = indices('pipeline');
export const SHOW_STEPS = indices('smote-agirlik');
export const MODEL_STEPS = indices('esik');
export const FIXED_STEPS = indices('hata-ayiklama');

/** Range of the threshold slider (the lowest and highest threshold of the page). */
export const THRESHOLD_RANGE: readonly [number, number, number] = [0.01, 0.99, 0.01];

/** The seeds of the leakage runs, the page's default first. */
export const SEED_CHOICES: readonly number[] = [42, ...LEAK.seeds.filter((s) => s !== 42)];

type SwitchKey = 'base' | 'smote' | 'weighted';

const SWITCHES: readonly { key: SwitchKey; text: string }[] = [
  { key: 'base', text: 'Ağırlıksız eğri' },
  { key: 'smote', text: 'SMOTE eğrisi' },
  { key: 'weighted', text: 'Ağırlıklı eğri' },
];

/**
 * Mounts the Lab controls of the SMOTE-leakage page. Only the current step's controls are shown: the order and
 * seed choices (steps 1-5), the fold choice (6), the three curve switches (7), the model choice with the
 * threshold slider (8) and the corrected-code switch (9); step 10 has none. Every input writes through
 * `player.setParam(s)`; key presses on the controls do not reach the step shortcuts.
 */
export function mountLeakParams(host: HTMLElement, player: StepPlayer<LeakParams>): void {
  const doc = host.ownerDocument;
  const prefix = `leak-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'leak-params';
  const rows: { steps: readonly number[]; box: HTMLElement; input: HTMLInputElement | HTMLSelectElement }[] = [];

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

  const addSelect = (
    key: string,
    text: string,
    steps: readonly number[],
    options: readonly { value: string; text: string }[],
    set: (value: string) => void,
  ): HTMLSelectElement => {
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
    input.addEventListener('change', () => set(input.value));
    return input;
  };

  const addToggle = (key: string, text: string, steps: readonly number[], set: (on: boolean) => void): HTMLInputElement => {
    const b = box('toggle');
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    b.append(input, label(text, input));
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => set(input.checked));
    return input;
  };

  const order = addSelect(
    'order',
    'İşlem sırası',
    ORDER_STEPS,
    [
      { value: 'yanlis', text: 'yanlış: önce SMOTE, sonra böl' },
      { value: 'dogru', text: 'doğru: önce böl, sonra SMOTE' },
    ],
    (v) => player.setParam('order', v as LeakParams['order']),
  );
  const seed = addSelect(
    'seed',
    'SMOTE tohumu',
    ORDER_STEPS,
    SEED_CHOICES.map((s) => ({ value: String(s), text: String(s) })),
    (v) => player.setParam('seed', Number(v)),
  );
  const fold = addSelect(
    'fold',
    'Katı göster',
    FOLD_STEPS,
    [{ value: '0', text: 'seçim yok' }, ...[1, 2, 3, 4, 5].map((k) => ({ value: String(k), text: `kat ${k}` }))],
    (v) => player.setParam('fold', Number(v)),
  );
  const switches = SWITCHES.map((sw) => ({
    key: sw.key,
    input: addToggle(`show-${sw.key}`, sw.text, SHOW_STEPS, (on) =>
      player.setParam('show', { ...player.state.params.show, [sw.key]: on }),
    ),
  }));
  const model = addSelect(
    'model',
    'Model',
    MODEL_STEPS,
    (['base', 'smote', 'weighted'] as const).map((m) => ({ value: m, text: MODEL_NAMES[m] })),
    (v) => player.setParam('model', v as LeakParams['model']),
  );

  // threshold slider
  const sliderBox = box('range');
  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.id = `${prefix}-threshold`;
  slider.dataset.param = 'threshold';
  slider.min = String(THRESHOLD_RANGE[0]);
  slider.max = String(THRESHOLD_RANGE[1]);
  slider.step = String(THRESHOLD_RANGE[2]);
  const output = doc.createElement('output');
  output.htmlFor = slider.id;
  output.className = 'leak-value';
  sliderBox.append(label('Karar eşiği', slider), output, slider);
  wrap.append(sliderBox);
  rows.push({ steps: MODEL_STEPS, box: sliderBox, input: slider });
  slider.addEventListener('input', () => player.setParam('threshold', Number(slider.value)));

  // the sweep's last value (6) already shows the corrected code, so switching off also steps back to five marked bugs
  const fixed = addToggle('fixed', 'Düzeltilmiş kodu göster', FIXED_STEPS, (on) =>
    player.setParams(on ? { fixed: true } : { fixed: false, bug: 5 }),
  );
  host.append(wrap);

  // arrow keys, space and letters on a control belong to the control, not to the step shortcuts
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
  });

  const sync = (): void => {
    const { index, params: p } = player.state;
    order.value = p.order;
    seed.value = String(p.seed);
    fold.value = String(p.fold);
    for (const sw of switches) sw.input.checked = p.show[sw.key];
    model.value = p.model;
    const t = Math.max(THRESHOLD_RANGE[0], Math.min(THRESHOLD_RANGE[1], p.threshold));
    slider.value = String(t);
    output.textContent = f(t, 2);
    fixed.checked = p.fixed || p.bug >= 6;
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
