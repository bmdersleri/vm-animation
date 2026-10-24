// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { boostingAyarlariScenario as sc } from '../../../src/concepts/boosting-ayarlari/scenario';
import { mountTuneScene } from '../../../src/concepts/boosting-ayarlari/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountTuneScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
// the other hosts keep their own (hidden) drawings, so queries stay inside the curves host
const HOST = '.tune-curves-host ';
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(HOST + sel).length;
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(HOST + sel)].map((t) => t.textContent);

describe('curve scene', () => {
  it('step 1 draws five points on a log axis', () => {
    const { el } = setup();
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('points');
    expect(count(el, 'circle.lc-pin')).toBe(5);
    expect(count(el, 'path.lc-series')).toBe(1);
    expect(texts(el, 'g.axis.x text')).toEqual(['0,01', '0,05', '0,1', '0,3', '0,5']);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['0,930', '0,964', '0,969', '0,970', '0,963']);
    expect(el.querySelector('.formula')!.textContent).toContain('GradientBoostingClassifier');
  });

  it('step 2 sweep ends at 150 with five labelled curves', () => {
    const { el, player } = setup();
    go(player, 'egriler');
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('curves');
    player.setParam('trees', 150);
    expect(count(el, 'path.lc-series')).toBe(5);
    expect(texts(el, 'text.end-label')).toEqual(['ν = 0,01', 'ν = 0,05', 'ν = 0,1', 'ν = 0,3', 'ν = 0,5']);
    expect(count(el, 'line.cv-vline')).toBe(1);
    const d = el.querySelector(HOST + 'path.lc-series')!.getAttribute('d')!;
    expect(d.split('L')).toHaveLength(150);
    expect(texts(el, 'g.axis.x text')).toEqual(['1', '100', '200', '300', '400', '500']);
  });

  it('step 3 pins the AUC at 150 and 500 trees', () => {
    const { el, player } = setup();
    go(player, 'agac-ekle');
    expect(count(el, 'path.lc-series')).toBe(1);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['150. ağaç · AUC 0,930', '500. ağaç · AUC 0,959']);
  });

  it('step 4 shades the gap between train and val', () => {
    const { el, player } = setup();
    go(player, 'ezber');
    expect(count(el, 'path.gap')).toBe(1);
    expect(el.querySelector(HOST + 'path.gap')!.getAttribute('d')).toMatch(/^M.*Z$/);
    expect(count(el, 'path.lc-series.train')).toBe(1);
    expect(count(el, 'path.lc-series.val')).toBe(1);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['7. ağaç · 0,3136']);
    expect(texts(el, 'text.end-label')).toEqual(['eğitim', 'doğrulama']);
  });

  it('step 5 draws best and stop lines', () => {
    const { el, player } = setup();
    go(player, 'erken-durdurma');
    expect(count(el, 'line.cv-vline')).toBe(2);
    expect(texts(el, 'text.cv-vlabel')).toEqual(['91. ağaçta en düşük', '141. ağaçta dur']);
    expect(el.querySelector('.formula')!.textContent).toContain('early_stopping_rounds=50');
    expect(count(el, 'text.cv-note')).toBe(0);
    player.setParam('lr', 0.01);
    expect(texts(el, 'text.cv-note')).toEqual(['500 ağaca kadar durmadı']);
  });

  it('steps 6-10 reserve their own views', () => {
    const { el, player } = setup();
    go(player, 'seviye');
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('grow');
    go(player, 'izgara');
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('search');
  });

  it('reduced motion lands the sweep on its last value at once', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { el, player } = setup();
    go(player, 'egriler');
    expect(player.state.params.trees).toBe(150);
    expect(count(el, 'path.lc-series')).toBe(5);
    expect(texts(el, 'text.end-label')).toHaveLength(5);
    // the sweep would start at one tree; every curve already holds all 150 points
    expect(el.querySelector(HOST + 'path.lc-series')!.getAttribute('d')!.split('L')).toHaveLength(150);
  });
});
