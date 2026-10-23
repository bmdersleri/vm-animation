// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  baggingScenario,
  DRAW_STEPS,
  N_STEPS,
  PM_STEPS,
  rootLabel,
  SAMPLE_STEPS,
  TREES_STEPS,
  TREE_STEPS,
} from '../../../src/concepts/bagging/scenario';
import { mountBaggingParams } from '../../../src/concepts/bagging/controls';
import { mountBaggingExtra } from '../../../src/concepts/bagging/extra';
import { mountBaggingScene } from '../../../src/concepts/bagging/scene';
import { deriveBaggingView, drawsFor } from '../../../src/concepts/bagging/view';
import { BOOK_BOOT, BOOTS, CUSTOMERS } from '../../../src/concepts/topluluk/data';
import { labBootstrap } from '../../../src/concepts/topluluk/math';
import { votes } from '../../../src/concepts/topluluk/vote';
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
  const player = new StepPlayer(baggingScenario);
  mountBaggingParams(host, player);
  const scene = mountBaggingScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => baggingScenario.steps.findIndex((s) => s.id === id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`[data-param=${key}]`)!;
const btn = (host: HTMLElement, action: string) => host.querySelector<HTMLButtonElement>(`[data-action=${action}]`)!;
function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

it('new draw changes the sample and book draw restores it', () => {
  const { host, player } = setup();
  player.goto(step('cekilis'));
  expect(drawsFor(player.state.params.n, player.state.params.draw)).toEqual(BOOK_BOOT.sample);
  slide(ctl(host, 'n'), 14);
  btn(host, 'new-draw').click();
  const p = player.state.params;
  expect(p.n).toBe(14);
  expect(p.draw).not.toBe(0);
  expect(deriveBaggingView(player.state.index, p).bag!.sample).toEqual(labBootstrap(14, p.draw));
  btn(host, 'new-draw').click();
  expect(player.state.params.draw).not.toBe(p.draw);
  btn(host, 'book').click();
  expect(player.state.params).toMatchObject({ n: 10, draw: 0 });
  expect(deriveBaggingView(player.state.index, player.state.params).bag!.sample).toEqual(BOOK_BOOT.sample);
});

it('a draw without oob shows the empty text', () => {
  const { host, player } = setup();
  let draw = 1;
  while (new Set(labBootstrap(5, draw)).size < 5) draw++;
  player.goto(step('oob'));
  slide(ctl(host, 'n'), 5);
  player.setParam('draw', draw);
  expect(deriveBaggingView(player.state.index, player.state.params).bag!.oob).toEqual([]);
  const readout = host.querySelector('.bagging-readout')!;
  expect(readout.textContent).toContain('OOB müşteri yok');
  player.setParams({ draw: 0, n: 10 });
  expect(readout.textContent).not.toContain('OOB müşteri yok');
  expect(readout.textContent).toContain('4 / 10');
});

it("tree slider shows that bootstrap's tree", () => {
  const { host, el, player } = setup();
  player.goto(step('uc-agac'));
  expect(ctl(host, 'tree').min).toBe('1');
  expect(ctl(host, 'tree').max).toBe(String(BOOTS.length - 2));
  const titles = () => [...el.querySelectorAll('g.panel text.panel-title')].map((t) => t.textContent!);
  for (const k of [17, BOOTS.length - 2]) {
    slide(ctl(host, 'tree'), k);
    expect(player.state.params.tree).toBe(k);
    // the window of three ends at tree 50, so the selected tree is always on screen
    const first = Math.min(k, BOOTS.length - 2) - 1;
    const want = [0, 1, 2].map((j) => rootLabel(BOOTS[first + j].tree));
    expect(titles().map((t, j) => t.replace(/\s+/g, ' ').includes(want[j]))).toEqual([true, true, true]);
  }
});

it('clicking a customer writes its vote breakdown', () => {
  const { host, el, player } = setup();
  player.goto(step('oylama'));
  slide(ctl(host, 'trees'), 7);
  const pts = [...el.querySelectorAll<SVGPathElement>('path.pt')];
  expect(pts).toHaveLength(25);
  expect(pts.every((p) => p.getAttribute('tabindex') === '0')).toBe(true);
  const point = (i: number) => el.querySelector<SVGPathElement>(`path.pt[data-i="${i}"]`)!;
  const callout = () => el.querySelector('.vote-callout')!.textContent!;
  point(3).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(player.state.params.pick).toBe(3);
  expect(callout()).toMatch(/^7 ağaçtan \d+ tanesi Ayrıldı → /);
  const k = Number(/7 ağaçtan (\d+)/.exec(callout())![1]);
  const c = CUSTOMERS[3];
  expect(k).toBe(votes([c.t, c.c], 7));
  expect(el.querySelector('.formula')!.textContent).toContain(`müşteri 3 · 7 ağaçtan Ayrıldı oyu = ${k} / 7`);
  // keyboard: Enter and Space select the focused point, other keys do not
  point(11).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(player.state.params.pick).toBe(11);
  point(5).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(player.state.params.pick).toBe(5);
  point(8).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  expect(player.state.params.pick).toBe(5);
});

it('every strip stays finite at slider ends', () => {
  const { host, el, player } = setup();
  const finite = () => {
    const v = deriveBaggingView(player.state.index, player.state.params);
    expect(v.strip).not.toMatch(/NaN|undefined|Infinity/);
    expect(el.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
  };
  const ends: [string, string, number[]][] = [
    ['torba', 'n', [5, 20]],
    ['cekilis', 'n', [5, 20]],
    ['oob', 'n', [5, 20]],
    ['yuzde', 'n', [1, 100]],
    ['uc-agac', 'tree', [1, BOOTS.length - 2]],
    ['oylama', 'trees', [1, 50]],
    ['cogunluk', 'p', [0.5, 0.95]],
    ['cogunluk', 'm', [1, 51]],
  ];
  for (const [id, key, values] of ends) {
    player.goto(step(id));
    for (const v of values) {
      slide(ctl(host, key), v);
      finite();
    }
  }
  // the "100 kez çek" run at both ends of n
  player.goto(step('yuzde'));
  for (const n of [1, 100]) {
    slide(ctl(host, 'n'), n);
    btn(host, 'sample100').click();
    const avg = player.state.params.avg!;
    expect(Number.isFinite(avg)).toBe(true);
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(1);
    finite();
  }
  // the card row at the largest n of the card steps
  player.goto(step('oob'));
  slide(ctl(host, 'n'), 20);
  const widths = [...el.querySelectorAll('g.bag-card rect')].map((r) => Number(r.getAttribute('width')));
  expect(widths).toHaveLength(20);
  expect(widths.every((w) => Number.isFinite(w) && w > 0)).toBe(true);
});

it("only the step's controls are visible", () => {
  const { host, player } = setup();
  const groups: Record<string, readonly number[]> = {
    n: N_STEPS,
    'action:new-draw': DRAW_STEPS,
    'action:book': DRAW_STEPS,
    'action:sample100': SAMPLE_STEPS,
    tree: TREE_STEPS,
    trees: TREES_STEPS,
    p: PM_STEPS,
    m: PM_STEPS,
  };
  const find = (key: string): HTMLInputElement | HTMLButtonElement =>
    key.startsWith('action:') ? btn(host, key.slice(7)) : ctl(host, key);
  baggingScenario.steps.forEach((_, i) => {
    player.goto(i);
    for (const [key, steps] of Object.entries(groups)) {
      const el = find(key);
      expect(el.disabled, `${key} @${i}`).toBe(!steps.includes(i));
      expect(el.closest('.ctl')!.hasAttribute('data-off'), `${key} @${i}`).toBe(!steps.includes(i));
    }
    const any = Object.values(groups).some((s) => s.includes(i));
    expect(host.querySelector('.bagging-params')!.hasAttribute('data-off')).toBe(!any);
  });
  // steps 9 and 10 have no control at all
  player.goto(step('deney'));
  expect(host.querySelectorAll('.ctl:not([data-off])')).toHaveLength(0);
});

it('the n range follows the step and is clamped back for the cards', () => {
  const { host, player } = setup();
  player.goto(step('yuzde'));
  expect([ctl(host, 'n').min, ctl(host, 'n').max]).toEqual(['1', '100']);
  slide(ctl(host, 'n'), 60);
  player.goto(step('oob'));
  expect([ctl(host, 'n').min, ctl(host, 'n').max]).toEqual(['5', '20']);
  expect(player.state.params.n).toBe(20);
});

it('the majority sliders step over odd model counts', () => {
  const { host, player } = setup();
  player.goto(step('cogunluk'));
  expect([ctl(host, 'm').min, ctl(host, 'm').max, ctl(host, 'm').step]).toEqual(['1', '51', '2']);
  expect([ctl(host, 'p').min, ctl(host, 'p').max, ctl(host, 'p').step]).toEqual(['0.5', '0.95', '0.05']);
});

it('the Lab note names Extra Trees and boosting', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const player = new StepPlayer(baggingScenario);
  clean.push(() => player.destroy());
  mountBaggingExtra(host, player);
  expect(host.textContent).toContain('Extra Trees');
  expect(host.textContent).toMatch(/boosting/i);
});

labTextTests(baggingScenario.steps, [1, 2, 3, 4, 6, 7, 8]);

it('the OOB readout uses the concrete exponent', () => {
  const { host, player } = setup();
  player.goto(step('yuzde'));
  slide(ctl(host, 'n'), 10);
  btn(host, 'sample100').click();
  const text = host.querySelector('.bagging-readout')!.textContent!;
  expect(text).toContain('(1 − 1/10)¹⁰ = ');
  expect(text).not.toContain('ⁿ');
});
