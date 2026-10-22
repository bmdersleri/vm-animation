import { test, expect } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the dagilim-carpiklik page, checked in a real
 * browser at 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Performance budgets live in eda.perf.spec.ts.
 */

const PAGE = '/dagilim-carpiklik/';
const READY = 'svg.dag-plot path.hist-bar';
const STEPS = 9;
const LABELS = '.mark-label, .bar-count, .bin-range, .log-note, .rule-title, .rule-body, .rule-link-text';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('g.rule')).toHaveCount(3);
  await expect(page.locator('a.rule-link')).toHaveCount(2);
  await expect(page.locator('.formula')).toContainText('|çarpıklık| < 0,5 ≈ simetrik');
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
      small: await fontSizes(page, '.tick text, .mark-label, .bar-count, .bin-range, .log-note, .rule-title, .rule-body, .rule-link-text'),
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
    expect(await outsideStage(page, '.dag-scene text, .dag-scene .formula'), `step ${step + 1}`).toEqual([]);
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

test('ders: the mean and median sit at 16,4 and 14,5 with the right tail shaded', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 3, STEPS, 1200);
  await expect(page.locator('g.mark.mean text.mark-label')).toHaveText('16,4');
  await expect(page.locator('g.mark.median text.mark-label')).toHaveText('14,5');
  await expect(page.locator('rect.tail-shade.right')).toHaveCount(1);
  await expect(page.locator('rect.tail-shade.left')).toHaveCount(0);
  await expect(page.locator('.formula')).toContainText('çarpıklık = 0,90 > 0: sağ kuyruk uzun');
});

test('ders: log1p takes the skewness 0,90 → 0,25', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 5, STEPS, 1200);
  await expect(page.locator('.formula')).toContainText('log1p: çarpıklık 0,90 → 0,25');
  await expect(page.locator('text.log-note')).toHaveText('1p · log1p');
});

test('ders: the tail step hands the outlier a handle and the statement follows it', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 6, STEPS, 1200);
  await expect(page.locator('circle.drag-handle')).toHaveCount(1);
  await expect(page.locator('.formula')).toContainText('uç değer 28 → ortalama 10,4');
  await page.keyboard.press('E');
  await page.waitForTimeout(600);
  await expect(page.locator('.formula')).toContainText('uç değer 60 → ortalama 13,6 · medyan 8,5 · çarpıklık 3,06');
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
  const shots: Array<['ders' | 'lab', number]> = [['ders', 2], ['ders', 4], ['ders', 6], ['lab', 7]];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, 1800);
    await expect(page).toHaveScreenshot(`dagilim-carpiklik-${mode}-${step}.png`);
  }
});
