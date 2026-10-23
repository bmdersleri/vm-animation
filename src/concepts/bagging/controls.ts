import type { StepPlayer } from '../../core/player';
import { formatNumber, formatPercent } from '../../core/plot/format';
import { labBootstrap, oobChance } from '../topluluk/math';
import {
  DRAW_STEPS,
  N_STEPS,
  PM_STEPS,
  SAMPLE_STEPS,
  TREES_STEPS,
  TREE_STEPS,
  type BaggingParams,
} from './scenario';
import { deriveBaggingView } from './view';

let uid = 0;

/** Draws averaged by the "100 kez çek" button. */
const RUNS = 100;
/** Lab draw seeds of that run start here, away from the "Yeni çekiliş" seeds (1, 2, 3, ...). */
const RUN_SEED = 10_000;

/** Range of the card steps' n slider (the card row stays legible up to this). */
const CARD_N: readonly [number, number] = [5, 20];
/** Range of the n slider on the (1 − 1/n)ⁿ curve. */
const CURVE_N: readonly [number, number] = [1, 100];

/** Mean OOB share (never-drawn cards / n) over `RUNS` seeded Lab draws of n cards. */
export function meanOobShare(n: number): number {
  let sum = 0;
  for (let k = 0; k < RUNS; k++) {
    const seen = new Set(labBootstrap(n, RUN_SEED + k));
    sum += (n - seen.size) / n;
  }
  return sum / RUNS;
}

type SliderKey = 'n' | 'tree' | 'trees' | 'p' | 'm';

/**
 * Mounts the Lab controls of the bootstrap and bagging page: draw buttons and the n slider (steps 1-4),
 * the "100 kez çek" button (step 4), the tree number (step 6), the tree count (step 7) and p / M (step 8).
 * Only the current step's controls are shown; every input writes through `player.setParam(s)`.
 */
export function mountBaggingParams(host: HTMLElement, player: StepPlayer<BaggingParams>): void {
  const doc = host.ownerDocument;
  const prefix = `bagging-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'knn-params bagging-params';
  const rows: { steps: readonly number[]; box: HTMLElement; inputs: (HTMLInputElement | HTMLButtonElement)[] }[] = [];
  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();

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
    output.className = 'bagging-value';
    box.append(title, output, input);
    wrap.append(box);
    rows.push({ steps, box, inputs: [input] });
    sliders.set(key, { input, output });
    input.addEventListener('input', () => {
      const x = Number(input.value);
      // a new n invalidates the "100 kez çek" average
      if (key === 'n') player.setParams({ n: x, avg: null });
      else if (key === 'p') player.setParam('p', Math.round(x * 100) / 100);
      else player.setParam(key, x);
    });
  };

  const addButtons = (steps: readonly number[], buttons: [action: string, label: string, run: () => void][]) => {
    const box = doc.createElement('div');
    box.className = 'ctl buttons';
    const made = buttons.map(([action, label, run]) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.dataset.action = action;
      b.textContent = label;
      b.addEventListener('click', run);
      box.append(b);
      return b;
    });
    wrap.append(box);
    rows.push({ steps, box, inputs: made });
  };

  const fmt = {
    n: (x: number) => String(x),
    tree: (x: number) => String(x),
    trees: (x: number) => String(x),
    p: (x: number) => formatNumber(x, 2),
    m: (x: number) => String(x),
  };
  addSlider('n', 'Müşteri sayısı n', N_STEPS);
  addButtons(DRAW_STEPS, [
    ['new-draw', 'Yeni çekiliş', () => player.setParam('draw', player.state.params.draw + 1)],
    ['book', 'Kitabın örneği', () => player.setParams({ draw: 0, n: 10, avg: null })],
  ]);
  addButtons(SAMPLE_STEPS, [
    ['sample100', `${RUNS} kez çek`, () => player.setParam('avg', meanOobShare(player.state.params.n))],
  ]);
  addSlider('tree', 'Ağaç no', TREE_STEPS);
  addSlider('trees', 'Ağaç sayısı M', TREES_STEPS);
  addSlider('p', 'Model doğruluğu p', PM_STEPS);
  addSlider('m', 'Model sayısı M', PM_STEPS);

  const readout = doc.createElement('p');
  readout.className = 'bagging-readout';
  readout.setAttribute('aria-live', 'polite');
  wrap.append(readout);
  host.append(wrap);

  const range = (key: SliderKey, index: number): [number, number, number] => {
    switch (key) {
      case 'n': {
        const [lo, hi] = DRAW_STEPS.includes(index) ? CARD_N : CURVE_N;
        return [lo, hi, 1];
      }
      case 'tree':
        return [1, 50, 1];
      case 'trees':
        return [1, 50, 1];
      case 'p':
        return [0.5, 0.95, 0.05];
      case 'm':
        return [1, 51, 2];
    }
  };

  /** Live line under the controls: the OOB set of the draw (step 3) or the average of the run (step 4). */
  const readoutText = (index: number, p: BaggingParams): string => {
    if (index === DRAW_STEPS[2]) {
      const bag = deriveBaggingView(index, p).bag;
      if (!bag) return '';
      if (bag.oob.length === 0) return 'Bu çekilişte OOB müşteri yok: her kart en az bir kez çekildi.';
      return `OOB: ${bag.oob.join(', ')} → ${bag.oob.length} / ${bag.n} = ${formatPercent(bag.oob.length / bag.n)}`;
    }
    if (SAMPLE_STEPS.includes(index) && p.avg !== null) {
      return `${RUNS} çekilişin ortalama OOB oranı ${formatPercent(p.avg)}; kuram (1 − 1/${p.n})ⁿ = ${formatNumber(oobChance(p.n), 3)}.`;
    }
    return '';
  };

  const sync = (): void => {
    const { index, params: p } = player.state;
    // the card steps cap n lower than the curve step does; coming back from the curve pulls it into range
    const [nLo, nHi] = range('n', index);
    if (N_STEPS.includes(index) && (p.n < nLo || p.n > nHi)) {
      player.setParams({ n: Math.max(nLo, Math.min(nHi, p.n)), avg: null });
      return;
    }
    for (const [key, { input, output }] of sliders) {
      const [min, max, step] = range(key, index);
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      const value = key === 'n' ? p.n : p[key];
      input.value = String(value);
      output.textContent = fmt[key](value);
    }
    for (const r of rows) {
      const off = !r.steps.includes(index);
      for (const input of r.inputs) input.disabled = off;
      r.box.toggleAttribute('data-off', off);
    }
    const text = readoutText(index, p);
    readout.textContent = text;
    readout.hidden = text === '';
    wrap.toggleAttribute(
      'data-off',
      rows.every((r) => !r.steps.includes(index)),
    );
  };
  sync();
  player.subscribe(sync);
}
