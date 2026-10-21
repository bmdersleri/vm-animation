import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets for the iqr-aykiri extreme slider: "animations never
 * stutter". They are fixed; a miss is fixed in the code, never here. This file
 * runs in the `performans` project with one worker.
 */

const PAGE = '/iqr-aykiri/';
const READY = 'svg.iqr-plot circle.pt';
const STEPS = 11;

/** Sweep the slider 50→500→50 three times; return render durations and rAF gaps. */
async function sweep(page: Page): Promise<{ renders: number[]; gaps: number[] }> {
  return page.evaluate(async () => {
    const s = document.querySelector<HTMLInputElement>('input[data-param=extreme]')!;
    const frame = () => new Promise<number>((r) => requestAnimationFrame((t) => r(t)));
    const up: number[] = [];
    for (let v = 50; v <= 500; v += 10) up.push(v);
    const path = [...up, ...up.slice(0, -1).reverse()];
    performance.clearMeasures('iqr-render');
    const stamps: number[] = [];
    for (let pass = 0; pass < 3; pass++) {
      for (const v of path) {
        s.value = String(v);
        s.dispatchEvent(new Event('input', { bubbles: true }));
        stamps.push(await frame());
        stamps.push(await frame());
      }
    }
    const gaps: number[] = [];
    for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1]);
    return { renders: performance.getEntriesByName('iqr-render').map((e) => e.duration), gaps };
  });
}

for (const [part, step] of [[1, 2], [2, 9]] as const) {
  test(`extreme slider stays smooth (part ${part})`, async ({ page }, info) => {
    await open(page, PAGE, 'lab', READY);
    await gotoStep(page, step - 1, STEPS);
    const { renders, gaps } = await sweep(page);
    expect(renders.length).toBeGreaterThanOrEqual(90);
    const pr = p95(renders);
    const pg = p95(gaps);
    const d = `render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms; frames n=${gaps.length} p95=${round(pg)} ms max=${round(Math.max(...gaps))} ms`;
    info.annotations.push({ type: `slider part ${part}`, description: d });
    console.log(`slider part ${part}`, d);
    expect(pr).toBeLessThan(16);
    expect(pg).toBeLessThan(25);
  });
}
