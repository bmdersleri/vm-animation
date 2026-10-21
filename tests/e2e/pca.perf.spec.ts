import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets for the pca page: "animations never stutter". They are
 * fixed; a miss is fixed in the code, never here. This file runs in the
 * `performans` project with one worker.
 */

const PAGE = '/pca/';
const READY = 'svg.pca-plot path.pts';
const STEPS = 13;

type W = { __ts: number[]; __rec: boolean; __down: number; __up: number };

/** Start recording rAF timestamps, pointer down / up times and clear the render measures. */
async function startRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as W;
    performance.clearMeasures('pca-render');
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
}

async function stopRecording(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as W;
    w.__rec = false;
    return { ts: w.__ts, down: w.__down, up: w.__up, renders: performance.getEntriesByName('pca-render').map((e) => e.duration) };
  });
}

const gapsIn = (ts: number[], from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i < ts.length; i++) if (ts[i] > from && ts[i] <= to) out.push(ts[i] - ts[i - 1]);
  return out;
};

test('direction drag stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  const hit = (await page.locator('rect.hit').boundingBox())!;
  const c = { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 };
  const r = Math.min(hit.width, hit.height) * 0.3;
  await startRecording(page);

  await page.mouse.move(c.x + r, c.y);
  await page.mouse.down();
  const t0 = Date.now();
  const N = 60;
  for (let i = 1; i <= N; i++) {
    const a = (((170 * i) / N) * Math.PI) / 180;
    await page.mouse.move(c.x + r * Math.cos(a), c.y - r * Math.sin(a), { steps: 1 });
    const wait = t0 + (i * 1000) / N - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
  const { ts, down, up, renders } = await stopRecording(page);
  expect(Number.isFinite(down) && Number.isFinite(up)).toBe(true);
  const during = gapsIn(ts, down, up + 17);
  const p = p95(during);
  const pr = p95(renders);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms; render n=${renders.length} p95=${round(pr)} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('pca drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
  expect(renders.length).toBeGreaterThan(0);
  expect(pr).toBeLessThan(16);
});

test('rotation and collapse stay smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 4, STEPS, 1500);
  await startRecording(page);
  const marks: number[] = [];
  const out: string[] = [];
  for (let i = 0; i < 2; i++) {
    marks.push(await page.evaluate(() => performance.now()));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
  }
  const { ts } = await stopRecording(page);
  const checks: Array<[string, number[]]> = [];
  marks.forEach((m, i) => checks.push([i ? 'collapse' : 'rotation', gapsIn(ts, m, m + 1500)]));
  for (const [name, gaps] of checks) {
    out.push(`${name} n=${gaps.length} p95=${round(p95(gaps))} ms max=${round(Math.max(...gaps))} ms`);
  }
  info.annotations.push({ type: 'rotation and collapse', description: out.join('; ') });
  console.log('pca rotation', out.join('; '));
  for (const [name, gaps] of checks) {
    expect(gaps.length, name).toBeGreaterThanOrEqual(30);
    expect(p95(gaps), name).toBeLessThan(25);
  }
});

test('t-SNE map change stays smooth', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 10, STEPS, 1500);
  await startRecording(page);
  const marks: number[] = [];
  for (const p of ['5', '30', '50', '30']) {
    marks.push(await page.evaluate(() => performance.now()));
    await page.locator(`input[name=perplexity][value="${p}"]`).check();
    await page.waitForTimeout(1000);
  }
  const { ts, renders } = await stopRecording(page);
  const gaps: number[] = [];
  for (const m of marks) gaps.push(...gapsIn(ts, m, m + 1000));
  const pg = p95(gaps);
  const pr = p95(renders);
  const d = `frames n=${gaps.length} p95=${round(pg)} ms max=${round(Math.max(...gaps))} ms; render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms`;
  info.annotations.push({ type: 't-SNE change', description: d });
  console.log('pca t-SNE change', d);
  expect(renders.length).toBeGreaterThanOrEqual(4);
  expect(gaps.length).toBeGreaterThanOrEqual(60);
  expect(pg).toBeLessThan(25);
  expect(pr).toBeLessThan(16);
});
