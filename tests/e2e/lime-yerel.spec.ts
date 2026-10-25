import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, type Stack } from './helpers';

const PAGE = '/lime-yerel/';
const READY = '.lime-stage';
const IDS = ['yerel-soru', 'kartil', 'komsuluk', 'ikili', 'cekirdek', 'vekil', 'sadakat', 'kararlilik', 'shap-lime', 'hata-ayiklama'];
const STEPS = IDS.length;
/** Labels whose boxes must not run into each other (leaf elements only). */
const LABELS = '.lime-stage svg text:not(.probe)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.lime-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.lime-scene').innerHTML());
}

/**
 * The kernel curve writes each weight right under its distance tick: the two line boxes touch by about one
 * pixel, the glyphs do not (checked in the screenshots). Only that stacked pair is let through.
 */
const WEIGHT_STACK: Stack = { upper: 'text', lower: '.kernel-weight', within: 'svg', maxShare: 0.15 };
const overlapsOf = (page: Page) => overlaps(page, LABELS, [WEIGHT_STACK]);
/** Scene boxes that must show all their content; the code box scrolls on purpose, its content must stay reachable. */
const BOXES = '.lime-host, .pattern-wrap, .pattern-table, .code-pre, .code-side, .flow-box';

async function geometry(page: Page, at = '') {
  expect(await overlapsOf(page), at).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .lime-scene .formula`), at).toEqual([]);
  expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
}

test('lime-yerel: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('LIME: yerel vekil model ve SHAP ile karşılaştırma');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [3, 5, 7, 9]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`lime-yerel-ders-${n}.png`);
  }
});

test('lab: every step fits and shows only its controls inside the card', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    await step(page, n);
    await geometry(page, `step ${n}`);
    expect(await clippedBoxes(page, BOXES, '.code-pre'), `step ${n}`).toEqual([]);
    expect(await paramsOutside(page), `step ${n}`).toEqual([]);
  }
});

test('lab: step 6 kernel width changes the surrogate', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 6);
  const slider = page.locator('input[data-param="width"]');
  await expect(slider).toBeVisible();
  const before = await page.locator('.fidelity-r2, .lime-bar').evaluateAll((els) => els.map((e) => e.outerHTML));
  await slider.fill('0.6');
  await expect(page.locator('.width-value')).toHaveText('0,600');
  await expect(page.locator('.step-count')).toHaveText(`Adım 6 / ${STEPS}`);
  await settled(() => page.locator('.lime-scene').innerHTML());
  const after = await page.locator('.fidelity-r2, .lime-bar').evaluateAll((els) => els.map((e) => e.outerHTML));
  expect(after).not.toEqual(before);
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('lime-yerel-lab-6.png');
});
