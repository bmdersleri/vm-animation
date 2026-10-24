// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { gradyanArtirmaScenario as sc } from '../../../src/concepts/gradyan-artirma/scenario';
import { mountGbScene } from '../../../src/concepts/gradyan-artirma/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountGbScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  player.goto(stepIndex(sc, 'bagging-karsi'));
  return { el, player };
}

describe('compare scene', () => {
  it('step 10 draws both rows and four table rows', () => {
    const { el } = setup();
    expect(el.querySelector('.gb-stage')!.getAttribute('data-view')).toBe('compare');
    const rows = [...el.querySelectorAll('g.cmp-scheme')].map((g) => g.getAttribute('data-row'));
    expect(rows).toEqual(['bagging', 'boosting']);
    // bagging: parallel deep trees into one average; boosting: a chain of shallow trees
    const bag = el.querySelector('g.cmp-scheme[data-row=bagging]')!;
    const boo = el.querySelector('g.cmp-scheme[data-row=boosting]')!;
    const treeH = (g: Element) => [...g.querySelectorAll('rect.cmp-box.tree')].map((r) => Number(r.getAttribute('height')));
    expect(treeH(bag)).toHaveLength(4);
    expect(treeH(boo)).toHaveLength(4);
    expect(Math.min(...treeH(bag))).toBeGreaterThan(Math.max(...treeH(boo)));
    expect(bag.querySelectorAll('.cmp-arrow')).toHaveLength(4);
    expect(boo.querySelectorAll('.cmp-arrow')).toHaveLength(4);
    expect(el.querySelectorAll('g.cmp-row')).toHaveLength(4);
    const labels = [...el.querySelectorAll('g.cmp-row text.cmp-label')].map((t) => t.textContent);
    expect(labels).toEqual(['Ağaç kurma sırası', 'Odaklandığı hata', 'Tipik zayıf öğrenici derinliği', 'Aşırı öğrenme eğilimi']);
    expect(el.querySelectorAll('g.cmp-row')[1].textContent).toContain('Yanlılık');
    expect(el.innerHTML).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('step 10 links point to boosting-ayarlari and bagging', () => {
    const { el } = setup();
    const links = [...el.querySelectorAll('a.scene-link')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['../boosting-ayarlari/', '../bagging/']);
    for (const a of el.querySelectorAll('a.scene-link')) expect(a.getAttribute('aria-label')).toBeTruthy();
  });

  it('step 10 fits a 390 px screen', () => {
    const { el } = setup(390, 640);
    const ys = [...el.querySelectorAll('text')].map((t) => Number(t.getAttribute('y'))).filter((y) => Number.isFinite(y));
    expect(Math.max(...ys)).toBeLessThanOrEqual(640);
    const right = [...el.querySelectorAll('rect.cmp-box')].map((r) => Number(r.getAttribute('x')) + Number(r.getAttribute('width')));
    expect(Math.max(...right)).toBeLessThanOrEqual(390);
  });
});
