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

  it('step 10 lays out without overlap at both widths', () => {
    for (const [w, h] of [[1280, 540], [390, 640], [390, 420]] as const) {
      const { el } = setup(w, h);
      const host = el.querySelector('.gb-compare-host')!;
      const svgH = Number(host.querySelector('svg')!.getAttribute('height'));
      const rect = (r: Element) => ({
        l: Number(r.getAttribute('x')),
        t: Number(r.getAttribute('y')),
        r: Number(r.getAttribute('x')) + Number(r.getAttribute('width')),
        b: Number(r.getAttribute('y')) + Number(r.getAttribute('height')),
      });
      const boxes = [...host.querySelectorAll('rect.cmp-box')].map(rect);
      expect(Math.max(...boxes.map((b) => b.r))).toBeLessThanOrEqual(w);
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const apart = a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
          expect(apart, `${w}x${h} boxes ${i}`).toBe(true);
        }),
      );
      const y = (t: Element) => Number(t.getAttribute('y'));
      const lowestBox = Math.max(...boxes.map((b) => b.b));
      const rows = [...host.querySelectorAll('g.cmp-row text')].map(y);
      const heads = [...host.querySelectorAll('text.cmp-head')].map(y);
      // schemes above the table, the table above the links, everything inside the svg
      expect(Math.min(...heads, ...rows)).toBeGreaterThan(lowestBox);
      const links = [...host.querySelectorAll('a.scene-link text')].map(y);
      expect(Math.min(...links)).toBeGreaterThan(Math.max(...rows));
      expect(Math.max(...links)).toBeLessThanOrEqual(svgH);
    }
  });

  it('step 10 keeps the label column clear of the first value column', () => {
    const { el } = setup(1280, 540);
    const labelX = Number(el.querySelector('text.cmp-label')!.getAttribute('x'));
    const cellX = Number(el.querySelector('text.cmp-cell')!.getAttribute('x'));
    // jsdom estimate of the longest label at the axis size (16 px, 0,62 em per character)
    expect(cellX - labelX).toBeGreaterThanOrEqual('Tipik zayıf öğrenici derinliği'.length * 16 * 0.62);
  });
});
