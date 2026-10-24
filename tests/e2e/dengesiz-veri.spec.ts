import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/dengesiz-veri/';
const READY = 'svg.imb-plot';
const IDS = ['veri', 'dogruluk', 'azinlik', 'egitim', 'sentetik', 'smote-doldur', 'kopyalama', 'agirlik', 'sinir', 'karsilastirma'];
const STEPS = IDS.length;
/** Every label; the matrix tag over its count and the caption under a panel title stack on purpose (their line boxes touch). */
const LABELS = '.imb-plot text:not(.probe):not(.cell-tag):not(.sp-caption)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest (a sweep step lands on its last value at once). */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.imb-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.imb-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .imb-scene .formula`)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.imb-scene').innerHTML());
}

async function setMethod(page: Page, value: string) {
  const control = page.locator('select[data-param="method"]');
  await expect(control).toBeVisible();
  await control.selectOption(value);
  await settled(() => page.locator('.imb-scene').innerHTML());
}

test('dengesiz-veri: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf ağırlığı');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [2, 5, 9, 10]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`dengesiz-veri-ders-${n}.png`);
  }
});

test('lab: every step fits and shows only its controls inside the card', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    await step(page, n);
    await geometry(page);
    expect(await paramsOutside(page), `step ${n}`).toEqual([]);
  }
});

test('lab: k and target ratio sliders, then the method select', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 9);
  await setMethod(page, 'smote');
  await setRange(page, 'k', '3');
  await setRange(page, 'ratio', '0.5');
  await expect(page.locator('input[data-param="k"]')).toHaveValue('3');
  await expect(page.locator('input[data-param="ratio"]')).toHaveValue('0.5');
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('dengesiz-veri-lab-9-smote.png');
  await setMethod(page, 'agirlik');
  await expect(page.locator('input[data-param="k"]')).toBeHidden();
  await expect(page.locator('select[data-param="weight"]')).toBeVisible();
  await geometry(page);
});
