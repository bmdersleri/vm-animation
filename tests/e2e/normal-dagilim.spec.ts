import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const IDS = ['histogram', 'egri', 'mu-sigma', 'alan', 'kural', 'z-skor', 'carpik', 'olcekleme'];
const LABELS = '.normal-plot .mark-label, .normal-plot .ghost-label, .normal-plot .band-label, .normal-plot .marker-label, .normal-plot .scene-link text, .normal-plot .tick text, .normal-plot .axis-title';
test.use({ reducedMotion: 'reduce' });
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / 8`);
  await expect(page.locator('svg.normal-plot')).toHaveAttribute('data-view', IDS[n - 1]);
  await settled(() => page.locator('.normal-scene').innerHTML());
}
async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.normal-plot text:not(.probe), .normal-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}
async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.normal-scene').innerHTML());
}
for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: all steps fit and expose only active controls`, async ({ page }) => {
    await open(page, '/normal-dagilim/', mode, 'svg.normal-plot path.hist-bar');
    for (let n = 1; n <= 8; n++) {
      await step(page, n);
      await geometry(page);
      if (mode === 'lab') {
        expect(await paramsOutside(page)).toEqual([]);
        expect(await shownDisabledGroups(page)).toEqual([]);
      }
    }
  });
}
test('ders: key scenes and real continuation links', async ({ page }) => {
  await open(page, '/normal-dagilim/', 'ders', 'svg.normal-plot path.hist-bar');
  for (const n of [2, 5, 6, 7, 8]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`normal-dagilim-ders-${n}.png`);
    if (n === 2) await expect(page.locator('path.curve')).toHaveCount(1);
    if (n === 5) await expect(page.locator('path.band')).toHaveCount(3);
    if (n === 6) { await expect(page.locator('.z-axis')).toHaveCount(1); await expect(page.locator('.marker-label')).toContainText('85'); }
    if (n === 7) { await expect(page.locator('.mark.mean')).toHaveCount(1); await expect(page.locator('.mark.median')).toHaveCount(1); }
  }
  await expect(page.locator('.x-axis')).toHaveCount(0);
  await expect(page.locator('.z-axis')).toHaveCount(1);
  await expect(page.locator('a.scene-link')).toHaveCount(3);
  for (const target of ['dagilim-carpiklik', 'olcekleme', 'naive-bayes']) {
    const link = page.locator(`a.scene-link[href="../${target}/"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${target}/`));
    await expect(page.locator('h1.title')).toBeVisible();
    await page.goBack();
    await step(page, 8);
  }
});
test('lab: sigma and interval controls update curve and probability', async ({ page }) => {
  await open(page, '/normal-dagilim/', 'lab', 'svg.normal-plot path.hist-bar');
  await step(page, 3);
  const initial = await page.locator('path.curve').getAttribute('d');
  await setRange(page, 'sigma', '15');
  await expect(page.locator('path.curve')).not.toHaveAttribute('d', initial!);
  await expect(page.locator('.formula')).toContainText('15');
  await geometry(page);
  await expect(page).toHaveScreenshot('normal-dagilim-lab-3.png');
  await step(page, 4);
  await setRange(page, 'a', '80');
  await setRange(page, 'b', '60');
  await expect(page.locator('.formula')).toContainText('60');
  await expect(page.locator('.formula')).toContainText('80');
  await expect(page.locator('path.area')).toHaveAttribute('d', /.+/);
  await geometry(page);
  await expect(page).toHaveScreenshot('normal-dagilim-lab-4.png');
  await setRange(page, 'b', '80');
  await expect(page.locator('.formula')).toContainText('0,000');
});
