// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { baggingScenario } from '../../../src/concepts/bagging/scenario';
import { mountBaggingScene } from '../../../src/concepts/bagging/scene';
import { oobChance } from '../../../src/concepts/topluluk/math';

const clean: (() => void)[] = [];
afterEach(() => {
  vi.useRealTimers();
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup() {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(baggingScenario);
  const scene = mountBaggingScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(1280, 540);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player, scene };
}

const step = (id: string) => baggingScenario.steps.findIndex((s) => s.id === id);

describe('bag scene', () => {
  it('step 2 sweep lands one card per slot and keeps the bag full', () => {
    vi.useFakeTimers();
    const { el, player } = setup();
    player.goto(step('cekilis'));
    expect(el.querySelectorAll('g.bag-slot.filled')).toHaveLength(1);
    expect(el.querySelectorAll('g.bag-card')).toHaveLength(10);
    vi.advanceTimersByTime(700 * 3);
    const filled = [...el.querySelectorAll('g.bag-slot.filled g.slot-card')];
    expect(filled).toHaveLength(4);
    expect(filled.map((g) => g.getAttribute('data-id'))).toEqual(['0', '7', '6', '4']);
    // every slot has at most one card, and the bag still holds all ten
    expect(el.querySelectorAll('g.bag-slot g.slot-card')).toHaveLength(4);
    expect(el.querySelectorAll('g.bag-card')).toHaveLength(10);
    expect(el.querySelector('g.bag-card.active')!.getAttribute('data-id')).toBe('4');
    vi.advanceTimersByTime(700 * 10);
    expect(el.querySelectorAll('g.bag-slot g.slot-card')).toHaveLength(10);
    expect(el.querySelectorAll('g.bag-card')).toHaveLength(10);
    expect(el.querySelector('.formula')!.textContent).toContain('10 / 10 çekiliş');
  });

  it('step 3 badges read ×3 ×2 ×2 and four cards are oob', () => {
    const { el, player } = setup();
    player.goto(step('oob'));
    const badges = [...el.querySelectorAll('g.bag-badge text')].map((t) => t.textContent);
    expect(badges).toEqual(['×3', '×2', '×2']);
    const oob = [...el.querySelectorAll('g.bag-card.oob')].map((g) => g.getAttribute('data-id'));
    expect(oob).toEqual(['1', '3', '5', '9']);
    expect(el.querySelectorAll('text.bag-oob-label')).toHaveLength(4);
    expect(el.querySelector('.formula')!.textContent).toBe('OOB = 4 / 10 = %40,0');
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('bag');
  });

  it('step 4 draws the curve and the 1/e line', () => {
    const { el, player } = setup();
    player.goto(step('yuzde'));
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('bag');
    expect(el.querySelector('svg')!.getAttribute('data-view')).toBe('curve');
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(1);
    expect(el.querySelectorAll('line.lc-ref')).toHaveLength(1);
    expect(el.querySelector('text.lc-ref-label')!.textContent).toContain('0,368');
    expect(el.querySelector('text.lc-label')!.textContent).toContain(String(10));
    expect(el.querySelector('text.lc-label')!.textContent).toContain(oobChance(10).toFixed(3).replace('.', ','));
    expect((el.querySelector('g.bag-layer') as SVGElement).getAttribute('display')).toBe('none');
  });

  it('later steps leave the bag host to the region and chart areas', () => {
    const { el, player } = setup();
    player.goto(step('uc-agac'));
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('regions');
    expect((el.querySelector('.bagging-bag-host') as HTMLElement).hidden).toBe(true);
    player.goto(step('deney'));
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('charts');
  });
});
