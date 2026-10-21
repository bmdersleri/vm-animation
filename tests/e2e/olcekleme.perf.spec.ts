import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round, stepCount } from './helpers';

/*
 * Performance budgets for the olcekleme page: "animations never stutter". They
 * are fixed; a miss is fixed in the code, never here. This file runs in the
 * `performans` project with one worker.
 */

const PAGE = '/olcekleme/';
const READY = 'svg.scale-plot circle.pt.cust';
const STEPS = 13;

test('new customer drag stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  const query = page.locator('svg.scale-plot path.query');
  await expect(query).toBeVisible();
  const centre = async () => {
    const b = (await query.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const plot = (await page.locator('svg.scale-plot rect.hit').boundingBox())!;
  const start = await centre();
  const end = { x: plot.x + plot.width * 0.7, y: plot.y + plot.height * 0.3 };

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
  await expect(stepCount(page)).toHaveText(`Adım 2 / ${STEPS}`);
  // the ◆ followed the pointer
  const moved = await centre();
  expect(Math.abs(moved.x - end.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(moved.y - end.y)).toBeLessThanOrEqual(2);
  const p = p95(during);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});

test('unit change animation stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    performance.clearMeasures('olc-render');
    w.__ts = [];
    w.__rec = true;
    const tick = (t: number) => {
      w.__ts.push(t);
      if (w.__rec) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const marks: number[] = [];
  for (let i = 0; i < 6; i++) {
    marks.push(await page.evaluate(() => performance.now()));
    await page.keyboard.press('U');
    await page.waitForTimeout(1000);
  }
  const { ts, renders } = await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean };
    w.__rec = false;
    return { ts: w.__ts, renders: performance.getEntriesByName('olc-render').map((e) => e.duration) };
  });
  // frame gaps during each transition after a U press
  const gaps: number[] = [];
  for (const m of marks) {
    for (let i = 1; i < ts.length; i++) if (ts[i] > m && ts[i] <= m + 900) gaps.push(ts[i] - ts[i - 1]);
  }
  const pg = p95(gaps);
  const pr = p95(renders);
  const d = `frames n=${gaps.length} p95=${round(pg)} ms max=${round(Math.max(...gaps))} ms; render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms`;
  info.annotations.push({ type: 'unit change', description: d });
  console.log('unit change', d);
  expect(renders.length).toBeGreaterThanOrEqual(6);
  expect(gaps.length).toBeGreaterThanOrEqual(60);
  expect(pg).toBeLessThan(25);
  expect(pr).toBeLessThan(16);
});
