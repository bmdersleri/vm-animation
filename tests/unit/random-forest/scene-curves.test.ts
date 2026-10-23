// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { randomForestScenario } from '../../../src/concepts/random-forest/scenario';
import { mountRfScene } from '../../../src/concepts/random-forest/scene';
import { OOB_CURVE, OOB_CV } from '../../../src/concepts/topluluk/data';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(randomForestScenario);
  const scene = mountRfScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const step = (id: string) => randomForestScenario.steps.findIndex((s) => s.id === id);
const host = (el: HTMLElement) => el.querySelector('.rf-curves-host')!;

describe('curve scene', () => {
  it('step 7 bars read 0,899 and 0,896', () => {
    const { el, player } = setup();
    player.goto(step('oob-cv'));
    expect(el.querySelector('.rf-stage')!.getAttribute('data-view')).toBe('curves');
    const bars = [...host(el).querySelectorAll('g.curve-bar')];
    expect(bars.map((b) => b.querySelector('text.bar-value')!.textContent)).toEqual(['0,899', '0,896']);
    expect(bars.map((b) => b.querySelector('text.bar-name')!.textContent)).toEqual(['OOB skoru', '5 katlı CV']);
    // the five CV folds sit on the CV bar as small dots
    expect(host(el).querySelectorAll('circle.fold-dot')).toHaveLength(OOB_CV.cv.length);
    const sentence = host(el).querySelector('text.time-note')!.textContent!;
    expect(sentence).toContain('0,27 s');
    expect(sentence).toContain('1,23 s');
    expect(host(el).querySelectorAll('path.lc-series')).toHaveLength(0);
  });

  it('step 8 curve starts at 0,798 with 10 trees', () => {
    const { el, player } = setup();
    player.goto(step('agac-sayisi'));
    player.setParam('nEstimators', 200);
    expect(host(el).querySelectorAll('path.lc-series')).toHaveLength(1);
    expect(host(el).querySelectorAll('g.curve-bar')).toHaveLength(0);
    const pin = host(el).querySelector('text.lc-pin-label')!.textContent!;
    expect(pin).toContain('10 ağaç');
    expect(pin).toContain('0,798');
    // the marker follows the tree count slider
    player.setParam('nEstimators', 100);
    const at = OOB_CURVE.find((p) => p.n === 100)!;
    expect(host(el).querySelector('text.lc-label')!.textContent).toBe(`100 ağaç · ${at.oob.toFixed(3).replace('.', ',')}`);
    // at 10 trees the marker is the pin: one label only
    player.setParam('nEstimators', 10);
    expect(host(el).querySelectorAll('text.lc-pin-label')).toHaveLength(0);
    expect(host(el).querySelector('text.lc-label')!.textContent).toContain('0,798');
  });
});
