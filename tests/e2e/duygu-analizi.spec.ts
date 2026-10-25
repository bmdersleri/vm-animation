import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/duygu-analizi/';
const READY = '.sa-stage';
const IDS = ['gorev', 'boru-hatti', 'kelime-agirlik', 'yorum-skor', 'test-sonuc', 'bigram', 'degil-tuzagi', 'sizinti', 'sozluk-kaymasi', 'hata-ayiklama'];
const STEPS = IDS.length;
/** Labels and chips whose boxes must not run into each other (leaf elements only). */
const LABELS = '.sa-stage svg text:not(.probe), .sa-stage .token-chip, .sa-stage .vocab-term, .sa-stage .vocab-idf, .sa-stage .metric-label, .sa-stage .metric-value';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.sa-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.sa-scene').innerHTML());
}

/**
 * Pairs whose line boxes touch at a chart corner while the glyphs do not (checked in the screenshots):
 * the sigmoid's "0,0" y tick against its "-4" x tick, and the middle "0" x tick against the "z" axis title.
 */
const TOUCHING = new Set(['text "0,0" x text "0,0"', 'text "−4" x text "0,0"', 'text "0" x axis-title x "z"']);
const overlapsOf = async (page: Page) => (await overlaps(page, LABELS)).filter((o) => !TOUCHING.has(o));

async function geometry(page: Page) {
  expect(await overlapsOf(page)).toEqual([]);
  expect(await outsideStage(page, `${LABELS}, .sa-scene .formula`)).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

test('duygu-analizi: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Duygu analizi: TF-IDF ve lojistik regresyon');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [3, 4, 7, 8]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`duygu-analizi-ders-${n}.png`);
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

test('lab: a typed comment and the bigram switch change the score; arrows and space stay in the box', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 4);
  const box = page.locator('input[type="text"][data-param="text"]');
  await expect(box).toBeVisible();
  await box.click();
  await box.fill('hizmet kötü değil');
  await box.press('ArrowRight');
  await box.press('Space');
  await expect(page.locator('.step-count')).toHaveText(`Adım 4 / ${STEPS}`);
  await expect(page.locator('.comment-text')).toContainText('hizmet kötü değil');
  await settled(() => page.locator('.sa-scene').innerHTML());
  const unigram = await page.locator('.prob-value').innerText();
  const bigram = page.locator('input[data-param="bigram"]');
  await bigram.check();
  await settled(() => page.locator('.sa-scene').innerHTML());
  await expect(page.locator('.token-chip.is-bigram').first()).toBeVisible();
  expect(await page.locator('.prob-value').innerText()).not.toEqual(unigram);
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  await expect(page).toHaveScreenshot('duygu-analizi-lab-4.png');
});
