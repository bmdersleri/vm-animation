import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round, stepCount } from './helpers';

/*
 * Performance budgets for the k-NN page: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const KNN = '/knn/';
const READY = 'svg.plot circle.pt';

test('regions redraw under 16 ms', async ({ page }, info) => {
  await open(page, KNN, 'lab', READY);
  await gotoStep(page, 5, 12);
  await expect(page.getByLabel('k (komşu sayısı)')).toBeVisible();
  const durations = await page.evaluate(async () => {
    const k = [...document.querySelectorAll<HTMLInputElement>('input[type=range]')]
      .find((e) => document.querySelector(`label[for="${e.id}"]`)?.textContent === 'k (komşu sayısı)')!;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const up = [1, 3, 5, 7, 9, 11, 13, 15];
    const sweep = [...up, ...up.slice(0, -1).reverse()];
    performance.clearMeasures('regions');
    for (let pass = 0; pass < 3; pass++) {
      for (const v of sweep) {
        k.value = String(v);
        k.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        await frame();
      }
    }
    return performance.getEntriesByName('regions').map((e) => e.duration);
  });
  expect(durations.length).toBeGreaterThanOrEqual(40);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'regions', description: d });
  console.log('regions', d);
  expect(p).toBeLessThan(16);
});

test('drag stays smooth', async ({ page }, info) => {
  await open(page, KNN, 'lab', READY);
  await gotoStep(page, 4, 12, 1000);
  const q = (await page.locator('svg.plot rect.query').boundingBox())!;
  const start = { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  // stay inside the data extent: the query is clamped to the data domain,
  // which can be narrower than the plot (equal-aspect scales)
  const data = await page.evaluate(() => {
    const rs = [...document.querySelectorAll('svg.plot .pt')].map((e) => e.getBoundingClientRect());
    const xs = rs.map((r) => r.x + r.width / 2);
    const ys = rs.map((r) => r.y + r.height / 2);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const end = { x: data.x0 + (data.x1 - data.x0) * 0.85, y: data.y0 + (data.y1 - data.y0) * 0.2 };

  // rAF timestamps plus the page-side times of pointer down / up
  await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean; __down: number; __up: number };
    w.__ts = [];
    w.__rec = true;
    w.__down = w.__up = NaN;
    window.addEventListener('pointerdown', () => { w.__down = performance.now(); }, { capture: true, once: true });
    window.addEventListener('pointerup', () => { w.__up = performance.now(); }, { capture: true, once: true });
    const tick = (t: number) => {
      w.__ts.push(t);
      if (w.__rec) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(100);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const t0 = Date.now();
  const N = 60;
  for (let i = 1; i <= N; i++) {
    const f = i / N;
    await page.mouse.move(start.x + (end.x - start.x) * f, start.y + (end.y - start.y) * f, { steps: 1 });
    const wait = t0 + (i * 1000) / N - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
  const { ts, down, up } = await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean; __down: number; __up: number };
    w.__rec = false;
    return { ts: w.__ts, down: w.__down, up: w.__up };
  });
  // frame intervals that end between pointer down and one frame after pointer up
  const during: number[] = [];
  for (let i = 1; i < ts.length; i++) if (ts[i] > down && ts[i] <= up + 17) during.push(ts[i] - ts[i - 1]);
  expect(Number.isFinite(down) && Number.isFinite(up)).toBe(true);
  await expect(stepCount(page)).toHaveText('Adım 5 / 12');
  // the query followed the pointer to the end of the drag
  const qEnd = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(qEnd.x + qEnd.width / 2 - end.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(qEnd.y + qEnd.height / 2 - end.y)).toBeLessThanOrEqual(2);
  const p = p95(during);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});
