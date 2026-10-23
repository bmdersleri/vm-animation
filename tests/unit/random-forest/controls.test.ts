// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  ID_STEPS,
  METHOD_STEPS,
  MF_STEPS,
  NEST_STEPS,
  randomForestScenario,
  RHO_M_STEPS,
  TREES_STEPS,
} from '../../../src/concepts/random-forest/scenario';
import { mountRfParams } from '../../../src/concepts/random-forest/controls';
import { mountRfExtra } from '../../../src/concepts/random-forest/extra';
import { mountRfScene } from '../../../src/concepts/random-forest/scene';
import { deriveRfView } from '../../../src/concepts/random-forest/view';
import { OOB_CURVE, RF } from '../../../src/concepts/topluluk/data';
import { ensembleVariance } from '../../../src/concepts/topluluk/math';
import { labTextTests } from '../lab-text';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(host, el);
  const player = new StepPlayer(randomForestScenario);
  mountRfParams(host, player);
  const scene = mountRfScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => randomForestScenario.steps.findIndex((s) => s.id === id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`[data-param=${key}]`)!;
function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function toggle(input: HTMLInputElement, on: boolean): void {
  input.checked = on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function choose(select: HTMLElement, value: string): void {
  const s = select as unknown as HTMLSelectElement;
  s.value = value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}
const fmt = (x: number, d = 3) => x.toFixed(d).replace('.', ',');

it('max_features slider redraws roots and rho', () => {
  const { host, el, player } = setup();
  player.goto(step('alt-kume'));
  expect([ctl(host, 'maxFeatures').min, ctl(host, 'maxFeatures').max]).toEqual(['1', '8']);
  for (const mf of [1, 5, 8]) {
    slide(ctl(host, 'maxFeatures'), mf);
    expect(player.state.params.maxFeatures).toBe(mf);
    const counts = [...el.querySelectorAll('.rf-roots-host g.root-bar.forest')].map((b) => Number(b.getAttribute('data-count')));
    expect(counts).toEqual(RF.byMf[mf - 1].roots);
  }
  player.goto(step('max-features'));
  for (const mf of [1, 8]) {
    slide(ctl(host, 'maxFeatures'), mf);
    const row = RF.byMf[mf - 1];
    expect(el.querySelector('.formula')!.textContent).toContain(`max_features = ${mf} · ρ = ${fmt(row.rho)}`);
    expect(el.querySelector('.rf-roots-host text.lc-label')!.textContent).toContain(fmt(row.rho));
  }
});

it('rho and m sliders update the variance strip', () => {
  const { host, el, player } = setup();
  player.goto(step('varyans'));
  expect([ctl(host, 'rho').min, ctl(host, 'rho').max, ctl(host, 'rho').step]).toEqual(['0', '1', '0.01']);
  expect([ctl(host, 'trees').min, ctl(host, 'trees').max]).toEqual(['1', '250']);
  slide(ctl(host, 'rho'), 0.2);
  slide(ctl(host, 'trees'), 100);
  const strip = el.querySelector('.formula')!.textContent!;
  expect(strip).toContain('M = 100');
  expect(strip).toContain(`Random Forest ρ = 0,200 → ${fmt(ensembleVariance(0.2, 1, 100))}`);
  expect(el.querySelector('.rf-roots-host text.lc-label')!.textContent).toContain('M = 100');
});

it('tree count slider moves the curve marker', () => {
  const { host, el, player } = setup();
  player.goto(step('agac-sayisi'));
  expect([ctl(host, 'nEstimators').min, ctl(host, 'nEstimators').max, ctl(host, 'nEstimators').step]).toEqual(['10', '500', '10']);
  for (const n of [10, 150, 500]) {
    slide(ctl(host, 'nEstimators'), n);
    const at = OOB_CURVE.find((p) => p.n === n)!;
    expect(el.querySelector('.rf-curves-host text.lc-label')!.textContent).toBe(`${n} ağaç · ${fmt(at.oob)}`);
    expect(el.querySelector('.formula')!.textContent).toContain(`n_estimators=${n}`);
  }
  // the OOB steps use the same tree-count slider, 1-50
  player.goto(step('oob-matris'));
  expect([ctl(host, 'trees').min, ctl(host, 'trees').max]).toEqual(['1', '50']);
  slide(ctl(host, 'trees'), 5);
  expect(el.querySelectorAll('.rf-oob-host g.oob-cell.idle').length).toBeGreaterThan(0);
});

it('method and id toggles switch the bars', () => {
  const { host, el, player } = setup();
  const bars = (root: Element) => [...root.querySelectorAll('g.imp-bar text.bar-name')].map((t) => t.textContent);
  player.goto(step('onem'));
  const book = [...RF.names].sort((a, b) => RF.mdi[RF.names.indexOf(b)] - RF.mdi[RF.names.indexOf(a)]);
  expect(bars(el)).toEqual(book);
  toggle(ctl(host, 'withId'), true);
  expect(player.state.params.withId).toBe(true);
  expect(bars(el)).toHaveLength(9);
  expect(bars(el)).toContain('musteriNo');
  toggle(ctl(host, 'withId'), false);
  expect(bars(el)).toEqual(book);
  // step 10 always shows the split model; the method toggle picks the highlighted column
  player.goto(step('tuzak'));
  const col = (m: string) => el.querySelector(`.rf-importance-host g.imp-col[data-method=${m}]`)!;
  expect(col('mdi').classList.contains('muted')).toBe(false);
  expect(col('perm').classList.contains('muted')).toBe(true);
  choose(ctl(host, 'method'), 'perm');
  expect(player.state.params.method).toBe('perm');
  expect(col('mdi').classList.contains('muted')).toBe(true);
  expect(col('perm').classList.contains('muted')).toBe(false);
  expect(el.querySelector('.formula')!.textContent).toContain('permütasyon: musteriNo');
  expect(bars(col('perm'))).toHaveLength(9);
  expect(bars(col('mdi'))).toHaveLength(9);
});

it('every strip stays finite at slider ends', () => {
  const { host, el, player } = setup();
  const finite = () => {
    expect(deriveRfView(player.state.index, player.state.params).strip).not.toMatch(/NaN|undefined|Infinity/);
    expect(el.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
  };
  const ends: [string, string, number[]][] = [
    ['alt-kume', 'maxFeatures', [1, 8]],
    ['max-features', 'maxFeatures', [1, 8]],
    ['varyans', 'rho', [0, 1]],
    ['varyans', 'trees', [1, 250]],
    ['oob-matris', 'trees', [1, 50]],
    ['oob-skor', 'trees', [1, 50]],
    ['agac-sayisi', 'nEstimators', [10, 500]],
  ];
  for (const [id, key, values] of ends) {
    player.goto(step(id));
    for (const v of values) {
      slide(ctl(host, key), v);
      finite();
    }
  }
  player.goto(step('onem'));
  for (const on of [true, false]) {
    toggle(ctl(host, 'withId'), on);
    finite();
  }
  player.goto(step('tuzak'));
  for (const m of ['perm', 'mdi']) {
    choose(ctl(host, 'method'), m);
    finite();
  }
});

it('only the steps own controls are visible', () => {
  const { host, player } = setup();
  const groups: Record<string, readonly number[]> = {
    maxFeatures: MF_STEPS,
    rho: RHO_M_STEPS,
    trees: [...RHO_M_STEPS, ...TREES_STEPS],
    nEstimators: NEST_STEPS,
    withId: ID_STEPS,
    method: METHOD_STEPS,
  };
  randomForestScenario.steps.forEach((_, i) => {
    player.goto(i);
    for (const [key, steps] of Object.entries(groups)) {
      const el = ctl(host, key);
      expect(el.disabled, `${key} @${i}`).toBe(!steps.includes(i));
      expect(el.closest('.ctl')!.hasAttribute('data-off'), `${key} @${i}`).toBe(!steps.includes(i));
    }
    const any = Object.values(groups).some((s) => s.includes(i));
    expect(host.querySelector('.rf-params')!.hasAttribute('data-off')).toBe(!any);
  });
  // steps 1 and 7 have no control at all
  for (const id of ['kokler', 'oob-cv']) {
    player.goto(step(id));
    expect(host.querySelectorAll('.ctl:not([data-off])')).toHaveLength(0);
  }
});

it('the Lab note names p/3 for regression and Extra Trees', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const player = new StepPlayer(randomForestScenario);
  clean.push(() => player.destroy());
  mountRfExtra(host, player);
  expect(host.textContent).toContain('p/3');
  expect(host.textContent).toContain('Extra Trees');
});

labTextTests(randomForestScenario.steps, [2, 3, 4, 5, 6, 8, 9, 10]);
