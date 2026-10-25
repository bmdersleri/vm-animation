import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { modelKaymasiScenario as sc, SCAN_DONE, type KaymaParams } from '../../../src/concepts/model-kaymasi/scenario';
import { mountKaymaScene } from '../../../src/concepts/model-kaymasi/scene';
import { mountKaymaParams } from '../../../src/concepts/model-kaymasi/controls';

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
  mountKaymaParams(host, player);
  const scene = mountKaymaScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player, scene };
}

/** Goes to the step with this id; a sweep finishes unless `finish` is false (its parameter jumps to the end). */
export function go(player: StepPlayer<KaymaParams>, id: string, finish = true): void {
  const step = sc.steps[stepIndex(sc, id)];
  player.goto(stepIndex(sc, id));
  if (finish && step.sweep) {
    player.setParams({ [step.sweep.key]: SCAN_DONE });
  }
}

export const texts = (root: ParentNode, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
export const num = (e: Element, a: string): number => Number(e.getAttribute(a));
/** Text with all white space removed, for labels the scene wraps into several lines. */
export const flat = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, '');
