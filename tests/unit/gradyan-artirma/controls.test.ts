// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { bindKeys } from '../../../src/core/keyboard';
import { formatNumber as f } from '../../../src/core/plot/format';
import { gradyanArtirmaScenario as sc, NU_VALUES, runFor, thresholdsOf } from '../../../src/concepts/gradyan-artirma/scenario';
import { mountGbParams } from '../../../src/concepts/gradyan-artirma/controls';
import { mountGbExtra } from '../../../src/concepts/gradyan-artirma/extra';
import { mountGbScene } from '../../../src/concepts/gradyan-artirma/scene';
import { deriveGbView, errText } from '../../../src/concepts/gradyan-artirma/view';
import { labTextTests } from '../lab-text';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(host, el);
  const player = new StepPlayer(sc);
  mountGbParams(host, player);
  const scene = mountGbScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => sc.steps.findIndex((s) => s.id === id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`[data-param=${key}]`)!;
function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const nuAt = (nu: number) => (NU_VALUES as readonly number[]).indexOf(nu);

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9]);

it("depth slider changes the first tree's pieces", () => {
  const { host, el, player } = setup();
  player.goto(step('ilk-agac'));
  expect([ctl(host, 'depth').min, ctl(host, 'depth').max]).toEqual(['1', '3']);
  for (const d of [1, 3, 2]) {
    slide(ctl(host, 'depth'), d);
    expect(player.state.params.depth).toBe(d);
    const thr = thresholdsOf(runFor(player.state.params.nu, d), 0);
    expect(el.querySelectorAll('line.thr-line')).toHaveLength(thr.length);
    expect([...el.querySelectorAll('text.thr-label')].map((t) => t.textContent)).toEqual(thr.map((t) => `x ≤ ${f(t, 3)}`));
  }
  expect(el.querySelectorAll('line.thr-line')).toHaveLength(3);
});

it('nu and m sliders update the strip and error', () => {
  const { host, el, player } = setup();
  const strip = () => el.querySelector('.formula')!.textContent!;
  player.goto(step('kucuk-adim'));
  expect([ctl(host, 'nu').min, ctl(host, 'nu').max]).toEqual(['0', String(NU_VALUES.length - 1)]);
  slide(ctl(host, 'nu'), nuAt(0.1));
  expect(player.state.params.nu).toBe(0.1);
  expect(strip()).toContain('F₁ = F₀ + 0,1 · h₁');
  expect(strip()).toContain(f(runFor(0.1, 2).trainMse[0], 4));
  player.goto(step('tekrar'));
  expect([ctl(host, 'm').min, ctl(host, 'm').max]).toEqual(['1', '20']);
  slide(ctl(host, 'm'), 12);
  expect(strip()).toContain('F₁₂ = F₁₁ + 0,1 · h₁₂');
  expect(strip()).toContain(f(runFor(0.1, 2).trainMse[11], 4));
  slide(ctl(host, 'nu'), nuAt(0.02));
  expect(strip()).toContain('0,02');
  expect(strip()).toContain(f(runFor(0.02, 2).trainMse[11], 4));
});

it('tree slider moves the marker and both errors', () => {
  const { host, el, player } = setup();
  player.goto(step('durma'));
  const cx = () => Number(el.querySelector('circle.lc-marker')!.getAttribute('cx'));
  const strip = () => el.querySelector('.formula')!.textContent!;
  expect([ctl(host, 'trees').min, ctl(host, 'trees').max]).toEqual(['1', '200']);
  slide(ctl(host, 'trees'), 60);
  const at60 = cx();
  const run = runFor(0.3, 2);
  expect(strip()).toContain('M = 60');
  expect(strip()).toContain(`eğitim hatası = ${errText(run.trainMse[59])}`);
  expect(strip()).toContain(`doğrulama hatası = ${errText(run.valMse[59])}`);
  slide(ctl(host, 'trees'), 150);
  expect(cx()).toBeGreaterThan(at60);
  expect(strip()).toContain(`doğrulama hatası = ${errText(run.valMse[149])}`);
  // depth redraws the same chart from another run
  slide(ctl(host, 'depth'), 3);
  expect(strip()).toContain(errText(runFor(0.3, 3).valMse[149]));
});

it('val toggle shows hollow points', () => {
  const { host, el, player } = setup();
  const toggle = ctl(host, 'showVal');
  expect(toggle.type).toBe('checkbox');
  expect(el.querySelectorAll('circle.pt-val')).toHaveLength(0);
  toggle.click();
  expect(player.state.params.showVal).toBe(true);
  expect(el.querySelectorAll('circle.pt-val')).toHaveLength(80);
  toggle.click();
  expect(el.querySelectorAll('circle.pt-val')).toHaveLength(0);
});

it('every strip stays finite at slider ends', () => {
  const { host, el, player } = setup();
  const last = NU_VALUES.length - 1;
  const ends: [string, string, number[]][] = [
    ['ilk-agac', 'depth', [1, 3]],
    ['kucuk-adim', 'nu', [0, last]],
    ['kucuk-adim', 'm', [1, 20]],
    ['tekrar', 'm', [1, 20]],
    ['durma', 'nu', [0, last]],
    ['durma', 'depth', [1, 3]],
    ['durma', 'trees', [1, 200]],
    ['ogrenme-orani', 'nu', [0, last]],
    ['ogrenme-orani', 'trees', [1, 200]],
    ['ezber', 'nu', [0, last]],
    ['ezber', 'depth', [1, 3]],
    ['ezber', 'trees', [1, 200]],
  ];
  for (const [id, key, values] of ends) {
    player.goto(step(id));
    for (const v of values) {
      slide(ctl(host, key), v);
      const view = deriveGbView(player.state.index, player.state.params);
      expect(view.strip, `${id} ${key}=${v}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(el.innerHTML, `${id} ${key}=${v}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  }
});

it("only the step's controls are visible", () => {
  const { host, player } = setup();
  const visible = () =>
    [...host.querySelectorAll<HTMLInputElement>('[data-param]')]
      .filter((i) => !i.disabled && !i.closest('[data-off]'))
      .map((i) => i.dataset.param)
      .sort();
  const want: Record<string, string[]> = {
    veri: ['showVal'],
    baslangic: ['showVal'],
    artik: ['showVal'],
    'ilk-agac': ['depth'],
    'kucuk-adim': ['m', 'nu'],
    tekrar: ['m', 'nu'],
    durma: ['depth', 'nu', 'trees'],
    'ogrenme-orani': ['depth', 'nu', 'trees'],
    ezber: ['depth', 'nu', 'trees'],
    'bagging-karsi': [],
  };
  for (const s of sc.steps) {
    player.goto(step(s.id));
    expect(visible(), s.id).toEqual(want[s.id]);
  }
  expect(host.querySelector('.gb-params')!.hasAttribute('data-off')).toBe(true);
});

it('arrow keys on a slider do not change the step', () => {
  const { host, player } = setup();
  clean.push(bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []));
  player.goto(step('durma'));
  const slider = ctl(host, 'trees');
  for (const key of ['ArrowRight', 'ArrowLeft', ' ']) {
    slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(player.state.index).toBe(step('durma'));
  }
  player.goto(step('veri'));
  ctl(host, 'showVal').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(player.state.index).toBe(step('veri'));
});

it('the Lab note names AdaBoost weights and the classification residual', () => {
  const host = document.createElement('div');
  document.body.append(host);
  mountGbExtra(host, new StepPlayer(sc));
  const text = host.textContent!;
  expect(text).toContain('AdaBoost');
  expect(text).toContain('y − p');
});
