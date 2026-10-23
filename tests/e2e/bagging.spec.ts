import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const PAGE = '/bagging/';
const READY = 'svg.bagging-plot';
const IDS = ['torba', 'cekilis', 'oob', 'yuzde', 'tek-agac', 'uc-agac', 'oylama', 'cogunluk', 'deney', 'sinir'];
const STEPS = IDS.length;
/** Trees of the bagging ensemble (the step 7 sweep ends on this M). */
const TREES = 50;
const LABELS = [
  '.bagging-plot text.axis-title',
  '.bagging-plot text.tick',
  '.bagging-plot text.bag-oob-label',
  '.bagging-plot text.vote-callout',
  '.bagging-plot text.region-legend',
  '.bagging-plot text.exp-mean',
  '.bagging-plot a.scene-link text',
].join(', ');

test.use({ reducedMotion: 'reduce' });

/** Goes to step n, waits for its view, plays its sweep to the end and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.bagging-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  // step 2 draws the cards one by one (n = 10), step 7 adds the trees one by one (M = 50)
  if (n === 2) await expect(page.locator('.formula')).toContainText('10 / 10 çekiliş', { timeout: 15_000 });
  if (n === 7) await expect(page.locator('.formula')).toContainText(`${TREES} ağaç`, { timeout: 15_000 });
  await settled(() => page.locator('.bagging-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.bagging-plot text:not(.probe), .bagging-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.bagging-scene').innerHTML());
}

test('bagging: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Bootstrap ve bagging');
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
  for (const n of [2, 3, 6, 7]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`bagging-ders-${n}.png`);
    if (n === 2) await expect(page.locator('.bag-slot.filled')).toHaveCount(10);
    if (n === 3) await expect(page.locator('.bag-card.oob')).not.toHaveCount(0);
    if (n === 6) await expect(page.locator('.bagging-plot .panel')).toHaveCount(3);
    if (n === 7) await expect(page.locator('.vote-boundary')).not.toHaveCount(0);
  }
});

test('lab: tree number and tree count sliders, customer pick', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 6);
  const roots = () => page.locator('.panel-root').allTextContents();
  const before = await roots();
  await setRange(page, 'tree', '12');
  expect(await roots()).not.toEqual(before);
  await geometry(page);
  await expect(page).toHaveScreenshot('bagging-lab-6.png');

  await step(page, 7);
  await setRange(page, 'trees', '15');
  await expect(page.locator('.formula')).toContainText('15 ağaç');
  await geometry(page);
  const pickable = page.locator('.pt.pickable');
  const target = pickable.nth(3);
  const label = (await target.getAttribute('aria-label'))!;
  const index = /(\d+)/.exec(label)![1];
  await target.click({ force: true });
  await expect(page.locator('.formula')).toContainText(`müşteri ${index} ·`);
  await settled(() => page.locator('.bagging-scene').innerHTML());
  await geometry(page);
  await expect(page).toHaveScreenshot('bagging-lab-7.png');
});
