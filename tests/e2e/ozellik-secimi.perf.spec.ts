import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets for the ozellik-secimi page: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const PAGE = '/ozellik-secimi/';
const READY = 'svg.secim-plot g.row path.dots';
const STEPS = 10;

type W = { __ts: number[]; __rec: boolean };

/** Start recording rAF timestamps and clear the render measures. */
async function startRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as W;
    performance.clearMeasures('secim-render');
    w.__ts = [];
    w.__rec = true;
    const tick = (t: number) => {
      w.__ts.push(t);
      if (w.__rec) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(100);
}

async function stopRecording(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as W;
    w.__rec = false;
    return { ts: w.__ts, renders: performance.getEntriesByName('secim-render').map((e) => e.duration) };
  });
}

const gaps = (ts: number[]): number[] => ts.slice(1).map((t, i) => t - ts[i]);

test('k slider stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 3, STEPS, 1000);
  const slider = page.locator('input[data-param=k]');
  await startRecording(page);
  const values = [2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
  for (let lap = 0; lap < 10; lap++) {
    for (const v of values) {
      await slider.evaluate(async (el, x) => {
        (el as HTMLInputElement).value = String(x);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      }, v);
    }
  }
  const { ts, renders } = await stopRecording(page);
  const g = gaps(ts);
  const pg = p95(g);
  const pr = p95(renders);
  const d = `frames=${g.length} p95=${round(pg)} ms max=${round(Math.max(...g))} ms; render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms`;
  info.annotations.push({ type: 'k slider', description: d });
  console.log('secim k slider', d);
  expect(renders.length).toBeGreaterThanOrEqual(90);
  expect(pr).toBeLessThan(16);
  expect(pg).toBeLessThan(25);
});

test('RFE round animation stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS, 1500);
  await startRecording(page);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(4000);
  const { ts, renders } = await stopRecording(page);
  const g = gaps(ts);
  const pg = p95(g);
  const pr = p95(renders);
  const d = `frames=${g.length} p95=${round(pg)} ms max=${round(Math.max(...g))} ms; render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms`;
  info.annotations.push({ type: 'RFE rounds', description: d });
  console.log('secim RFE rounds', d);
  expect(g.length).toBeGreaterThanOrEqual(100);
  expect(renders.length).toBeGreaterThan(0);
  expect(pg).toBeLessThan(25);
  expect(pr).toBeLessThan(16);
});
