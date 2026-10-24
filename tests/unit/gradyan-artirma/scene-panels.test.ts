// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { BOOK, REG } from '../../../src/concepts/boosting/data';
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
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(sel).length;

describe('panel scene', () => {
  it('step 1 draws 80 training points', () => {
    const { el } = setup();
    expect(el.querySelector('.gb-stage')!.getAttribute('data-view')).toBe('panels');
    expect(count(el, 'circle.pt')).toBe(REG.train.x.length);
    expect(count(el, 'circle.pt')).toBe(80);
    expect(count(el, 'path.f-line')).toBe(0);
    expect(count(el, 'line.res-line')).toBe(0);
    expect(count(el, 'circle.pt-val')).toBe(0);
    expect(el.querySelector('path.sin-ref')!.getAttribute('d')).toMatch(/^M/);
  });

  it('step 3 draws 80 residual lines', () => {
    const { el, player } = setup();
    go(player, 'artik');
    expect(count(el, 'line.res-line')).toBe(80);
    expect(count(el, 'circle.res-dot')).toBe(80);
    expect(count(el, 'line.zero-line')).toBe(1);
    expect(count(el, 'path.f-line')).toBe(1);
    expect(count(el, 'path.h-line')).toBe(0);
  });

  it('step 4 labels three thresholds', () => {
    const { el, player } = setup();
    go(player, 'ilk-agac');
    const labels = [...el.querySelectorAll('text.thr-label')].map((t) => t.textContent);
    expect(labels).toEqual(['x ≤ 0,616', 'x ≤ 2,651', 'x ≤ 6,372']);
    expect(count(el, 'line.thr-line')).toBe(3);
    expect(count(el, 'path.h-line')).toBe(1);
    // one path with a vertical jump at each of the three thresholds
    expect(el.querySelector('path.h-line')!.getAttribute('d')!.match(/M/g)).toHaveLength(1);
    expect(el.querySelector('.formula')!.textContent).toContain('sigAgac.fit(girisDegerleri, artikHata)');
  });

  it("step 5 strip shows the book's hand example", () => {
    const { el, player } = setup();
    go(player, 'kucuk-adim');
    const text = el.querySelector('.formula')!.textContent!;
    expect(text).toContain('[2 + 0,1 · 2; 4 + 0,1 · 0] = [2,2; 4]');
    expect(text).toContain('F₁ = F₀ + 0,3 · h₁');
    expect(text).toContain('0,2952');
    expect(count(el, 'path.f-prev')).toBe(1);
  });

  it('step 6 sweep fills five table rows', () => {
    const { el, player } = setup();
    go(player, 'tekrar');
    // the sweep plays m = 2 first; rows beyond m stay empty
    expect(count(el, 'g.book-row')).toBe(5);
    expect(count(el, 'g.book-row.filled')).toBeGreaterThanOrEqual(2);
    player.setParam('m', 5);
    const rows = [...el.querySelectorAll('g.book-row.filled text')].map((t) => t.textContent);
    expect(rows).toEqual(BOOK.mse.map((v, i) => `Adım ${i + 1}: ${v.toFixed(4).replace('.', ',')}`));
  });

  it('panels fit 390 px without overlap', () => {
    const { el, player } = setup(390, 640);
    go(player, 'ilk-agac');
    const frames = [...el.querySelectorAll('.gb-panels-host rect.frame')].map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
    }));
    expect(frames).toHaveLength(2);
    const [top, bot] = frames;
    expect(top.y + top.h).toBeLessThan(bot.y);
    for (const fr of frames) {
      expect(fr.x).toBeGreaterThan(0);
      expect(fr.x + fr.w).toBeLessThanOrEqual(390);
    }
    // narrow screens alternate the threshold labels between two rows
    const ys = [...el.querySelectorAll('text.thr-label')].map((t) => t.getAttribute('y'));
    expect(new Set(ys).size).toBe(2);
    go(player, 'tekrar');
    const rowY = [...el.querySelectorAll('g.book-row text')].map((t) => Number(t.getAttribute('y')));
    expect(Math.max(...rowY)).toBeLessThanOrEqual(640);
    expect(Math.min(...rowY)).toBeGreaterThan(bot.y + bot.h);
  });

  it('steps 7 to 10 keep a reserved view', () => {
    const { el, player } = setup();
    go(player, 'durma');
    expect(el.querySelector('.gb-stage')!.getAttribute('data-view')).toBe('error');
    go(player, 'bagging-karsi');
    expect(el.querySelector('.gb-stage')!.getAttribute('data-view')).toBe('compare');
  });
});
