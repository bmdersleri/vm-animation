import { expect, it } from 'vitest';
interface TextStep { readonly text: string; readonly labText?: string }

const NUM = /(?<![\p{L}\d])\d+(?:[.,]\d+)?/gu;
/** Left/right words (sağdaki, solda, sağa …); "sağlıklı" and the like do not match. */
const SIDE = /(?<!\p{L})(?:sağ|sol)(?:a|da|dan|daki|ında|ındaki)?(?!\p{L})/iu;

/**
 * One test per listed step (1-based): its labText exists, uses no left/right word, and shares no number with
 * the lesson text, except the constants listed in `allowed` (numbers no Lab control changes).
 */
export function labTextTests(steps: readonly TextStep[], stepNumbers: readonly number[], allowed: readonly string[] = []): void {
  for (const n of stepNumbers) {
    it(`lab text of step ${n} carries no number the Lab controls change`, () => {
      const step = steps[n - 1];
      expect(step.labText, 'labText').toBeTruthy();
      const lesson = new Set(step.text.match(NUM) ?? []);
      const leaked = (step.labText!.match(NUM) ?? []).filter((x) => lesson.has(x) && !allowed.includes(x));
      expect(leaked).toEqual([]);
      expect(step.labText).not.toMatch(/NaN|undefined|Infinity/);
      // under 900 px the layout is one column, so "sağdaki panel" and the like point nowhere
      expect(step.labText).not.toMatch(SIDE);
    });
  }
}
