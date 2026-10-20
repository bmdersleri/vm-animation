import { test, expect } from '@playwright/test';
import { fontSizes, gotoStep, open, stepCount } from './helpers';

/*
 * The teacher's two red lines, checked in a real browser at 1280×720:
 * text readable from the back row, and animations that never stutter.
 * Functional checks only; the performance budgets live in knn.perf.spec.ts.
 */

const KNN = '/knn/';
const READY = 'svg.plot circle.pt';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, KNN, 'ders', READY);
  await expect(stepCount(page)).toHaveText('Adım 1 / 12');
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);
  }
  await expect(stepCount(page)).toHaveText('Adım 12 / 12');
  await expect(page.locator('.prediction')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText('Adım 11 / 12');
});

test('ders: Escape closes params and the step keys work at once', async ({ page }) => {
  await open(page, KNN, 'ders', READY);
  await page.locator('.params-toggle').click();
  await page.locator('.params input[type=range]').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.params')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText('Adım 2 / 12');
  await page.keyboard.press(' ');
  await expect(stepCount(page)).toHaveText('Adım 3 / 12');
  await expect(page.locator('.params')).toBeHidden();
});

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, KNN, 'ders', READY);
  await gotoStep(page, 4, 12);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const box = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return {
      params: box(document.querySelector('.params')!),
      stage: box(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll('svg.plot :is(g.vote, g.prediction, .query-label, .axis-title, g.q, g.rank)')].map(box),
    };
  });
  expect(r.marks.length).toBeGreaterThan(0);
  expect(r.stage.r).toBeLessThanOrEqual(r.params.l + 1);
  for (const m of r.marks) {
    expect(m.r <= r.params.l || m.l >= r.params.r || m.b <= r.params.t || m.t >= r.params.b, JSON.stringify(m)).toBe(true);
    expect(m.r).toBeLessThanOrEqual(r.stage.r + 1);
  }
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, KNN, 'ders', READY);
  const measured: Record<string, Record<string, number[]>> = {};
  for (const step of [0, 4, 11]) {
    if (step > 0) await gotoStep(page, step, 12);
    const m: Record<string, number[]> = {
      '.step-title': await fontSizes(page, '.step-title'),
      '.prediction': await fontSizes(page, '.prediction'),
      '.axis-title': await fontSizes(page, '.axis-title'),
      '.tick text': await fontSizes(page, '.tick text'),
      '.step-text': await fontSizes(page, '.step-text'),
      '.step-term': await fontSizes(page, '.step-term'),
      // other plot labels share the tick size
      'labels': await fontSizes(page, '.vote-label, .query-label, .rank text'),
    };
    measured[`step ${step}`] = m;
    expect(m['.step-title'].length, 'step title shown').toBeGreaterThan(0);
    expect(m['.axis-title'].length, 'axis titles shown').toBeGreaterThan(0);
    expect(m['.tick text'].length, 'tick labels shown').toBeGreaterThan(0);
    if (step >= 4) expect(m['.prediction'].length, 'prediction shown').toBeGreaterThan(0);
    for (const fs of [...m['.step-title'], ...m['.prediction']]) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of [...m['.axis-title'], ...m['.tick text'], ...m.labels]) expect(fs).toBeGreaterThanOrEqual(18);
    if (step === 0) expect(m['.step-term'].length, 'English term shown').toBeGreaterThan(0);
    for (const fs of [...m['.step-text'], ...m['.step-term']]) expect(fs).toBeGreaterThanOrEqual(22);
  }
  const summary = Object.fromEntries(Object.entries(measured).map(([k, m]) => [
    k, Object.fromEntries(Object.entries(m).map(([sel, xs]) => [sel, xs.length ? Math.min(...xs) : null])),
  ]));
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(summary) });
  console.log('ders min font-size px', JSON.stringify(summary));
});

test('lab readability', async ({ page }, info) => {
  await open(page, KNN, 'lab', READY);
  const text = await fontSizes(page, '.step-text');
  const labels = await fontSizes(page, '.params label');
  expect(text.length).toBeGreaterThan(0);
  expect(labels.length).toBeGreaterThan(0);
  for (const fs of [...text, ...labels]) expect(fs).toBeGreaterThanOrEqual(16);
  const d = `step-text ${Math.min(...text)} px, params label min ${Math.min(...labels)} px`;
  info.annotations.push({ type: 'lab font-size', description: d });
  console.log('lab font-size', d);
});

test('fullscreen keeps step', async ({ page }, info) => {
  await open(page, KNN, 'ders', READY);
  await gotoStep(page, 5, 12, 1000);
  const widths = () => page.evaluate(() => ({
    svg: document.querySelector('svg.plot')!.getBoundingClientRect().width,
    stage: document.querySelector('.stage')!.getBoundingClientRect().width,
  }));
  const isFs = () => page.evaluate(() => document.fullscreenElement !== null);

  await page.keyboard.press('f');
  await page.waitForTimeout(800);
  const entered = await isFs();
  if (entered) {
    const w = await widths();
    expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const escExited = entered && !(await isFs());
  if (await isFs()) await page.evaluate(() => document.exitFullscreen());
  await page.waitForTimeout(500);
  expect(await isFs()).toBe(false);
  await expect(stepCount(page)).toHaveText('Adım 6 / 12');
  let w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);

  // The same layout path with a real size change, in case fullscreen was denied.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);
  w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  expect(w.stage).toBeGreaterThan(1280 - 1);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  await expect(stepCount(page)).toHaveText('Adım 6 / 12');
  const how = entered ? `entered; exited by ${escExited ? 'Escape' : 'document.exitFullscreen()'}` : 'denied; resize path only';
  info.annotations.push({ type: 'fullscreen', description: how });
  console.log('fullscreen', how);
});

test('lab click moves query', async ({ page }) => {
  await open(page, KNN, 'lab', READY);
  const plot = (await page.locator('svg.plot rect.hit').boundingBox())!;
  await page.mouse.click(plot.x + plot.width * 0.3, plot.y + plot.height * 0.4);
  await expect(stepCount(page)).toHaveText('Adım 2 / 12');
  await page.waitForTimeout(800);
  // the query sits where the plot was clicked
  const q = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(q.x + q.width / 2 - (plot.x + plot.width * 0.3))).toBeLessThanOrEqual(2);
  expect(Math.abs(q.y + q.height / 2 - (plot.y + plot.height * 0.4))).toBeLessThanOrEqual(2);

  // a click in the plot's side margin (outside the data, inside the visible axes) lands where clicked
  const mx = plot.x + plot.width * 0.03;
  const my = plot.y + plot.height * 0.5;
  await page.mouse.click(mx, my);
  await page.waitForTimeout(800);
  const qm = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(qm.x + qm.width / 2 - mx)).toBeLessThanOrEqual(2);
  expect(Math.abs(qm.y + qm.height / 2 - my)).toBeLessThanOrEqual(2);

  await page.getByLabel('Anında sonuç').check();
  await page.mouse.click(plot.x + plot.width * 0.7, plot.y + plot.height * 0.6);
  await expect(stepCount(page)).toHaveText('Adım 5 / 12');
  await expect(page.locator('.prediction')).toBeVisible();
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [['ders', 5], ['ders', 11], ['lab', 5]];
  for (const [mode, step] of shots) {
    await open(page, KNN, mode, READY);
    await gotoStep(page, step - 1, 12);
    await expect(page).toHaveScreenshot(`knn-${mode}-${step}.png`);
  }
});
