// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { bindKeys } from '../../../src/core/keyboard';
import { formatNumber as f } from '../../../src/core/plot/format';
import { earlyStop } from '../../../src/concepts/boosting/boost';
import { CURVES, SURFACE } from '../../../src/concepts/boosting/data';
import { gridTrials, sequentialSearch } from '../../../src/concepts/boosting/search';
import { leafCount, treeDepth } from '../../../src/concepts/boosting/regtree';
import { boostingAyarlariScenario as sc, curveOf, leafTree, levelTree, trainError } from '../../../src/concepts/boosting-ayarlari/scenario';
import { mountTuneParams } from '../../../src/concepts/boosting-ayarlari/controls';
import { mountTuneExtra } from '../../../src/concepts/boosting-ayarlari/extra';
import { mountTuneScene } from '../../../src/concepts/boosting-ayarlari/scene';
import { deriveTuneView } from '../../../src/concepts/boosting-ayarlari/view';
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
  mountTuneParams(host, player);
  const scene = mountTuneScene(el, player, 'lab', { durationScale: 0 });
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
const lrAt = (lr: number) => CURVES.lrs.indexOf(lr);
const strip = (el: HTMLElement) => el.querySelector('.formula')!.textContent!;
const markerX = (el: HTMLElement) => Number(el.querySelector('circle.lc-marker')!.getAttribute('cx'));
const markerY = (el: HTMLElement) => Number(el.querySelector('circle.lc-marker')!.getAttribute('cy'));

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

it('rate choice and tree slider move the marker', () => {
  const { host, el, player } = setup();
  player.goto(step('agac-ekle'));
  expect([ctl(host, 'lr').min, ctl(host, 'lr').max]).toEqual(['0', '5']);
  expect([ctl(host, 'trees').min, ctl(host, 'trees').max]).toEqual(['1', '500']);
  slide(ctl(host, 'lr'), lrAt(0.05));
  slide(ctl(host, 'trees'), 80);
  const at80 = markerX(el);
  const c = curveOf(0.05);
  expect(strip(el)).toContain(`80 ağaç · doğrulama AUC = ${f(c.valAuc[79], 3)} · log-kaybı = ${f(c.valLoss[79], 3)}`);
  slide(ctl(host, 'trees'), 300);
  expect(markerX(el)).toBeGreaterThan(at80);
  // another rate: same tree count, other height
  const y = markerY(el);
  slide(ctl(host, 'lr'), lrAt(0.5));
  expect(markerY(el)).not.toBe(y);
  expect(strip(el)).toContain(`300 ağaç · doğrulama AUC = ${f(curveOf(0.5).valAuc[299], 3)}`);
  // step 2: the selected curve is the emphasised one
  player.goto(step('egriler'));
  slide(ctl(host, 'lr'), lrAt(0.1));
  slide(ctl(host, 'trees'), 120);
  expect(el.querySelectorAll('path.lc-series.sel')).toHaveLength(1);
  expect(el.querySelectorAll('path.lc-series.dim')).toHaveLength(4);
  expect(strip(el)).toContain(`120 ağaç · doğrulama AUC = ${f(curveOf(0.1).valAuc[119], 3)}`);
  // step 1: the dot plot shows AUC at the chosen tree count for six rates, the chosen one is the marker
  player.goto(step('lr-deney'));
  slide(ctl(host, 'lr'), lrAt(1));
  slide(ctl(host, 'trees'), 20);
  expect(el.querySelectorAll('.tune-curves-host circle.lc-pin')).toHaveLength(5);
  expect(strip(el)).toContain(`ν = 1,0 · 20 ağaç · doğrulama AUC = ${f(curveOf(1).valAuc[19], 3)}`);
  const v = deriveTuneView(step('lr-deney'), player.state.params, true);
  expect(v.chart!.series[0].pts.map(([, ys]) => ys)).toEqual(CURVES.lrs.map((lr) => curveOf(lr).valAuc[19]));
  expect(v.chart!.pins).toHaveLength(5);
  expect(markerY(el)).toBeGreaterThan(0);
});

it('patience slider moves the stop line', () => {
  const { host, el, player } = setup();
  player.goto(step('erken-durdurma'));
  expect([ctl(host, 'patience').min, ctl(host, 'patience').max]).toEqual(['10', '100']);
  const xs = () => [...el.querySelectorAll('line.cv-vline')].map((l) => Number(l.getAttribute('x1')));
  const lbl = () => [...el.querySelectorAll('text.cv-vlabel')].map((t) => t.textContent);
  const es = (pat: number) => earlyStop(curveOf(0.3).valLoss, pat);
  slide(ctl(host, 'patience'), 20);
  expect(lbl()).toEqual([`${es(20).best}. ağaçta en düşük`, `${es(20).stop}. ağaçta dur`]);
  const x20 = xs()[1];
  slide(ctl(host, 'patience'), 100);
  expect(lbl()[1]).toBe(`${es(100).stop}. ağaçta dur`);
  expect(xs()[1]).toBeGreaterThan(x20);
  expect(strip(el)).toContain('early_stopping_rounds=100');
});

it('patience past the curve end shows the no-stop text', () => {
  const { host, el, player } = setup();
  player.goto(step('erken-durdurma'));
  slide(ctl(host, 'lr'), lrAt(0.01));
  const es = earlyStop(curveOf(0.01).valLoss, 10);
  expect(es.stop).toBeNull();
  expect(el.querySelectorAll('line.cv-vline')).toHaveLength(1);
  expect(el.querySelector('text.cv-note')!.textContent).toBe('500 ağaca kadar durmadı');
  expect(strip(el)).toContain('durma yok');
  slide(ctl(host, 'lr'), lrAt(0.3));
  slide(ctl(host, 'patience'), 100);
  expect(earlyStop(curveOf(0.3).valLoss, 100).stop).not.toBeNull();
  expect(el.querySelector('text.cv-note')).toBeNull();
});

it('depth slider regrows both trees', () => {
  const { host, el, player } = setup();
  const G = '.tune-grow-host ';
  const count = (sel: string) => el.querySelectorAll(G + sel).length;
  const head = () => [...el.querySelectorAll(G + 'text.tg-head')].map((t) => t.textContent);
  player.goto(step('seviye'));
  expect([ctl(host, 'depth').min, ctl(host, 'depth').max]).toEqual(['1', '3']);
  for (const d of [1, 3, 2]) {
    slide(ctl(host, 'depth'), d);
    const t = levelTree(d);
    expect(count('g.tg-node.leaf')).toBe(leafCount(t));
    expect(count('line.tg-cut')).toBe(leafCount(t) - 1);
    expect(head()[1]).toBe(`hata ${f(trainError(t), 3)}`);
  }
  player.goto(step('yaprak'));
  for (const d of [1, 3]) {
    slide(ctl(host, 'depth'), d);
    const t = leafTree(2 ** d);
    expect(count('g.tg-node.leaf')).toBe(2 ** d);
    expect(count('line.tg-cut')).toBe(2 ** d - 1);
    expect(head()[0]).toBe(`yaprak-öncelikli · ${leafCount(t)} yaprak · derinlik ${treeDepth(t)}`);
    expect(head()[1]).toBe(`hata ${f(trainError(t), 3)}`);
  }
});

it('cut badges stay apart at depth 3 on a wide and a narrow stage', () => {
  for (const [w, h] of [[1280, 540], [390, 700]]) {
    const { host, el, player } = setup(w, h);
    for (const id of ['seviye', 'yaprak']) {
      player.goto(step(id));
      slide(ctl(host, 'depth'), 3);
      const badges = [...el.querySelectorAll('.tune-grow-host g.tg-cut-badge circle')].map((c) => ({
        x: Number(c.getAttribute('cx')),
        y: Number(c.getAttribute('cy')),
        r: Number(c.getAttribute('r')),
      }));
      expect(badges).toHaveLength(7);
      for (let i = 0; i < badges.length; i++) {
        for (let j = i + 1; j < badges.length; j++) {
          const d = Math.hypot(badges[i].x - badges[j].x, badges[i].y - badges[j].y);
          expect(d, `${id} ${w}px badges ${i}/${j}`).toBeGreaterThanOrEqual(badges[i].r * 2 - 0.5);
        }
      }
    }
    clean.splice(0).forEach((fn) => fn());
    document.body.replaceChildren();
  }
});

it('leaf slider updates depth and errors', () => {
  const { host, el, player } = setup();
  player.goto(step('yaprak-siniri'));
  expect([ctl(host, 'leaves').min, ctl(host, 'leaves').max]).toEqual(['2', '64']);
  slide(ctl(host, 'leaves'), 10);
  const t = leafTree(10);
  expect(strip(el)).toContain(`${leafCount(t)} yaprak · derinlik ${treeDepth(t)}`);
  expect(el.querySelector('text.cv-vlabel')!.textContent).toBe(`${leafCount(t)} yaprak · derinlik ${treeDepth(t)}`);
  const x10 = Number(el.querySelector('line.cv-vline')!.getAttribute('x1'));
  slide(ctl(host, 'leaves'), 40);
  expect(Number(el.querySelector('line.cv-vline')!.getAttribute('x1'))).toBeGreaterThan(x10);
  expect(strip(el)).toContain(`${leafCount(leafTree(40))} yaprak`);
});

it('budget and new start change the trials', () => {
  const { host, el, player } = setup();
  const S = '.tune-search-host ';
  const tried = () => [...el.querySelectorAll(S + 'rect.hm-tried')].map((r) => Number(r.getAttribute('data-cell')));
  player.goto(step('izgara'));
  expect([ctl(host, 'budget').min, ctl(host, 'budget').max]).toEqual(['4', '16']);
  expect(ctl(host, 'seed').closest('[data-off]')).not.toBeNull();
  for (const b of [4, 16, 8]) {
    slide(ctl(host, 'budget'), b);
    expect(tried()).toEqual(gridTrials(b));
  }
  player.goto(step('sirali-arama'));
  slide(ctl(host, 'budget'), 12);
  expect(tried()).toEqual(sequentialSearch(SURFACE.auc, 12, 0));
  const before = tried();
  ctl(host, 'seed').click();
  expect(player.state.params.seed).toBe(1);
  expect(tried()).toEqual(sequentialSearch(SURFACE.auc, 12, 1));
  expect(tried()).not.toEqual(before);
  // the second strip row compares both searches and names the trials each used
  const rows = strip(el);
  expect(rows).toContain('ızgara (12 deneme) en iyisi: derinlik');
  expect(rows).toContain('sıralı (12 deneme) en iyisi: derinlik');
  const best = (cells: number[]) => cells.reduce((a, c) => (SURFACE.auc.flat()[c] > SURFACE.auc.flat()[a] ? c : a));
  const g = best(gridTrials(12));
  expect(rows).toContain(`AUC ${f(SURFACE.auc.flat()[g], 3)} · sıralı`);
});

it('an odd budget does not claim more grid trials than ran', () => {
  const { host, el, player } = setup();
  player.goto(step('izgara'));
  slide(ctl(host, 'budget'), 5);
  const used = gridTrials(5).length;
  expect(used).toBe(4);
  expect(strip(el)).toContain(`${used} / 5 deneme (ızgara ${used} deneme kullanır)`);
  slide(ctl(host, 'budget'), 8);
  expect(strip(el)).toContain('8 / 8 deneme ·');
  expect(strip(el)).not.toContain('kullanır');
  player.goto(step('sirali-arama'));
  slide(ctl(host, 'budget'), 5);
  expect(strip(el)).toContain('5 / 5 deneme ·');
  expect(strip(el)).toContain(`ızgara (${used} deneme) en iyisi`);
  expect(strip(el)).toContain('sıralı (5 deneme) en iyisi');
});

it('surface toggle reveals all cells', () => {
  const { host, el, player } = setup();
  const on = () =>
    [...el.querySelectorAll('.tune-search-host rect.hm-surface')].filter((r) => Number(r.getAttribute('opacity')) > 0).length;
  for (const id of ['izgara', 'sirali-arama']) {
    player.goto(step(id));
    expect(on(), id).toBe(0);
    ctl(host, 'showSurface').click();
    expect(player.state.params.showSurface).toBe(true);
    expect(on(), id).toBe(54);
    ctl(host, 'showSurface').click();
    expect(on(), id).toBe(0);
  }
});

it('every strip stays finite at slider ends', () => {
  const { host, el, player } = setup();
  const last = CURVES.lrs.length - 1;
  const ends: [string, string, number[]][] = [
    ['lr-deney', 'lr', [0, last]],
    ['lr-deney', 'trees', [1, 500]],
    ['egriler', 'lr', [0, last]],
    ['egriler', 'trees', [1, 500]],
    ['agac-ekle', 'lr', [0, last]],
    ['agac-ekle', 'trees', [1, 500]],
    ['ezber', 'lr', [0, last]],
    ['erken-durdurma', 'lr', [0, last]],
    ['erken-durdurma', 'patience', [10, 100]],
    ['seviye', 'depth', [1, 3]],
    ['yaprak', 'depth', [1, 3]],
    ['yaprak-siniri', 'leaves', [2, 64]],
    ['izgara', 'budget', [4, 16]],
    ['sirali-arama', 'budget', [4, 16]],
  ];
  for (const [id, key, values] of ends) {
    player.goto(step(id));
    for (const v of values) {
      slide(ctl(host, key), v);
      const view = deriveTuneView(player.state.index, player.state.params, true);
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
    'lr-deney': ['lr', 'trees'],
    egriler: ['lr', 'trees'],
    'agac-ekle': ['lr', 'trees'],
    ezber: ['lr'],
    'erken-durdurma': ['lr', 'patience'],
    seviye: ['depth'],
    yaprak: ['depth'],
    'yaprak-siniri': ['leaves'],
    izgara: ['budget', 'showSurface'],
    'sirali-arama': ['budget', 'seed', 'showSurface'],
  };
  for (const s of sc.steps) {
    player.goto(step(s.id));
    expect(visible(), s.id).toEqual(want[s.id].sort());
  }
});

it('arrow keys on a slider do not change the step', () => {
  const { host, player } = setup();
  clean.push(bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []));
  player.goto(step('agac-ekle'));
  const slider = ctl(host, 'trees');
  for (const key of ['ArrowRight', 'ArrowLeft', ' ']) {
    slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(player.state.index).toBe(step('agac-ekle'));
  }
  player.goto(step('izgara'));
  ctl(host, 'showSurface').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(player.state.index).toBe(step('izgara'));
});

it('the Lab note names the Hessian, the penalties and the histogram bins', () => {
  const host = document.createElement('div');
  document.body.append(host);
  mountTuneExtra(host, new StepPlayer(sc));
  const text = host.textContent!;
  expect(text).toContain('XGBoost');
  expect(text).toContain('Hessian');
  expect(text).toContain('L1 ile L2');
  expect(text).toContain('LightGBM');
  expect(text).toContain('histogram');
});
