// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { mountImbScene } from '../../../src/concepts/dengesiz-veri/scene';
import { splitLayout } from '../../../src/concepts/dengesiz-veri/scene-scatter';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountImbScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(sel).length;

describe('scatter scene', () => {
  it('step 1 draws 2000 points with 124 churners', () => {
    const { el } = setup();
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('scatter');
    expect(count(el, 'circle.pt')).toBe(2000);
    expect(count(el, 'circle.pt.pos')).toBe(124);
    expect(el.querySelector('.imb-bar.neg .bar-value')!.textContent).toBe('1876');
    expect(el.querySelector('.imb-bar.pos .bar-value')!.textContent).toBe('124');
    expect(count(el, '.neighbour-line')).toBe(0);
  });

  it('step 3 shows undefined precision', () => {
    const { el, player } = setup();
    go(player, 'azinlik');
    expect(el.querySelector('.metric.precision .metric-value')!.textContent).toBe(UNDEFINED_TEXT);
    expect(el.querySelector('[data-cell="fn"] .cell-count')!.textContent).toBe('37');
    expect(el.querySelector('.book-line')!.textContent).toContain('classification_report');
  });

  it('step 4 leaves only the 1400 training points', () => {
    const { el, player } = setup();
    go(player, 'egitim');
    expect(count(el, 'circle.pt')).toBe(1400);
    expect(count(el, 'circle.pt.is-test')).toBe(0);
  });

  it('step 5 draws five neighbour lines and x new', () => {
    const { el, player } = setup();
    go(player, 'sentetik');
    expect(count(el, 'line.neighbour-line')).toBe(5);
    expect(count(el, 'line.chosen-line')).toBe(1);
    expect(count(el, 'circle.x-new')).toBe(1);
    expect(count(el, 'circle.x-i')).toBe(1);
  });

  it('step 5 strip shows both features with numbers', () => {
    const { el, player } = setup();
    go(player, 'sentetik');
    const strip = el.querySelector('.formula')!.textContent!;
    expect(strip).toContain('x_new = x_i + λ · (x_zi − x_i)');
    expect(strip).toMatch(/kıdem: \d+ \+ \d,\d\d · \(\d+ − \d+\) = \d+,\d ay/);
    expect(strip).toMatch(/aylık ücret: \d+,\d\d \+ \d,\d\d/);
  });

  it('steps 6-10 only reserve their view area', () => {
    const { el, player } = setup();
    go(player, 'smote-doldur');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('smote');
    go(player, 'sinir');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('boundary');
  });

  it('scatter and side panel fit 390 px without overlap', () => {
    const { el, player } = setup(390, 520);
    go(player, 'azinlik');
    const lay = splitLayout(390, 520, 380);
    expect(lay.narrow).toBe(true);
    expect(lay.scatter.x + lay.scatter.w).toBeLessThanOrEqual(390);
    expect(lay.side.x + lay.side.w).toBeLessThanOrEqual(390);
    expect(lay.side.y).toBeGreaterThanOrEqual(lay.scatter.y + lay.scatter.h);
    const wide = splitLayout(1280, 540, 380);
    expect(wide.scatter.x + wide.scatter.w).toBeLessThanOrEqual(wide.side.x);
    const svg = el.querySelector('svg.imb-plot')!;
    expect(Number(svg.getAttribute('width'))).toBe(390);
    expect(Number(svg.getAttribute('height'))).toBeGreaterThanOrEqual(lay.scatter.h);
    for (const c of el.querySelectorAll('circle.pt')) {
      expect(Number(c.getAttribute('cx'))).toBeLessThanOrEqual(390);
      expect(Number(c.getAttribute('cx'))).toBeGreaterThanOrEqual(0);
    }
  });
});
