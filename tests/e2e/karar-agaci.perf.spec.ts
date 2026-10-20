import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round, stepCount } from './helpers';

/*
 * Performance budgets for the decision-tree page: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker. "Adım N" = gotoStep(N - 1).
 */

const PAGE = '/karar-agaci/';
const READY = 'svg.tree-plot circle.pt, .card';

test('threshold drag stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, 12, 1000); // Lab adım 7: both root handles shown
  await expect(page.locator('svg.tree-plot line.handle.x')).toBeAttached();

  const ln = await page.locator('svg.tree-plot line.handle.x').first().evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { vertical: e.getAttribute('x1') === e.getAttribute('x2'), x: b.left + b.width / 2 };
  });
  expect(ln.vertical).toBe(true);
  const plot = (await page.locator('svg.tree-plot rect.hit').boundingBox())!;
  // a quarter down the plot, away from the complaint handle (it crosses mid-height)
  const start = { x: ln.x, y: plot.y + plot.height * 0.25 };
  const end = { x: ln.x + plot.width * 0.3, y: start.y };

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
  await expect(stepCount(page)).toHaveText('Adım 7 / 12');
  // the dragged line followed the pointer
  const moved = await page.locator('svg.tree-plot line.scan').first().boundingBox();
  expect(moved).not.toBeNull();
  expect(Math.abs(moved!.x + moved!.width / 2 - end.x)).toBeLessThanOrEqual(2);
  const p = p95(during);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});

test('depth slider regions under 16 ms', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 9, 12); // Lab adım 10
  await expect(page.getByLabel('En fazla derinlik')).toBeVisible();
  const durations = await page.evaluate(async () => {
    const depth = document.querySelector<HTMLInputElement>('input[data-param=depth]')!;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const up = [0, 1, 2, 3, 4, 5, 6, 7];
    const sweep = [...up, ...up.slice(0, -1).reverse()];
    performance.clearMeasures('regions');
    for (let pass = 0; pass < 3; pass++) {
      for (const v of sweep) {
        depth.value = String(v);
        depth.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        await frame();
      }
    }
    return performance.getEntriesByName('regions').map((e) => e.duration);
  });
  // only a changed tree redraws the regions (depths past the tree's own depth change nothing)
  expect(durations.length).toBeGreaterThanOrEqual(10);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'regions', description: d });
  console.log('regions', d);
  expect(p).toBeLessThan(16);
});
