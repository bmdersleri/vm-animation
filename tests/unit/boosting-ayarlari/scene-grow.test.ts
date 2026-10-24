// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { boostingAyarlariScenario as sc, leafTree, levelTree } from '../../../src/concepts/boosting-ayarlari/scenario';
import { treeDepth } from '../../../src/concepts/boosting/regtree';
import { mountTuneScene } from '../../../src/concepts/boosting-ayarlari/scene';
import { layoutTree } from '../../../src/concepts/boosting-ayarlari/scene-grow';
import { treeNodes } from '../../../src/concepts/boosting-ayarlari/view';

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
const G = '.tune-grow-host ';
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(G + sel)].map((t) => t.textContent);
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(G + sel).length;

describe('growth scene', () => {
  it('step 6 tree has three internal nodes on two levels', () => {
    const { el, player } = setup();
    go(player, 'seviye');
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('grow');
    expect(count(el, 'g.tg-node.internal')).toBe(3);
    expect(count(el, 'g.tg-node.leaf')).toBe(4);
    expect(texts(el, 'g.tg-node.internal text.tg-label').sort()).toEqual(['x ≤ 0,616', 'x ≤ 2,651', 'x ≤ 6,372']);
    // the second level opens as a whole: both its nodes carry the number 2
    expect(texts(el, 'g.tg-order text')).toEqual(['1', '2', '2']);
    expect(texts(el, 'g.tg-node.leaf text.tg-label').sort()).toEqual(['0,041', '0,238', '0,618', '−0,671']);
    expect(count(el, 'circle.tg-pt')).toBe(80);
    expect(count(el, 'line.tg-cut')).toBe(3);
    expect(texts(el, 'text.tg-head')).toEqual(['seviye-öncelikli · derinlik 2 · 4 yaprak', 'hata 0,162']);
  });

  it('step 7 tree is three deep and labels three gains', () => {
    const { el, player } = setup();
    go(player, 'yaprak');
    expect(count(el, 'g.tg-node.leaf')).toBe(4);
    const depths = [...el.querySelectorAll(G + 'g.tg-node')].map((n) => Number(n.getAttribute('data-depth')));
    expect(Math.max(...depths)).toBe(3);
    expect(texts(el, 'g.tg-order text')).toEqual(['1', '2', '3']);
    const gains = texts(el, 'text.tg-split').join('|');
    expect(gains).toContain('kazanç 0,1131');
    expect(gains).toContain('kazanç 0,1393');
    expect(gains).toContain('kazanç 0,0680');
    expect(count(el, 'text.tg-split')).toBe(3);
  });

  it('step 7 error is below step 6', () => {
    const { el, player } = setup();
    go(player, 'seviye');
    expect(texts(el, 'text.tg-head')[1]).toBe('hata 0,162');
    go(player, 'yaprak');
    expect(texts(el, 'text.tg-head')[1]).toBe('hata 0,113');
  });

  it('step 8 sweep ends at 64 leaves with its depth', () => {
    const { el, player } = setup();
    go(player, 'yaprak-siniri');
    player.setParam('leaves', 64);
    expect(el.querySelector('.tune-stage')!.getAttribute('data-view')).toBe('curves');
    const pins = [...el.querySelectorAll('.tune-curves-host text.cv-vlabel')].map((t) => t.textContent!);
    // the depth comes from the tree itself (12 on this data), not from a constant
    const depth = treeDepth(leafTree(64));
    expect(depth).toBeGreaterThan(5);
    expect(pins).toContain(`64 yaprak · derinlik ${depth}`);
    expect(el.querySelector('.formula')!.textContent).toContain(`64 yaprak · derinlik ${depth}`);
    expect(el.querySelector('.formula')!.textContent).toContain('num_leaves < 2^max_depth: max_depth=5 → 32');
    const ticks = [...el.querySelectorAll('.tune-curves-host g.axis.x text')].map((t) => t.textContent);
    expect(ticks[ticks.length - 1]).toBe('64');
    expect(el.querySelectorAll('.tune-curves-host path.lc-series')).toHaveLength(2);
    expect(el.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('reduced motion lands the leaf sweep on 64 at once', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { el, player } = setup();
    go(player, 'yaprak-siniri');
    expect(player.state.params.leaves).toBe(64);
    const pins = [...el.querySelectorAll('.tune-curves-host text.cv-vlabel')].map((t) => t.textContent!);
    expect(pins.some((t) => /64 yaprak/.test(t))).toBe(true);
  });

  it('tree diagram fits 390 px', () => {
    for (const nodes of [treeNodes(levelTree(2), 'level'), treeNodes(leafTree(8), 'leaf'), treeNodes(leafTree(4), 'leaf')]) {
      const lay = layoutTree(nodes, 390, { rowH: 56, boxH: 40, maxBoxW: 110 });
      expect(lay.boxes).toHaveLength(nodes.length);
      for (const b of lay.boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(390);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.h).toBeLessThanOrEqual(lay.height);
      }
      for (let i = 0; i < lay.boxes.length; i++) {
        for (let j = i + 1; j < lay.boxes.length; j++) {
          const a = lay.boxes[i];
          const b = lay.boxes[j];
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it('the DOM tree of a deep level-wise tree stays inside 390 px', () => {
    const { el, player } = setup(390, 700);
    go(player, 'seviye');
    player.setParam('depth', 3);
    const boxes = [...el.querySelectorAll(G + 'rect.tg-box')].map((r) => ({
      x: Number(r.getAttribute('x')),
      w: Number(r.getAttribute('width')),
    }));
    expect(boxes.length).toBeGreaterThanOrEqual(15);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(390);
    }
    expect(Number(el.querySelector(G + 'svg')!.getAttribute('width'))).toBeLessThanOrEqual(390);
  });
});
