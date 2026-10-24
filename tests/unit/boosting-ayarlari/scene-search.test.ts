// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { SURFACE } from '../../../src/concepts/boosting/data';
import { gridTrials, sequentialSearch } from '../../../src/concepts/boosting/search';
import { boostingAyarlariScenario as sc } from '../../../src/concepts/boosting-ayarlari/scenario';
import { mountTuneScene } from '../../../src/concepts/boosting-ayarlari/scene';
import { layoutHeat } from '../../../src/concepts/boosting-ayarlari/scene-search';

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
/** Opens a search step and lets its trial sweep reach the last trial. */
const end = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => {
  go(player, id);
  player.setParam('trial', 8);
};
const S = '.tune-search-host ';
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(S + sel)].map((t) => t.textContent);
const cellsOf = (el: HTMLElement, sel: string) => [...el.querySelectorAll(S + sel)].map((r) => Number(r.getAttribute('data-cell')));
const flat = SURFACE.auc.flat();
const argmax = (cells: number[]) => cells.reduce((a, c) => (flat[c] > flat[a] ? c : a));
const surfaceOn = (el: HTMLElement) =>
  [...el.querySelectorAll(S + 'rect.hm-surface')].filter((r) => Number(r.getAttribute('opacity')) > 0).length;

describe('search scene', () => {
  it('step 9 numbers eight grid cells in order', () => {
    const { el, player } = setup();
    end(player, 'izgara');
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('search');
    expect(cellsOf(el, 'rect.hm-tried')).toEqual(gridTrials(8));
    expect(texts(el, 'text.hm-order')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(cellsOf(el, 'text.hm-order')).toEqual(gridTrials(8));
    expect(el.querySelectorAll(S + 'rect.hm-base')).toHaveLength(54);
    expect(texts(el, 'g.hm-cols text')).toEqual(['0,01', '0,018', '0,032', '0,056', '0,1', '0,18', '0,32', '0,56', '1']);
    expect(texts(el, 'g.hm-rows text')).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(surfaceOn(el)).toBe(0);
    const best = argmax(gridTrials(8));
    expect(cellsOf(el, 'rect.hm-best')).toEqual([best]);
    expect(texts(el, 'text.hm-best-text')[0]).toBe('en iyi: derinlik 5 · ν 0,316 · AUC 0,951');
  });

  it('step 9 grows with the trial count', () => {
    const { el, player } = setup();
    go(player, 'izgara');
    player.setParam('trial', 3);
    expect(cellsOf(el, 'rect.hm-tried')).toEqual(gridTrials(8).slice(0, 3));
  });

  it('step 10 numbers eight sequential cells and frames the best', () => {
    const { el, player } = setup();
    end(player, 'sirali-arama');
    const seq = sequentialSearch(SURFACE.auc, 8, 0);
    expect(cellsOf(el, 'rect.hm-tried')).toEqual(seq);
    expect(texts(el, 'text.hm-order')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(cellsOf(el, 'rect.hm-best')).toEqual([argmax(seq)]);
    expect(texts(el, 'text.hm-best-text')[0]).toBe('en iyi: derinlik 5 · ν 1,0 · AUC 0,957');
    expect(el.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('step 10 reveals all 54 cells at the end', () => {
    const { el, player } = setup();
    end(player, 'sirali-arama');
    expect(el.querySelectorAll(S + 'rect.hm-surface')).toHaveLength(54);
    expect(surfaceOn(el)).toBe(54);
    player.setParam('trial', 5);
    expect(surfaceOn(el)).toBe(0);
    player.setParam('trial', 8);
    expect(surfaceOn(el)).toBe(54);
  });

  it('showSurface reveals the surface at any trial', () => {
    const { el, player } = setup();
    go(player, 'izgara');
    player.setParam('trial', 4);
    player.setParam('showSurface', true);
    expect(surfaceOn(el)).toBe(54);
  });

  it('step 10 links point to gradyan-artirma and capraz-dogrulama', () => {
    const { el, player } = setup();
    go(player, 'izgara');
    expect(el.querySelectorAll(S + 'a')).toHaveLength(0);
    end(player, 'sirali-arama');
    expect([...el.querySelectorAll(S + 'a')].map((a) => a.getAttribute('href'))).toEqual([
      '../gradyan-artirma/',
      '../capraz-dogrulama/',
    ]);
  });

  it('reduced motion lands the search sweeps on the last trial at once', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { el, player } = setup();
    go(player, 'izgara');
    expect(player.state.params.trial).toBe(8);
    expect(cellsOf(el, 'rect.hm-tried')).toHaveLength(8);
    go(player, 'sirali-arama');
    expect(player.state.params.trial).toBe(8);
    expect(cellsOf(el, 'rect.hm-tried')).toHaveLength(8);
    expect(surfaceOn(el)).toBe(54);
  });

  it('heatmap fits 390 px without horizontal overflow', () => {
    const lay = layoutHeat({ w: 390, h: 600, tick: 13, axis: 14, rowLabelW: 10, colLabelW: 36 });
    expect(lay.cells).toHaveLength(54);
    for (const c of lay.cells) {
      expect(c.x).toBeGreaterThanOrEqual(lay.left);
      expect(c.x + c.w).toBeLessThanOrEqual(390);
    }
    for (let i = 1; i < lay.cells.length; i++) {
      const a = lay.cells[i - 1];
      const b = lay.cells[i];
      if (a.row === b.row) {
        expect(a.x + a.w).toBeLessThanOrEqual(b.x + 1e-6);
      } else {
        expect(a.y + a.h).toBeLessThanOrEqual(b.y + 1e-6);
      }
    }
    expect(lay.rowLabelX).toBeLessThan(lay.left);
    // column labels do not touch: one row wide enough, or two staggered rows
    expect((lay.colLabelRows === 1 ? 1 : 2) * lay.cw).toBeGreaterThanOrEqual(36);
    expect(lay.height).toBeGreaterThanOrEqual(lay.top + 6 * lay.ch);
    const { el, player } = setup(390, 600);
    go(player, 'sirali-arama');
    expect(Number(el.querySelector(S + 'svg')!.getAttribute('width'))).toBeLessThanOrEqual(390);
    for (const r of el.querySelectorAll(S + 'rect.hm-base')) {
      expect(Number(r.getAttribute('x')) + Number(r.getAttribute('width'))).toBeLessThanOrEqual(390);
    }
  });
});
