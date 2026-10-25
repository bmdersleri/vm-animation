import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/tfidf-kosinus/';
const READY = '.tf-stage';
const IDS = ['token', 'turkce-karakter', 'stop-word', 'bow', 'idf', 'tfidf-norm', 'yan-yana', 'kosinus', 'uzunluk-yon', 'ortak-sozluk'];
const STEPS = IDS.length;
/** Labels and chips whose boxes must not run into each other (leaf elements only). */
const LABELS = '.tf-stage svg text:not(.probe), .tf-stage .token-chip, .tf-stage .sim-label, .tf-stage .sim-score, .tf-stage .sim-note, .tf-stage .heat-col-text';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.tf-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.tf-scene').innerHTML());
}

/** The two "0,0" ticks meet at the origin corner of a chart: their line boxes touch, the digits do not. */
const CORNER = 'text "0,0" x text "0,0"';
const overlapsOf = async (page: Page) => (await overlaps(page, LABELS)).filter((o) => o !== CORNER);

async function geometry(page: Page) {
  expect(await overlapsOf(page)).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .tf-scene .formula`)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

test('tfidf-kosinus: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('TF-IDF ve kosinüs benzerliği');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [1, 5, 6, 8]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`tfidf-kosinus-ders-${n}.png`);
  }
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

test('lab: a fourth document joins the ranking; arrows and space stay in the box', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 8);
  const rows = page.locator('.sim-row');
  const before = await rows.count();
  const box = page.locator('input[type="text"][data-param="extra"]');
  await expect(box).toBeVisible();
  await box.click();
  await box.fill('internet bağlantısı çok iyi ve hızlı');
  await box.press('ArrowRight');
  await box.press('Space');
  await expect(page.locator('.step-count')).toHaveText(`Adım 8 / ${STEPS}`);
  await expect(rows).toHaveCount(before + 1);
  await settled(() => page.locator('.tf-scene').innerHTML());
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('tfidf-kosinus-lab-8.png');
});
