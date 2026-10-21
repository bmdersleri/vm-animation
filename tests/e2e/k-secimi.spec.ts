import { test, expect } from '@playwright/test';
import { gotoStep, open, outsideStage, pageOverflow, stepCount } from './helpers';

const PAGE = '/k-secimi/';
const READY = 'svg.ks-plot circle.cs-point';
const STEPS = 9;

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
  await expect(page).toHaveScreenshot('k-secimi-lab-k4-point.png');
});
