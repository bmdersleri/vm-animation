// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { baggingScenario } from '../../../src/concepts/bagging/scenario';
import { mountBaggingScene } from '../../../src/concepts/bagging/scene';
import { EXPERIMENT } from '../../../src/concepts/topluluk/data';
import { majorityAccuracy, meanStd } from '../../../src/concepts/topluluk/math';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(baggingScenario);
  const scene = mountBaggingScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const step = (id: string) => baggingScenario.steps.findIndex((s) => s.id === id);
const fmt = (x: number) => x.toFixed(3).replace('.', ',');

describe('chart scene', () => {
  it('step 8 majority curve passes 0.896 at m 3', () => {
    const { el, player } = setup();
    player.goto(step('cogunluk'));
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('charts');
    const curve = el.querySelector('.bagging-charts-host path.lc-series.majority-curve')!;
    expect(curve.getAttribute('d')!.split('L')).toHaveLength(26);
    const label = el.querySelector('.bagging-charts-host text.lc-label')!.textContent!;
    expect(label).toContain(fmt(majorityAccuracy(0.8, 3)));
    expect(label).toContain('0,896');
    expect(el.querySelectorAll('.bagging-charts-host line.lc-ref')).toHaveLength(1);
    expect(el.querySelector('.formula')!.textContent).toContain('3 · 0,2² · 0,8 + 0,2³ = 0,104 → doğruluk 0,896');
  });

  it('step 9 strips carry ten dots each and the book means', () => {
    const { el, player } = setup();
    player.goto(step('deney'));
    const strips = [...el.querySelectorAll('.bagging-charts-host g.exp-strip')];
    expect(strips).toHaveLength(2);
    strips.forEach((s) => expect(s.querySelectorAll('circle.exp-dot')).toHaveLength(10));
    const labels = strips.map((s) => s.querySelector('text.exp-mean')!.textContent!);
    const a = meanStd(EXPERIMENT.tree);
    const b = meanStd(EXPERIMENT.bagging);
    expect(labels[0]).toBe(`ortalama ${fmt(a.mean)} · std ${fmt(a.std)}`);
    expect(labels[1]).toBe(`ortalama ${fmt(b.mean)} · std ${fmt(b.std)}`);
    expect(labels[0]).toContain('0,749');
    expect(labels[1]).toContain('0,835');
    expect(strips.map((s) => s.querySelectorAll('line.exp-mean-line').length)).toEqual([1, 1]);
  });

  it('step 10 links point to random-forest and karar-agaci', () => {
    const { el, player } = setup();
    player.goto(step('sinir'));
    const links = [...el.querySelectorAll('.bagging-charts-host a.scene-link')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['../random-forest/', '../karar-agaci/']);
    expect(links[0].textContent).toContain('Random Forest');
    expect(el.querySelector('.bagging-charts-host text.limit-question')!.textContent).toContain('uzaklaştırırız');
  });
});
