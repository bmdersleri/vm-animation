import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const PAGE = '/boosting-ayarlari/';
const READY = 'svg.tune-plot';
const IDS = ['lr-deney', 'egriler', 'agac-ekle', 'ezber', 'erken-durdurma', 'seviye', 'yaprak', 'yaprak-siniri', 'izgara', 'sirali-arama'];
const STEPS = IDS.length;
// the split-number badges sit on the box corners by design
const LABELS = ['.tune-plot text:not(.probe):not(.tg-order text)', '.tune-plot a.scene-link text'].join(', ');

test.use({ reducedMotion: 'reduce' });

/** Text the formula strip shows once a step's sweep has run to its end (Ders only). */
const SWEEP_END: Record<number, string> = { 8: '64 yaprak', 9: '8 / 8 deneme', 10: '8 / 8 deneme' };

/** Goes to step n, waits for its view and its sweep end, and lets the scene come to rest. */
async function step(page: Page, n: number, mode: 'ders' | 'lab' = 'ders') {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.tune-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  if (mode === 'ders' && SWEEP_END[n]) await expect(page.locator('.formula')).toContainText(SWEEP_END[n], { timeout: 20_000 });
  await settled(() => page.locator('.tune-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.tune-plot text:not(.probe), .tune-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.tune-scene').innerHTML());
}

test('boosting-ayarlari: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Boosting ayarları: öğrenme oranı, erken durdurma, arama');
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
  for (const n of [1, 5, 7, 10]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`boosting-ayarlari-ders-${n}.png`);
  }
});

test('lab: depth and trial budget sliders', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 6, 'lab');
  const before = await page.locator('.formula').innerText();
  await setRange(page, 'depth', '3');
  expect(await page.locator('.formula').innerText()).not.toEqual(before);
  await geometry(page);
  await expect(page).toHaveScreenshot('boosting-ayarlari-lab-6.png');

  await step(page, 9, 'lab');
  await setRange(page, 'budget', '12');
  await expect(page.locator('.formula')).toContainText('12 / 12 deneme');
  await geometry(page);
  await expect(page).toHaveScreenshot('boosting-ayarlari-lab-9.png');
});
