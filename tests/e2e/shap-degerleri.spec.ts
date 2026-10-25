import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, type Stack } from './helpers';

const PAGE = '/shap-degerleri/';
const READY = '.shap-stage';
const IDS = ['kara-kutu', 'genel-onem', 'koalisyon', 'marjinal', 'alti-siralama', 'toplam', 'kuvvet', 'global', 'ozet-grafik', 'sinirlar'];
const STEPS = IDS.length;
/** Labels whose boxes must not run into each other (leaf elements only). */
const LABELS = '.shap-stage svg text:not(.probe)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.shap-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.shap-scene').innerHTML());
}

/**
 * A lattice node writes the coalition value right under the feature names: the two line boxes touch by about
 * two pixels, the glyphs do not (checked in the screenshots). Only that stacked pair is let through.
 */
const NODE_STACK: Stack = { upper: '.node-name', lower: '.node-v', within: 'svg', maxShare: 0.15 };
const overlapsOf = (page: Page) => overlaps(page, LABELS, [NODE_STACK]);

async function geometry(page: Page) {
  expect(await overlapsOf(page)).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .shap-scene .formula`)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

test('shap-degerleri: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('SHAP: Shapley değerleriyle katkı');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [3, 5, 7, 9]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`shap-degerleri-ders-${n}.png`);
  }
});

test('step 7 fits a phone: the taller force rows stay inside the stage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, PAGE, 'ders', READY);
  await step(page, 7);
  await geometry(page);
});

test('lab: every step fits and shows only its controls inside the card', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    await step(page, n);
    expect(await overlapsOf(page), `step ${n}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    expect(await paramsOutside(page), `step ${n}`).toEqual([]);
  }
});

test('lab: step 5 recomputes the six orderings for customer 77', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 5);
  const cells = () => page.locator('.order-cell, .order-mean').allInnerTexts();
  const before = await cells();
  const select = page.locator('select[data-param="customer"]');
  await expect(select).toBeVisible();
  await select.selectOption('77');
  await expect(page.locator('.step-count')).toHaveText(`Adım 5 / ${STEPS}`);
  await settled(() => page.locator('.shap-scene').innerHTML());
  const after = await cells();
  expect(after.length).toBeGreaterThan(0);
  expect(after).not.toEqual(before);
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('shap-degerleri-lab-5.png');
});
