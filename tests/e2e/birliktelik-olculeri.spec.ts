import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, outsideStage, overlaps, pageOverflow, settled, stepCount } from './helpers';

const PAGE = '/birliktelik-olculeri/';
const READY = 'td.bk-cell';
const STEPS = 10;
const TEXTS = '.bk-plot text, .bk-table th, .bk-table td, .stage p, .stage li';

/** Boxes of the scene parts and the count-up state, read until they come to rest. */
const sceneSettled = (page: Page) => settled(() => page.evaluate(() => [
  document.querySelector('.bk-scene')?.getAttribute('data-counting'),
  ...[...document.querySelectorAll('.bk-plot text, .bk-plot .bk-rule-pt, .bk-table, .bk-bar')].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }),
]));

test('birliktelik-olculeri: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Destek, güven ve kaldıraç');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  // Reduced motion draws the final count at once (step 5: 7 / 11), so the screenshot does not hit a count-up frame.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const step of [2, 5, 7, 10]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 0);
    await sceneSettled(page);
    expect(await outsideStage(page, TEXTS), `step ${step}`).toEqual([]);
    // the two origin tick labels ("0,0") share the corner by design; every other label must stay apart
    if (step === 10) expect(await overlaps(page, '.bk-plot text:not(.tick > text)'), `step ${step}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`birliktelik-olculeri-ders-${step}.png`);
  }
});

test('lab: a one-hot cell toggles by click and by keyboard', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 0);
  const cell = page.locator('td.bk-cell[data-row="0"][data-col="0"]');
  const before = await cell.getAttribute('data-on');
  await cell.click();
  await expect(cell).toHaveAttribute('data-on', before === 'true' ? 'false' : 'true');
  const key = page.locator('td.bk-cell[data-row="1"][data-col="2"]');
  const keyBefore = await key.getAttribute('data-on');
  await key.focus();
  await page.keyboard.press('Space');
  await expect(key).toHaveAttribute('data-on', keyBefore === 'true' ? 'false' : 'true');
  // Space on a cell must not advance the step
  await expect(stepCount(page)).toHaveText(`Adım 2 / ${STEPS}`);
});

test('lab: X and Y chips choose the rule and the table follows', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 4, STEPS, 0);
  const x = page.locator('button[data-chip="x"][data-item="yumurta"]');
  const y = page.locator('button[data-chip="y"][data-item="peynir"]');
  await x.click();
  await expect(x).toHaveAttribute('aria-pressed', 'true');
  await y.click();
  await expect(y).toHaveAttribute('aria-pressed', 'true');
  // an item chosen on one side is disabled on the other
  await expect(page.locator('button[data-chip="y"][data-item="yumurta"]')).toBeDisabled();
  await sceneSettled(page);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('birliktelik-olculeri-lab-yumurta-peynir.png');
});

test('lab: the support slider keeps the scatter labels inside the stage', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 8, STEPS, 0);
  await page.locator('input[data-param="minSupport"]').fill('0.3');
  await expect(page.locator('output[for$="minSupport"]')).toHaveText('min_support = 0,30');
  await sceneSettled(page);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
});
