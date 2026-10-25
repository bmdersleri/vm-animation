import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { crispDmScenario as sc, type CrispParams } from '../../../src/concepts/crisp-dm/scenario';
import { mountCrispScene } from '../../../src/concepts/crisp-dm/scene';
import { mountCrispParams } from '../../../src/concepts/crisp-dm/controls';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** Mounts the scene (and the Lab controls) in jsdom with no animation; `w` x `h` is the size the shell would give it. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders') {
  const host = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(host, el);
  const player = new StepPlayer(sc);
  mountCrispParams(host, player);
  const scene = mountCrispScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

/** Goes to the step with this id and lets a sweep finish (the scan parameter jumps to its end). */
export function go(player: StepPlayer<CrispParams>, id: string, finish = true): void {
  player.goto(stepIndex(sc, id));
  if (finish && sc.steps[stepIndex(sc, id)].sweep) {
    player.setParams({ scan: Number.POSITIVE_INFINITY });
  }
}

export const texts = (root: ParentNode, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
export const num = (e: Element, a: string): number => Number(e.getAttribute(a));
