import type { StepPlayer } from '../../core/player';
import { CURVES } from '../boosting/data';
import { MAX_TREES, lrText, boostingAyarlariScenario, type TuneParams } from './scenario';

let uid = 0;

type SliderKey = 'lr' | 'trees' | 'patience' | 'depth' | 'leaves' | 'budget';

/** Slider ranges; `lr` runs over the indices of the six rates of the data (all of them on every step that has the slider). */
const RANGE: Record<SliderKey, readonly [number, number]> = {
  lr: [0, CURVES.lrs.length - 1],
  trees: [1, MAX_TREES],
  patience: [10, 100],
  depth: [1, 3],
  leaves: [2, 64],
  budget: [4, 16],
};

const stepsOf = (...ids: string[]): number[] => ids.map((id) => boostingAyarlariScenario.steps.findIndex((s) => s.id === id));

/** Controls per step (indices resolved from the step ids). */
const LR_STEPS = stepsOf('lr-deney', 'egriler', 'agac-ekle', 'ezber', 'erken-durdurma');
const TREES_STEPS = stepsOf('lr-deney', 'egriler', 'agac-ekle');
const PATIENCE_STEPS = stepsOf('erken-durdurma');
const DEPTH_STEPS = stepsOf('seviye', 'yaprak');
const LEAVES_STEPS = stepsOf('yaprak-siniri');
const BUDGET_STEPS = stepsOf('izgara', 'sirali-arama');
const SURFACE_STEPS = BUDGET_STEPS;
const RESTART_STEPS = stepsOf('sirali-arama');

const lrIndex = (lr: number): number => Math.max(0, CURVES.lrs.findIndex((x) => Math.abs(x - lr) < 1e-9));

/**
 * Mounts the Lab controls of the boosting settings page: learning rate ν over the six rates of the
 * data (steps 1-5), tree count (1-3), patience (5), depth (6-7), leaf count (8), search budget, the
 * "Yeni başlangıç" button (10) and the "Bütün yüzeyi göster" switch (9-10). Only the current step's
 * controls are shown; every input writes through `player.setParam`. Key presses on a control do not
 * reach the step shortcuts (the shell ignores them on form controls).
 */
export function mountTuneParams(host: HTMLElement, player: StepPlayer<TuneParams>): void {
  const doc = host.ownerDocument;
  const prefix = `tune-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'knn-params tune-params';
  const rows: { steps: readonly number[]; box: HTMLElement; input: HTMLInputElement | HTMLButtonElement }[] = [];
  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();

  const box = (type: 'range' | 'toggle' | 'action'): HTMLElement => {
    const el = doc.createElement('div');
    el.className = `ctl ${type}`;
    return el;
  };

  const addSlider = (key: SliderKey, label: string, steps: readonly number[]) => {
    const el = box('range');
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
    output.className = 'tune-value';
    el.append(title, output, input);
    wrap.append(el);
    rows.push({ steps, box: el, input });
    sliders.set(key, { input, output });
    input.addEventListener('input', () => {
      const x = Number(input.value);
      player.setParam(key, key === 'lr' ? CURVES.lrs[x] : x);
    });
  };

  addSlider('lr', 'Öğrenme oranı ν', LR_STEPS);
  addSlider('trees', 'Ağaç sayısı', TREES_STEPS);
  addSlider('patience', 'Sabır', PATIENCE_STEPS);
  addSlider('depth', 'Ağaç derinliği', DEPTH_STEPS);
  addSlider('leaves', 'Yaprak sayısı', LEAVES_STEPS);
  addSlider('budget', 'Deneme bütçesi', BUDGET_STEPS);

  const surfaceBox = box('toggle');
  const surface = doc.createElement('input');
  surface.type = 'checkbox';
  surface.id = `${prefix}-showSurface`;
  surface.dataset.param = 'showSurface';
  const surfaceLabel = doc.createElement('label');
  surfaceLabel.className = 'ctl-label';
  surfaceLabel.htmlFor = surface.id;
  surfaceLabel.textContent = 'Bütün yüzeyi göster';
  surfaceBox.append(surface, surfaceLabel);
  wrap.append(surfaceBox);
  rows.push({ steps: SURFACE_STEPS, box: surfaceBox, input: surface });
  surface.addEventListener('change', () => player.setParam('showSurface', surface.checked));

  const restartBox = box('action');
  const restart = doc.createElement('button');
  restart.type = 'button';
  restart.dataset.param = 'seed';
  restart.className = 'btn';
  restart.textContent = 'Yeni başlangıç';
  restartBox.append(restart);
  wrap.append(restartBox);
  rows.push({ steps: RESTART_STEPS, box: restartBox, input: restart });
  restart.addEventListener('click', () => player.setParam('seed', player.state.params.seed + 1));

  host.append(wrap);

  const sync = (): void => {
    const { index, params: p } = player.state;
    for (const [key, { input, output }] of sliders) {
      const [min, max] = RANGE[key];
      input.min = String(min);
      input.max = String(max);
      input.step = '1';
      const value = key === 'lr' ? lrIndex(p.lr) : Math.max(min, Math.min(max, Math.round(p[key])));
      input.value = String(value);
      output.textContent = key === 'lr' ? lrText(CURVES.lrs[value]) : String(value);
    }
    surface.checked = p.showSurface;
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
