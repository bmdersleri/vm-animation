// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { bestIndex } from '../../../src/concepts/boosting/boost';
import { REG } from '../../../src/concepts/boosting/data';
import { gradyanArtirmaScenario as sc, runFor } from '../../../src/concepts/gradyan-artirma/scenario';
import { mountGbScene } from '../../../src/concepts/gradyan-artirma/scene';
import { formatNumber as f } from '../../../src/core/plot/format';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540, mode: 'ders' | 'lab' = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountGbScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
// the panels host keeps its own (hidden) drawing, so queries stay inside the error host
const HOST = '.gb-error-host ';
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(HOST + sel).length;
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(HOST + sel)].map((t) => t.textContent);

describe('error scene', () => {
  it('step 7 sweep ends at 200 trees with the dip pin', () => {
    const { el, player } = setup();
    go(player, 'durma');
    expect(el.querySelector('.gb-stage')!.getAttribute('data-view')).toBe('error');
    expect(count(el, 'path.lc-series.train')).toBe(1);
    expect(count(el, 'path.lc-series.val')).toBe(1);
    expect(el.querySelector(HOST + 'path.lc-series.val')!.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(el.querySelector(HOST + 'path.lc-series.train')!.getAttribute('stroke-dasharray')).toBeNull();
    const run = runFor(0.3, 2);
    expect(bestIndex(run.valMse)).toBe(34);
    expect(texts(el, 'text.lc-pin-label')).toEqual([`34. ağaç · ${f(run.valMse[33], 4)}`]);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['34. ağaç · 0,0139']);
    // the sweep stops on the last tree: the marker sits at M = 200
    player.setParam('trees', 200);
    expect(texts(el, 'text.lc-label')).toEqual(['M = 200']);
    expect(el.querySelector('.formula')!.textContent).toContain('M = 200');
    expect(count(el, 'text.no-dip')).toBe(0);
    // integer tick labels on the tree axis, decimal tick labels on the log error axis
    expect(texts(el, 'g.axis.x text')).toEqual(['1', '50', '100', '150', '200']);
    expect(texts(el, 'g.axis.y text')).toContain('0,0001');
  });

  it('step 8 draws three val curves with their dips', () => {
    const { el, player } = setup();
    go(player, 'ogrenme-orani');
    expect(count(el, 'path.lc-series.val')).toBe(3);
    expect(count(el, 'path.lc-series.train')).toBe(0);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['17. ağaç · 0,0158', '34. ağaç · 0,0139', '184. ağaç · 0,0126']);
    expect(texts(el, 'text.end-label')).toEqual(['ν = 1,0', 'ν = 0,3', 'ν = 0,05']);
    // Ders: no moving marker, no emphasis
    expect(count(el, 'circle.lc-marker')).toBe(0);
    expect(count(el, 'path.lc-series.emph')).toBe(0);
  });

  it('step 8 in the Lab emphasises the chosen nu and mutes the rest', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'ogrenme-orani');
    expect(count(el, 'path.lc-series.emph')).toBe(1);
    expect(count(el, 'path.lc-series.muted')).toBe(2);
    expect(count(el, 'circle.lc-marker')).toBe(1);
    // a nu outside the three adds a fourth curve
    player.setParam('nu', 0.1);
    expect(count(el, 'path.lc-series.val')).toBe(4);
    expect(el.querySelector(HOST + 'path.lc-series.emph')!.classList.contains('nu-3')).toBe(true);
  });

  it('step 9 draws two F lines and hollow val points', () => {
    const { el, player } = setup();
    go(player, 'ezber');
    expect(count(el, 'path.f-line')).toBe(2);
    expect(count(el, 'path.f-line.soft')).toBe(1);
    expect(count(el, 'path.f-line.zig')).toBe(1);
    expect(count(el, 'circle.pt-val')).toBe(REG.val.x.length);
    expect(count(el, 'circle.pt')).toBe(REG.train.x.length);
    expect(texts(el, 'text.leg-label')).toEqual(['34 ağaç (dip)', '200 ağaç', 'doğrulama']);
    // the small error chart replaces the lower panel
    expect(count(el, 'path.lc-series')).toBe(2);
    expect(count(el, 'line.zero-line')).toBe(0);
    // the long F has more pieces than the soft one
    const pieces = (cls: string) => el.querySelector(`${HOST}path.f-line.${cls}`)!.getAttribute('d')!.match(/M|L/g)!.length;
    expect(pieces('zig')).toBeGreaterThan(pieces('soft'));
  });

  it('a curve without a dip shows the no-dip text', () => {
    const { el, player } = setup();
    go(player, 'durma');
    expect(count(el, 'text.no-dip')).toBe(0);
    // nu = 0,01 at depth 2: the validation error is still falling at tree 200
    player.setParam('nu', 0.01);
    const run = runFor(0.01, 2);
    expect(bestIndex(run.valMse)).toBe(200);
    expect(texts(el, 'text.no-dip')).toEqual(['Henüz dip yok: daha çok ağaç dene']);
    expect(texts(el, 'text.lc-pin-label')).toEqual([`200. ağaç · ${f(run.valMse[199], 4)}`]);
    player.setParam('nu', 0.3);
    expect(count(el, 'text.no-dip')).toBe(0);
  });

  it('draws finite numbers at both widths', () => {
    for (const w of [1280, 390]) {
      const { el, player } = setup(w, w === 390 ? 640 : 540);
      for (const id of ['durma', 'ogrenme-orani', 'ezber']) {
        go(player, id);
        expect(el.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
});
