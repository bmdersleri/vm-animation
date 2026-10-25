import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { limeYerelScenario as sc, type LimeParams } from '../../../src/concepts/lime-yerel/scenario';
import { mountLimeScene } from '../../../src/concepts/lime-yerel/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** Mounts the scene in jsdom with no animation; `w` x `h` is the size the shell would give it. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLimeScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

/** Goes to the step with this id and lets a sweep finish (the scan parameter jumps to its end). */
export function go(player: StepPlayer<LimeParams>, id: string, finish = true): void {
  player.goto(stepIndex(sc, id));
  if (finish && sc.steps[stepIndex(sc, id)].sweep) {
    player.setParams({ scan: Number.POSITIVE_INFINITY });
  }
}

export const texts = (root: Element, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
export const num = (e: Element, a: string): number => Number(e.getAttribute(a));
