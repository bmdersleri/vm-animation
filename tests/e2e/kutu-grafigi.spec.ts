import { test, expect } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the kutu-grafigi page, checked in a real
 * browser at 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Performance budgets live in eda.perf.spec.ts.
 */

const PAGE = '/kutu-grafigi/';
const READY = 'svg.kutu-plot rect.box';
const STEPS = 8;
const LABELS = '.group-label, .fence-alt-label, .fence-clip-label, .kutu-link-text';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('path.violin')).toHaveCount(3);
  await expect(page.locator('a.kutu-link')).toHaveCount(1);
  await expect(page.locator('.formula')).toContainText('n = 5: yoğunluk tahmini zayıf');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const min: Record<string, number> = {};
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 1200);
    const m: Record<string, number[]> = {
      big: [...(await fontSizes(page, '.formula')), ...(await fontSizes(page, '.formula *')), ...(await fontSizes(page, '.step-term'))],
      title: await fontSizes(page, '.step-title'),
      small: await fontSizes(page, '.tick text, .axis-title, .group-label, .fence-alt-label, .fence-clip-label, .kutu-link-text'),
    };
    expect(m.title.length, `step ${step + 1} title`).toBeGreaterThan(0);
    expect(m.big.length, `step ${step + 1} formula`).toBeGreaterThan(0);
    expect(m.small.length, `step ${step + 1} labels`).toBeGreaterThan(0);
    for (const fs of m.big) expect(fs, `step ${step + 1} formula text`).toBeGreaterThanOrEqual(22);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.small) expect(fs, `step ${step + 1} label`).toBeGreaterThanOrEqual(18);
    for (const k of Object.keys(m)) if (m[k].length) min[`${step + 1}.${k}`] = Math.min(...m[k]);
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(min) });
  console.log('ders min font-size px', JSON.stringify(min));
});

test('ders: no page scroll and nothing offscreen', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 1200);
    const o = await pageOverflow(page);
    expect(o.x, `step ${step + 1} x overflow`).toBeLessThanOrEqual(0);
    expect(o.y, `step ${step + 1} y overflow`).toBeLessThanOrEqual(0);
    expect(await outsideStage(page, '.kutu-scene text, .kutu-scene .formula'), `step ${step + 1}`).toEqual([]);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.formula')].filter((f) => f.scrollWidth > f.clientWidth).map((f) => f.textContent));
    expect(wide, `step ${step + 1} formula clipped`).toEqual([]);
  }
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: labels never overlap`, async ({ page }) => {
    await open(page, PAGE, mode, READY);
    for (let step = 0; step < STEPS; step++) {
      if (step > 0) await gotoStep(page, step, STEPS, 1200);
      expect(await overlaps(page, LABELS), `step ${step + 1}`).toEqual([]);
    }
  });
}

test('ders: step 6 marks exactly the two marks outside the fences', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 5, STEPS, 1200);
  await expect(page.locator('path.outlier')).toHaveCount(2);
  await expect(page.locator('path.outlier[data-group="bilgisayar"]')).toHaveAttribute('data-value', '98');
  await expect(page.locator('path.outlier[data-group="elektrik"]')).toHaveAttribute('data-value', '55');
  await expect(page.locator('.formula')).toContainText('98 > 94 · 55 < 56 → aykırı');
});

test('ders: step 7 adds the third box beside the two it compares', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 6, STEPS, 1200);
  // every box exists from the first draw at opacity 0; only the shown ones are opaque
  const shown = await page.locator('svg.kutu-plot rect.box').evaluateAll((els) =>
    els.filter((e) => getComputedStyle(e).opacity !== '0').map((e) => e.getAttribute('data-group')));
  expect(shown.sort()).toEqual(['bilgisayar', 'elektrik', 'makine']);
  await expect(page.locator('svg.kutu-plot rect.box[data-group="makine"]')).toHaveCount(1);
  await expect(page.locator('.formula')).toContainText('medyan 72 = 72 · IQR 12 > 8');
});

test('lab: arrow keys on a focused drag handle move the handle, not the step', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS, 800);
  const svg = page.locator('svg.kutu-plot');
  const before = await svg.getAttribute('data-drag');
  await page.locator('circle.drag-handle[data-group="bilgisayar"]').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım 3 / ${STEPS}`);
  await expect(svg).not.toHaveAttribute('data-drag', before ?? '');
  expect(JSON.parse((await svg.getAttribute('data-drag')) ?? '{}')).toMatchObject({ bilgisayar: 96 });
});

test('lab: params card fits and hides closed groups', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 300);
    expect(await shownDisabledGroups(page), `step ${step + 1} disabled group shown`).toEqual([]);
    expect(await paramsOutside(page), `step ${step + 1} control outside the side column`).toEqual([]);
  }
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [['ders', 5], ['ders', 6], ['lab', 5]];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, 1800);
    await expect(page).toHaveScreenshot(`kutu-grafigi-${mode}-${step}.png`);
  }
});
