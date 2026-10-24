import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/smote-sizinti/';
const READY = 'svg.leak-plot';
const IDS = ['iki-sira', 'once-smote', 'testte-ne-var', 'pr-taban', 'iki-skor', 'pipeline', 'smote-agirlik', 'esik', 'hata-ayiklama', 'baska-sizintilar'];
const STEPS = IDS.length;
const LABELS = '.leak-plot text:not(.probe)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest (a sweep step lands on its last value at once). */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.leak-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.leak-scene').innerHTML());
}

/** The two "0,0" ticks meet at the origin corner of a chart: their line boxes touch, the digits do not. */
const CORNER = 'text "0,0" x text "0,0"';

async function geometry(page: Page) {
  expect((await overlaps(page, LABELS)).filter((o) => o !== CORNER)).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .leak-scene .formula`)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

test('smote-sizinti: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('SMOTE sızıntısı ve PR-AUC');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [2, 4, 6, 9]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`smote-sizinti-ders-${n}.png`);
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

test('lab: threshold slider moves the operating point', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 8);
  const slider = page.locator('input[data-param="threshold"]');
  await expect(slider).toBeVisible();
  const before = await page.locator('.formula').innerText();
  await slider.fill('0.2');
  await slider.dispatchEvent('input');
  await settled(() => page.locator('.leak-scene').innerHTML());
  await expect(slider).toHaveValue('0.2');
  expect(await page.locator('.formula').innerText()).not.toEqual(before);
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('smote-sizinti-lab-8.png');
});

test.describe('390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('step 8: the panel shows whole (Lab fits the stage, Ders scrolls to its last line)', async ({ page }) => {
    for (const mode of ['lab', 'ders'] as const) {
      await open(page, PAGE, mode, READY);
      await step(page, 8);
      expect((await overlaps(page, LABELS)).filter((o) => o !== CORNER), mode).toEqual([]);
      const r = await page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('.leak-pr-host')!;
        const fits = host.scrollHeight <= host.clientHeight + 1;
        host.scrollTop = host.scrollHeight;
        const link = document.querySelector('.leak-pr-host text.panel-link')!.getBoundingClientRect();
        return { fits, linkBottom: link.bottom, hostBottom: host.getBoundingClientRect().bottom };
      });
      if (mode === 'lab') expect(r.fits, 'lab: no scroll').toBe(true);
      expect(r.linkBottom, mode).toBeLessThanOrEqual(r.hostBottom + 1);
    }
  });
});
