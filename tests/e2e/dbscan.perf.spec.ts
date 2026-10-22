import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budget for the dbscan page: dragging the eps slider 0.05 -> 1 never
 * stutters. Thresholds match pca.perf.spec.ts and are fixed; a miss is fixed in
 * the code, never here. Runs in the `performans` project with one worker.
 */

const PAGE = '/dbscan/';
const READY = 'svg.db-plot g.pk-point';
const STEPS = 10;

test('eps slider drag stays smooth', async ({ page }: { page: Page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS, 1500);
  await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    w.__ts = [];
    w.__rec = true;
    const tick = (t: number) => { w.__ts.push(t); if (w.__rec) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(100);
  const k = page.locator('input[data-param="eps"]');
  const box = (await k.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + 4;
  const x1 = box.x + box.width - 4;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  const t0 = Date.now();
  const N = 60;
  const mark = await page.evaluate(() => performance.now());
  for (let i = 1; i <= N; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / N, y, { steps: 1 });
    const wait = t0 + (i * 1000) / N - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
  const { ts, end } = await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    w.__rec = false;
    return { ts: w.__ts, end: performance.now() };
  });
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) if (ts[i] > mark && ts[i] <= end) gaps.push(ts[i] - ts[i - 1]);
  const p = p95(gaps);
  const d = `frames=${gaps.length} p95=${round(p)} ms max=${round(Math.max(...gaps))} ms`;
  info.annotations.push({ type: 'eps drag', description: d });
  console.log('dbscan eps drag', d);
  await expect(page.locator('.db-out').first()).toHaveText(/eps = 1/);
  expect(gaps.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});
