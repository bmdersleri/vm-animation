import { afterEach, vi } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { limeYerelScenario as sc, type LimeParams } from '../../../src/concepts/lime-yerel/scenario';
import { mountLimeScene } from '../../../src/concepts/lime-yerel/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Mounts the scene in jsdom with no animation; `w` x `h` is the size the shell would give it. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders', opts: { durationScale?: number; at?: string } = {}) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  if (opts.at) {
    player.goto(stepIndex(sc, opts.at));
  }
  const scene = mountLimeScene(el, player, mode, { durationScale: opts.durationScale ?? 0 });
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

/** Font sizes (px) the theme gives the probe classes: narrow (390 px) and wide Ders (1280 px) stages. */
const FONT_PX = {
  narrow: { tick: 13, 'axis-title': 14, prediction: 22, 'pattern-cell': 12, 'rule-name': 13 },
  wide: { tick: 18, 'axis-title': 19, prediction: 33, 'pattern-cell': 15, 'rule-name': 18 },
} as const;

/** jsdom has no theme CSS: make the text probes report the real token sizes of a narrow or a wide stage. */
export function themeFonts(kind: keyof typeof FONT_PX): void {
  const table: Record<string, number> = FONT_PX[kind];
  vi.spyOn(window, 'getComputedStyle').mockImplementation((e: Element) => {
    const cls = (e.getAttribute('class') ?? '').split(/\s+/);
    const hit = cls.find((c) => c in table);
    return { fontSize: hit ? `${table[hit]}px` : '16px' } as CSSStyleDeclaration;
  });
}
