import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const PAGE = '/random-forest/';
const READY = 'svg.rf-plot';
const IDS = ['kokler', 'alt-kume', 'varyans', 'max-features', 'oob-matris', 'oob-skor', 'oob-cv', 'agac-sayisi', 'onem', 'tuzak'];
const STEPS = IDS.length;
const LABELS = [
  '.rf-plot text.axis-title',
  '.rf-plot text.tick',
  '.rf-plot a.scene-link text',
].join(', ');

test.use({ reducedMotion: 'reduce' });

/** Goes to step n, waits for its view, plays its sweep to the end and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.rf-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  // step 4 sweeps max_features 1 -> 8, step 8 sweeps n_estimators up to its last curve point
  if (n === 4) await expect(page.locator('.formula')).toContainText('max_features = 8', { timeout: 15_000 });
  if (n === 8) await expect(page.locator('.formula')).toContainText('n_estimators=500', { timeout: 15_000 });
  await settled(() => page.locator('.rf-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.rf-plot text:not(.probe), .rf-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
  // the OOB matrix packs its text rows tighter than their line boxes, so its fit is the host's own flag
  const oobFit = await page.evaluate(() => document.querySelector<HTMLElement>('.rf-oob-host:not([hidden])')?.dataset.fit ?? '1');
  expect(oobFit).toBe('1');
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.rf-scene').innerHTML());
}

test('random-forest: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Random Forest, OOB ve öznitelik önemi');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: all steps fit and expose only active controls`, async ({ page }) => {
    await open(page, PAGE, mode, READY);
    for (let n = 1; n <= STEPS; n++) {
      await step(page, n);
      await geometry(page);
      if (mode === 'lab') {
        expect(await paramsOutside(page)).toEqual([]);
        expect(await shownDisabledGroups(page)).toEqual([]);
      }
    }
  });
}

test('ders: key scenes', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (const n of [1, 2, 5, 10]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`random-forest-ders-${n}.png`);
    if (n === 2) await expect(page.locator('.node-chip.winner')).toHaveCount(1);
    if (n === 5) await expect(page.locator('.oob-cell.oob').first()).toBeAttached();
    if (n === 10) await expect(page.locator('.imp-col')).toHaveCount(2);
  }
});

test('lab: max_features slider and MDI / permutation switch', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 4);
  await setRange(page, 'maxFeatures', '3');
  await expect(page.locator('.formula')).toContainText('max_features = 3');
  await geometry(page);
  await expect(page).toHaveScreenshot('random-forest-lab-4.png');

  await step(page, 9);
  await page.locator('input[data-param="withId"]').check();
  await settled(() => page.locator('.rf-scene').innerHTML());
  await geometry(page);

  await step(page, 10);
  const method = page.locator('select[data-param="method"]');
  await expect(method).toBeVisible();
  await method.selectOption('perm');
  await settled(() => page.locator('.rf-scene').innerHTML());
  await geometry(page);
  await expect(page).toHaveScreenshot('random-forest-lab-10.png');
});
