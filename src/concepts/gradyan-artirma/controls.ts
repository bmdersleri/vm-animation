import type { StepPlayer } from '../../core/player';
import {
  DEPTH_STEPS,
  M_STEPS,
  MAX_TREES,
  NU_STEPS,
  NU_VALUES,
  SHOW_VAL_STEPS,
  TREES_STEPS,
  M_MAX,
  nuText,
  type GbParams,
} from './scenario';

let uid = 0;

/** Range of the depth slider. */
const DEPTH: readonly [number, number] = [1, 3];

type SliderKey = 'nu' | 'depth' | 'm' | 'trees';

/**
 * Mounts the Lab controls of the gradient boosting page: the validation-points switch (steps 1-3),
 * depth (4, 7-9), ν over the list of learning rates and m (5-6), ν / depth / M (7-9). Only the
 * current step's controls are shown; every input writes through `player.setParam`. Key presses on a
 * control do not reach the step shortcuts (the shell ignores them on form controls).
 */
export function mountGbParams(host: HTMLElement, player: StepPlayer<GbParams>): void {
  const doc = host.ownerDocument;
  const prefix = `gb-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'knn-params gb-params';
  const rows: { steps: readonly number[]; box: HTMLElement; input: HTMLInputElement }[] = [];
  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();

  const field = (key: string, label: string, steps: readonly number[], type: 'range' | 'checkbox') => {
    const box = doc.createElement('div');
    box.className = type === 'range' ? 'ctl range' : 'ctl toggle';
    const input = doc.createElement('input');
    input.type = type;
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    const title = doc.createElement('label');
    title.className = 'ctl-label';
    title.htmlFor = input.id;
    title.textContent = label;
    rows.push({ steps, box, input });
    return { box, input, title };
  };

  const addSlider = (key: SliderKey, label: string, steps: readonly number[]) => {
    const { box, input, title } = field(key, label, steps, 'range');
    const output = doc.createElement('output');
    output.htmlFor = input.id;
    output.className = 'gb-value';
    box.append(title, output, input);
    wrap.append(box);
    sliders.set(key, { input, output });
    input.addEventListener('input', () => {
      const x = Number(input.value);
      player.setParam(key, key === 'nu' ? NU_VALUES[x] : x);
    });
  };

  const toggle = field('showVal', 'Doğrulama noktalarını göster', SHOW_VAL_STEPS, 'checkbox');
  toggle.box.append(toggle.input, toggle.title);
  wrap.append(toggle.box);
  toggle.input.addEventListener('change', () => player.setParam('showVal', toggle.input.checked));

  addSlider('depth', 'Ağaç derinliği', DEPTH_STEPS);
  addSlider('nu', 'Öğrenme oranı ν', NU_STEPS);
  addSlider('m', 'Adım sayısı m', M_STEPS);
  addSlider('trees', 'Ağaç sayısı M', TREES_STEPS);
  host.append(wrap);

  const range = (key: SliderKey): [number, number] => {
    switch (key) {
      case 'nu':
        return [0, NU_VALUES.length - 1];
      case 'depth':
        return DEPTH.slice() as [number, number];
      case 'm':
        return [1, M_MAX];
      case 'trees':
        return [1, MAX_TREES];
    }
  };

  const sync = (): void => {
    const { index, params: p } = player.state;
    for (const [key, { input, output }] of sliders) {
      const [min, max] = range(key);
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      const value = key === 'nu' ? Math.max(0, (NU_VALUES as readonly number[]).indexOf(p.nu)) : Math.max(min, Math.min(max, Math.round(p[key])));
      input.value = String(value);
      output.textContent = key === 'nu' ? nuText(NU_VALUES[value]) : String(value);
    }
    toggle.input.checked = p.showVal;
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
