import { afterEach } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { duyguAnaliziScenario as sc, type SentimentParams } from '../../../src/concepts/duygu-analizi/scenario';
import { mountSentimentScene } from '../../../src/concepts/duygu-analizi/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** Mounts the scene in jsdom with no animation; `w` x `h` is the size the shell would give it. */
export function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountSentimentScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

/** Goes to the step with this id. */
export const go = (player: StepPlayer<SentimentParams>, id: string): void => player.goto(stepIndex(sc, id));

export const texts = (root: Element, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
export const num = (e: Element, a: string): number => Number(e.getAttribute(a));
