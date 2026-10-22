import { expect, it } from 'vitest';
import type { Step } from '../../src/core/player';

const NUM = /\d+(?:[.,]\d+)?/g;

/**
 * One test per listed step (1-based): its labText exists and shares no number with
 * the lesson text, except the constants listed in `allowed` (numbers no Lab control changes).
 */
export function labTextTests(steps: readonly Step<never>[], stepNumbers: readonly number[], allowed: readonly string[] = []): void {
  for (const n of stepNumbers) {
    it(`lab text of step ${n} carries no number the Lab controls change`, () => {
      const step = steps[n - 1];
      expect(step.labText, 'labText').toBeTruthy();
      const lesson = new Set(step.text.match(NUM) ?? []);
      const leaked = (step.labText!.match(NUM) ?? []).filter((x) => lesson.has(x) && !allowed.includes(x));
      expect(leaked).toEqual([]);
      expect(step.labText).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
}
