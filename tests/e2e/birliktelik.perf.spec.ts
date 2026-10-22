import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budget for the Chapter 8 pages: toggling Lab one-hot cells and dragging the
 * apriori min_support slider never stutter. Thresholds match pca.perf.spec.ts and are fixed;
 * a miss is fixed in the code, never here. Runs in the `performans` project with one worker.
 */

async function startFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    w.__ts = [];
    w.__rec = true;
    const tick = (t: number) => { w.__ts.push(t); if (w.__rec) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(100);
}

async function frameGaps(page: Page, mark: number): Promise<number[]> {
  await page.waitForTimeout(50);
  const { ts, end } = await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    w.__rec = false;
    return { ts: w.__ts, end: performance.now() };
  });
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) if (ts[i] > mark && ts[i] <= end) gaps.push(ts[i] - ts[i - 1]);
  return gaps;
}

test('birliktelik-olculeri: toggling table cells stays smooth', async ({ page }, info) => {
  await open(page, '/birliktelik-olculeri/', 'lab', 'td.bk-cell');
  await gotoStep(page, 1, 10, 1500);
  await startFrames(page);
  const mark = await page.evaluate(() => performance.now());
  const t0 = Date.now();
  const N = 60;
  for (let i = 0; i < N; i++) {
    await page.locator(`td.bk-cell[data-row="${i % 18}"][data-col="${i % 6}"]`).click();
    const wait = t0 + ((i + 1) * 1000) / N - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  const gaps = await frameGaps(page, mark);
  const p = p95(gaps);
  const d = `frames=${gaps.length} p95=${round(p)} ms max=${round(Math.max(...gaps))} ms`;
  info.annotations.push({ type: 'cell toggle', description: d });
  console.log('birliktelik-olculeri cell toggle', d);
  expect(gaps.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});

test('apriori: min_support drag stays smooth', async ({ page }, info) => {
  await open(page, '/apriori/', 'lab', '.ap-node');
  await gotoStep(page, 6, 11, 1500);
  await startFrames(page);
  const sup = page.locator('input[data-param="minCount"]');
  const box = (await sup.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width - 4;
  const x1 = box.x + 4;
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
  const gaps = await frameGaps(page, mark);
  const p = p95(gaps);
  const d = `frames=${gaps.length} p95=${round(p)} ms max=${round(Math.max(...gaps))} ms`;
  info.annotations.push({ type: 'min_support drag', description: d });
  console.log('apriori min_support drag', d);
  await expect(sup).toHaveValue('1');
  expect(gaps.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});
