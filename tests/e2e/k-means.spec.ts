import { test, expect } from '@playwright/test';
import { gotoStep, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

const PAGE = '/k-means/';
const READY = 'svg.km-plot circle.cs-point';
const STEPS = 8;

test('k-means: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('K-Means döngüsü');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  for (const step of [3, 6, 7, 8]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS);
    expect(await outsideStage(page, '.km-plot text, .stage p, .stage li')).toEqual([]);
    const o = await pageOverflow(page);
    expect(o.x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`k-means-ders-${step}.png`);
  }
});

test('screenshots: lab new start and play', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS);
  await page.locator('[data-act="new-start"]').click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('k-means-lab-new-start.png');
  await page.locator('.play').click();
  await expect(stepCount(page)).not.toHaveText(`Adım 3 / ${STEPS}`);
  await page.locator('.play').click();
  expect(await overlaps(page, '.km-plot text')).toEqual([]);
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('k-means-lab-play.png');
});
