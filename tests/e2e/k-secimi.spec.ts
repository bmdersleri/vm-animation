import { test, expect, type Page } from '@playwright/test';
import { gotoStep, labelCollisions, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

const PAGE = '/k-secimi/';
const READY = 'svg.ks-plot circle.cs-point';
const STEPS = 9;

/** Charts whose SVG is taller than its host (drawn for an older, smaller panel). */
const chartOverflow = (page: Page): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll('.ks-chart-host')].flatMap((h) => {
  const svg = h.querySelector('svg')!;
  const hh = h.getBoundingClientRect().height;
  const sh = svg.getBoundingClientRect().height;
  return sh > hh + 1 ? [`${svg.getAttribute('class')} ${Math.round(sh)} > ${Math.round(hh)}`] : [];
}));

test('k-secimi: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('k sayısının seçimi');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  for (const step of [1, 4, 6, 8]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 2500);
    // step 4 sweeps k = 4..10 and stays on 10
    if (step === 4) { await expect(page.locator('.ks-k')).toHaveAttribute('data-k', '10', { timeout: 10_000 }); await page.waitForTimeout(1200); }
    expect(await outsideStage(page, '.ks-plot text, .stage p, .stage li')).toEqual([]);
    expect(await labelCollisions(page, 'svg.ks-plot'), `step ${step}`).toEqual([]);
    expect(await overlaps(page, '.ks-chart-title, .kc-tick-x, .ks-panel')).toEqual([]);
    expect(await chartOverflow(page)).toEqual([]);
    const o = await pageOverflow(page);
    expect(o.x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`k-secimi-ders-${step}.png`);
  }
});

test('lab: k slider 2 to 4 and point click', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  const k = page.locator('input[data-param="k"]');
  await k.fill('2');
  await expect(page.locator('.ks-k-out')).toHaveText('k = 2');
  await page.waitForTimeout(800);
  await k.fill('4');
  await expect(page.locator('.ks-k-out')).toHaveText('k = 4');
  await page.waitForTimeout(1200);
  await page.locator('svg.ks-plot circle.cs-point').nth(20).click({ force: true });
  await expect(page.locator('input[data-param="point"]')).toHaveValue('21');
  await page.waitForTimeout(800);
  expect(await labelCollisions(page, 'svg.ks-plot')).toEqual([]);
  expect(await overlaps(page, '.ks-chart-title, .kc-tick-x, .ks-panel')).toEqual([]);
  expect(await chartOverflow(page)).toEqual([]);
  await expect(page).toHaveScreenshot('k-secimi-lab-k4-point.png');
});

test('lab: a point next to a centre keeps its label off the centre label', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  await page.locator('input[data-param="point"]').fill('50');
  await expect(page.locator('.cs-ring[data-kind="selected"]')).toHaveAttribute('data-i', '49');
  await expect(page.locator('.cs-ring-label').filter({ hasText: 'Nokta 50' })).toHaveCount(1);
  expect(await labelCollisions(page, 'svg.ks-plot')).toEqual([]);
});

test('lab: panel sits under the scatter and its labels stay on one line', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  await page.locator('input[data-param="k"]').fill('4');
  await expect(page.locator('.ks-k-out')).toHaveText('k = 4');
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const host = document.querySelector('.ks-plot-host')!.getBoundingClientRect();
    const panel = document.querySelector('.ks-panel')!.getBoundingClientRect();
    const plot = document.querySelector('.ks-plot')!.getBoundingClientRect();
    const labels = [...document.querySelectorAll('.ks-panel .ks-label')].map((l) => {
      const r = l.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(l).lineHeight) || parseFloat(getComputedStyle(l).fontSize) * 1.2;
      return { text: l.textContent, ratio: r.height / lh };
    });
    return { gap: panel.top - host.bottom, plotW: plot.width, labels };
  });
  expect(m.gap).toBeGreaterThanOrEqual(-1);
  expect(m.plotW).toBeGreaterThanOrEqual(430);
  expect(m.labels.length).toBeGreaterThan(0);
  for (const l of m.labels) expect(l.ratio, String(l.text)).toBeLessThanOrEqual(1.6);
});

test('ders: step 8 compare rows line up', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 7, STEPS, 2500);
  const tops = await page.evaluate(() => [3, 4].map((k) => [...document.querySelectorAll(`[data-compare-k="${k}"] .ks-row`)].slice(0, 3).map((r) => r.getBoundingClientRect().top)));
  expect(tops[0]).toHaveLength(3);
  for (let i = 0; i < 3; i++) expect(Math.abs(tops[0][i] - tops[1][i])).toBeLessThanOrEqual(3);
});
