import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/model-kaymasi/';
const READY = '.kayma-stage';
const IDS = ['alti-ay-sonra', 'iki-donem', 'fark-esik', 'veri-kavram', 'aylik-izleme', 'esik-secimi', 'ortalama-yaniltir', 'psi', 'alarm-akisi', 'hata-ayiklama'];
const STEPS = IDS.length;
/** Labels whose boxes must not run into each other (leaf elements only). */
const LABELS = '.kayma-stage svg text:not(.probe)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.kayma-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.kayma-scene').innerHTML());
}

/** Scene boxes that must show all their content; the code box scrolls on purpose, its content must stay reachable. */
const BOXES = '.kayma-host, .threshold-table, .readout, .stat-box, .code-pre';

async function geometry(page: Page, at = '') {
  expect(await overlaps(page, LABELS), at).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .kayma-scene .formula`), at).toEqual([]);
  expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
}

test('model-kaymasi: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Model kayması ve izleme eşiği');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [3, 5, 7, 8]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`model-kaymasi-ders-${n}.png`);
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

test('lab: step 5 kavram shows no input alarm and an accuracy alarm at 15 known at 18', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 5);
  await page.locator('select[data-param="scenario"]').selectOption('4');
  await expect(page.locator('.step-count')).toHaveText(`Adım 5 / ${STEPS}`);
  await settled(() => page.locator('.kayma-scene').innerHTML());
  await expect(page.locator('.readout [data-read="alarms"] .read-value')).toHaveText('yok');
  const acc = page.locator('.readout [data-read="acc"] .read-value');
  await expect(acc).toContainText('15');
  await expect(acc).toContainText('18');
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('model-kaymasi-lab-5.png');
});
