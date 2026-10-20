import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round, stepCount } from './helpers';

/*
 * Performance budgets for the Naive Bayes page: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker. "Adım N" = gotoStep(N - 1).
 */

const PAGE = '/naive-bayes/';
const READY = 'canvas.icons[data-cell-px]';
const STEPS = 13;

test('icons recolor under 16 ms', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS); // Lab adım 3: positives only, the posterior strip
  await expect(page.locator('input[data-param=prior]')).toBeVisible();
  const durations = await page.evaluate(async () => {
    const prior = document.querySelector<HTMLInputElement>('input[data-param=prior]')!;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    // slider positions in percent, 0,1 … 50; every one changes the counts
    const up = [0.1, 0.5, 1, 2, 3, 5, 7, 10, 13, 16, 20, 25, 30, 35, 40, 45, 50];
    const sweep = [...up, ...up.slice(0, -1).reverse()];
    performance.clearMeasures('icons');
    for (let pass = 0; pass < 3; pass++) {
      for (const v of sweep) {
        prior.value = String(v);
        prior.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        await frame();
      }
    }
    return performance.getEntriesByName('icons').map((e) => e.duration);
  });
  // one repaint per changed count, so (almost) every slider position
  expect(durations.length).toBeGreaterThanOrEqual(90);
  await expect(stepCount(page)).toHaveText(`Adım 3 / ${STEPS}`);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'icons', description: d });
  console.log('icons', d);
  expect(p).toBeLessThan(16);
});

test('gauss drag stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 11, STEPS, 1000); // Lab adım 12: the new customer and its curve heights
  const query = page.locator('svg.gauss-plot g.q rect.query');
  await expect(query).toBeVisible();
  const centre = async () => {
    const b = (await query.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const plot = (await page.locator('svg.gauss-plot rect.hit').boundingBox())!;
  // from the ◆ to the upper right of the plot (long contract, many complaints: inside the drag range)
  const start = await centre();
  const end = { x: plot.x + plot.width * 0.75, y: plot.y + plot.height * 0.3 };
  const before = await page.locator('.gauss-bar .bar-pct').textContent();

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
  await expect(stepCount(page)).toHaveText(`Adım 12 / ${STEPS}`);
  // the ◆ followed the pointer and the posterior bar moved with it
  const moved = await centre();
  expect(Math.abs(moved.x - end.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(moved.y - end.y)).toBeLessThanOrEqual(2);
  await expect(page.locator('.gauss-bar .bar-pct')).not.toHaveText(before ?? '');
  const p = p95(during);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});
