import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const PAGE = '/gradyan-artirma/';
const READY = 'svg.gb-plot';
const IDS = ['veri', 'baslangic', 'artik', 'ilk-agac', 'kucuk-adim', 'tekrar', 'durma', 'ogrenme-orani', 'ezber', 'bagging-karsi'];
const STEPS = IDS.length;
const LABELS = ['.gb-plot text:not(.probe)', '.gb-plot a.scene-link text'].join(', ');

test.use({ reducedMotion: 'reduce' });

/** Text the formula strip shows once a step's sweep has run to its end (Ders only). */
const SWEEP_END: Record<number, string> = { 6: 'F₅', 7: 'M = 200' };

/** Goes to step n, waits for its view and its sweep end, and lets the scene come to rest. */
async function step(page: Page, n: number, mode: 'ders' | 'lab' = 'ders') {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.gb-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  if (mode === 'ders' && SWEEP_END[n]) await expect(page.locator('.formula')).toContainText(SWEEP_END[n], { timeout: 20_000 });
  await settled(() => page.locator('.gb-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.gb-plot text:not(.probe), .gb-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.gb-scene').innerHTML());
}

test('gradyan-artirma: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Gradyan artırma: artıklarla düzeltme');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: all steps fit and expose only active controls`, async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, PAGE, mode, READY);
    for (let n = 1; n <= STEPS; n++) {
      await step(page, n, mode);
      await geometry(page);
      if (mode === 'lab') {
        expect(await paramsOutside(page)).toEqual([]);
        expect(await shownDisabledGroups(page)).toEqual([]);
      }
    }
  });
}

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [3, 5, 7, 9]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`gradyan-artirma-ders-${n}.png`);
  }
});

test('lab: learning rate and tree count sliders', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 7, 'lab');
  const before = await page.locator('.formula').innerText();
  await setRange(page, 'nu', '7');
  await setRange(page, 'trees', '60');
  await expect(page.locator('.formula')).toContainText('M = 60');
  expect(await page.locator('.formula').innerText()).not.toEqual(before);
  await geometry(page);
  await expect(page).toHaveScreenshot('gradyan-artirma-lab-7.png');
});
