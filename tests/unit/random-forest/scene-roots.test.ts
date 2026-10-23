// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { randomForestScenario } from '../../../src/concepts/random-forest/scenario';
import { mountRfScene } from '../../../src/concepts/random-forest/scene';
import { RF } from '../../../src/concepts/topluluk/data';

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

describe('roots scene', () => {
  it('step 1 bars sum to 250 roots', () => {
    const { el } = setup();
    expect(el.querySelector('.rf-stage')!.getAttribute('data-view')).toBe('roots');
    const bars = [...el.querySelectorAll('.rf-roots-host g.root-bar.bagging')];
    expect(bars).toHaveLength(8);
    expect(bars.reduce((s, b) => s + Number(b.getAttribute('data-count')), 0)).toBe(250);
    expect(el.querySelectorAll('.rf-roots-host g.root-bar.forest')).toHaveLength(0);
    expect(bars.map((b) => b.querySelector('text.bar-name')!.textContent)).toEqual(RF.names);
    expect(bars[6].querySelector('text.bar-value')!.textContent).toBe(String(RF.byMf[7].roots[6]));
  });

  it('step 2 node card draws two of eight chips', () => {
    const { el, player } = setup();
    player.goto(step('alt-kume'));
    const chips = [...el.querySelectorAll('.rf-roots-host g.node-chip')];
    expect(chips).toHaveLength(8);
    expect(chips.filter((c) => c.classList.contains('drawn'))).toHaveLength(2);
    const winner = chips.filter((c) => c.classList.contains('winner'));
    expect(winner).toHaveLength(1);
    expect(winner[0].classList.contains('drawn')).toBe(true);
    expect(winner[0].getAttribute('data-feature')).toBe('6');
    expect(el.querySelectorAll('.rf-roots-host g.root-bar.forest')).toHaveLength(8);
    expect(el.querySelector('.rf-roots-host text.node-note')!.textContent).toContain('örnek');
  });

  it('step 3 draws the two variance curves', () => {
    const { el, player } = setup();
    player.goto(step('varyans'));
    expect(el.querySelectorAll('.rf-roots-host path.lc-series')).toHaveLength(2);
    expect(el.querySelector('.formula')!.textContent).toContain('ρσ² + (1 − ρ)σ²/M');
  });

  it('step 4 sweep ends at max_features 8 with its rho', () => {
    const { el, player } = setup();
    player.goto(step('max-features'));
    player.setParam('maxFeatures', 8);
    const label = el.querySelector('.rf-roots-host text.lc-label')!.textContent!;
    expect(label).toContain('max_features = 8');
    expect(label).toContain(RF.byMf[7].rho.toFixed(3).replace('.', ','));
    expect(el.querySelectorAll('.rf-roots-host path.lc-series').length).toBeGreaterThanOrEqual(2);
  });

  it('step 4 x axis ticks are the integers 1 to 8', () => {
    const { el, player } = setup();
    player.goto(step('max-features'));
    const labels = [...el.querySelectorAll('.rf-roots-host g.axis.x g.tick text')].map((t) => t.textContent);
    expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
});
