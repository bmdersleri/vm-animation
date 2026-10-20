// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { nbScenario, type NbParams } from '../../../src/concepts/naive-bayes/scenario';
import { mountNbScene } from '../../../src/concepts/naive-bayes/scene';
import { BarLayer } from '../../../src/concepts/naive-bayes/scene-bar';
import { deriveNbView } from '../../../src/concepts/naive-bayes/view';

let cleanup: (() => void)[] = [];

beforeEach(() => {
  // jsdom has no canvas backend; make the "no 2D context" path explicit and quiet
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(
  mode: 'lab' | 'ders' = 'ders', size: [number, number] = [1280, 541], durationScale = 0,
): { el: HTMLElement; player: StepPlayer<NbParams> } {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(nbScenario);
  const scene = mountNbScene(el, player, mode, { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player };
}

const all = (el: Element, sel: string): Element[] => [...el.querySelectorAll(sel)];
const num = (e: Element, a: string): number => Number(e.getAttribute(a));
const shown = (e: Element): boolean => !e.closest('[hidden]') && !e.closest('[display="none"]');
const points = (e: Element): number => (e.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).length;
const lastTrail = (player: StepPlayer<NbParams>): number => {
  const v = deriveNbView(player.state.index, player.state.params);
  return v.trail[v.trail.length - 1]!;
};
const spamShare = (el: Element): number => {
  const s = num(el.querySelector('rect.bar-spam')!, 'width');
  const n = num(el.querySelector('rect.bar-normal')!, 'width');
  return s / (s + n);
};

describe('mountNbScene', () => {
  it('bar width follows the trail end', () => {
    const { el, player } = setup();
    for (const i of [4, 5, 6, 7]) {
      player.goto(i);
      expect(shown(el.querySelector('rect.bar-spam')!)).toBe(true);
      expect(spamShare(el)).toBeCloseTo(lastTrail(player), 3);
    }
    expect(el.querySelector('text.bar-pct')!.textContent).toContain('%96,4');
    player.goto(9); // α = 0: "rapor" sends P(spam) to 0
    expect(spamShare(el)).toBeCloseTo(0, 3);
    player.setParam('alpha', 1);
    expect(spamShare(el)).toBeCloseTo(lastTrail(player), 3);
    expect(el.querySelector('text.bar-pct')!.textContent).toContain('%81,6');
  });

  it('trail has words+1 dots', () => {
    const { el, player } = setup();
    for (const [i, n] of [[4, 1], [5, 2], [6, 3], [7, 4], [9, 5]] as const) {
      player.goto(i);
      expect(all(el, 'circle.trail-dot')).toHaveLength(n);
      expect(points(el.querySelector('polyline.trail')!)).toBe(n);
    }
    // the newest word's chip is marked
    player.goto(6);
    expect(all(el, 'g.chip').map((c) => c.textContent)).toEqual(['bedava', 'kazandınız']);
    expect(all(el, 'g.chip.now').map((c) => c.textContent)).toEqual(['kazandınız']);
  });

  it('null posterior draws the grey bar', () => {
    const { el, player } = setup();
    player.goto(5);
    expect(all(el, 'rect.bar-null').filter(shown)).toHaveLength(0);
    // a word neither class has seen, α = 0: both scores are zero
    player.setParam('words', ['yokboyle']);
    expect(all(el, 'rect.bar-null').filter(shown)).toHaveLength(1);
    expect(shown(el.querySelector('rect.bar-spam')!)).toBe(false);
    expect(shown(el.querySelector('rect.bar-normal')!)).toBe(false);
    expect(el.textContent).not.toContain('NaN');
    expect(all(el, 'circle.trail-dot')).toHaveLength(2);
    // and back: a real posterior hides the grey bar
    player.setParam('words', ['bedava']);
    expect(all(el, 'rect.bar-null').filter(shown)).toHaveLength(0);
    expect(spamShare(el)).toBeCloseTo(lastTrail(player), 3);
  });

  it('icon counts text shows 9 and 99 at step 2', () => {
    const { el, player } = setup();
    const counts = (): string[] => all(el, 'text.icon-count').filter(shown).map((t) => t.textContent ?? '');
    expect(counts()).toEqual(['10 hasta', '990 sağlıklı']);
    player.goto(2);
    const c = counts();
    expect(c.some((t) => /^9 hasta/.test(t))).toBe(true);
    expect(c.some((t) => /^99 sağlıklı/.test(t))).toBe(true);
    expect(c).toHaveLength(4);
    player.goto(3); // prior 10 %: 90 and 90
    expect(counts().filter((t) => /^90 /.test(t))).toHaveLength(2);
  });

  it('ghost appears only at step 8', () => {
    const { el, player } = setup();
    for (let i = 0; i < nbScenario.steps.length; i++) {
      player.goto(i);
      expect(all(el, 'polyline.ghost').filter(shown), `step ${i}`).toHaveLength(i === 8 ? 1 : 0);
    }
  });

  it('rapid step changes end in the final state', () => {
    const { el, player } = setup();
    player.goto(8);
    player.goto(4);
    expect(all(el, 'circle.trail-dot')).toHaveLength(1);
    expect(all(el, 'polyline.ghost')).toHaveLength(0);
    expect(spamShare(el)).toBeCloseTo(0.4, 3);
  });

  it('with real transitions, rapid changes still converge to the final state', async () => {
    const { el, player } = setup('ders', [1280, 541], 0.2);
    player.goto(7);
    await new Promise((r) => setTimeout(r, 30));
    player.goto(8);
    await new Promise((r) => setTimeout(r, 30));
    player.goto(4);
    await new Promise((r) => setTimeout(r, 400));
    expect(all(el, 'circle.trail-dot')).toHaveLength(1);
    expect(all(el, 'polyline.ghost')).toHaveLength(0);
    expect(spamShare(el)).toBeCloseTo(0.4, 2);
  });

  it('shows one part at a time', () => {
    const { el, player } = setup();
    const part = (cls: string): boolean => !el.querySelector<HTMLElement>(cls)!.hidden;
    expect([part('.nb-icons'), part('.nb-bar'), part('.nb-gauss')]).toEqual([true, false, false]);
    player.goto(5);
    expect([part('.nb-icons'), part('.nb-bar'), part('.nb-gauss')]).toEqual([false, true, false]);
    player.goto(11);
    expect([part('.nb-icons'), part('.nb-bar'), part('.nb-gauss')]).toEqual([false, false, true]);
    expect(el.querySelector('.nb-gauss svg.gauss-plot')).not.toBeNull();
  });

  it('icon canvas reports a cell of at least 12 px in Ders', () => {
    const { el } = setup();
    const canvas = el.querySelector<HTMLCanvasElement>('canvas.icons')!;
    const cell = Number(canvas.dataset.cellPx);
    expect(cell).toBeGreaterThanOrEqual(12);
    // the canvas covers exactly the 50 × 20 grid
    expect(parseFloat(canvas.style.width)).toBeCloseTo(50 * cell, -1);
    expect(parseFloat(canvas.style.height)).toBeCloseTo(20 * cell, -1);
  });

  it('negatives fade to 0.15 at reveal 2', () => {
    const { el, player } = setup();
    const neg = (): string => el.querySelector<HTMLCanvasElement>('canvas.icons-neg')!.style.opacity;
    player.goto(1);
    expect(neg()).toBe('1');
    player.goto(2);
    expect(neg()).toBe('0.15');
    player.goto(1);
    expect(neg()).toBe('1');
  });

  it('formula strip: reveal 2 shows two lines, part 2 one', () => {
    const { el, player } = setup();
    // terms are trimmed; the flex column gap stands for the space between them
    const lines = (): string[] => all(el, 'p.formula .line')
      .map((l) => all(l, '.term').map((t) => t.textContent).join(' ').replace(/ {2,}/g, ' '));
    expect(lines()).toEqual(['P(hasta) = 10/1000']);
    player.goto(2);
    expect(lines()).toHaveLength(2);
    expect(lines()[0]).toBe('9 / (9 + 99) = %8,3');
    player.goto(6);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('yeni öncül');
  });
});

describe('BarLayer', () => {
  it('part 3 labels the classes Kaldı / Ayrıldı and draws no trail', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const bar = new BarLayer(host);
    bar.resize(800, 200, 'ders');
    bar.update(deriveNbView(11, nbScenario.defaults), 0);
    const labels = all(host, 'text.bar-class').map((t) => t.textContent ?? '');
    expect(labels.some((t) => t.includes('Ayrıldı'))).toBe(true);
    expect(labels.some((t) => t.includes('Kaldı'))).toBe(true);
    expect(labels.some((t) => /spam|normal/i.test(t))).toBe(false);
    expect(all(host, 'circle.trail-dot')).toHaveLength(0);
    expect(all(host, 'polyline.trail').filter(shown)).toHaveLength(0);
    expect(all(host, 'g.chip')).toHaveLength(0);
    expect(spamShare(host)).toBeCloseTo(deriveNbView(11, nbScenario.defaults).bar!.spam!, 3);
    bar.destroy();
  });
});
