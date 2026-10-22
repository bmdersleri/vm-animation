import { test, expect } from '@playwright/test';
import { gotoStep, labelCollisions, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

const PAGE = '/dbscan/';
const READY = 'svg.db-plot g.pk-point';
const STEPS = 10;
const TEXTS = '.db-plot text, .kd-chart text, .stage p, .stage li';

test('dbscan: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('DBSCAN');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  for (const step of [4, 5, 6, 8, 10]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 2500);
    // step 8 spreads the clusters, step 9 sweeps eps; wait for the sweep end
    if (step === 8) await page.waitForTimeout(4500);
    expect(await outsideStage(page, TEXTS), `step ${step}`).toEqual([]);
    expect(await labelCollisions(page, 'svg.db-plot'), `step ${step}`).toEqual([]);
    expect(await overlaps(page, '.pk-sel-label'), `step ${step}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`dbscan-ders-${step}.png`);
  }
});

test('lab: eps slider and point click', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS);
  await page.locator('svg.db-plot g.pk-point').nth(20).click({ force: true });
  await expect(page.locator('input[data-param="point"]')).toHaveValue('21');
  const eps = page.locator('input[data-param="eps"]');
  await eps.fill('0.4');
  await expect(page.locator('.db-out').first()).toHaveText('eps = 0,40');
  // the panel next to the slider uses the same two-decimal form
  await expect(page.locator('.db-panel [data-eps]')).toHaveText('0,40');
  await page.waitForTimeout(1200);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
  expect(await labelCollisions(page, 'svg.db-plot')).toEqual([]);
  expect(await overlaps(page, '.pk-sel-label')).toEqual([]);
  await expect(page).toHaveScreenshot('dbscan-lab-eps-point.png');
});

test('narrow layout: the scatter keeps its height and the panel sits below it', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  for (const mode of ['ders', 'lab'] as const) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, 5, STEPS, 2500);
    const m = await page.evaluate(() => {
      const plot = document.querySelector('svg.db-plot')!.getBoundingClientRect();
      const panel = document.querySelector('.db-point')?.getBoundingClientRect();
      return { h: plot.height, gap: panel ? panel.top - plot.bottom : 0 };
    });
    expect(m.h, mode).toBeGreaterThanOrEqual(200);
    expect(m.gap, mode).toBeGreaterThanOrEqual(-1);
    expect(await labelCollisions(page, 'svg.db-plot'), mode).toEqual([]);
    expect(await overlaps(page, '.pk-sel-label'), mode).toEqual([]);
  }
});
