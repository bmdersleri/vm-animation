import { test, expect } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the korelasyon-isi-haritasi page, checked in a
 * real browser at 1280×720: text readable from the back row, nothing off screen
 * or overlapping. Performance budgets live in eda.perf.spec.ts.
 */

const PAGE = '/korelasyon-isi-haritasi/';
const READY = 'svg.kor-plot g.panel';
const STEPS = 10;
// .col-label is rotated −45°: its axis-aligned box always touches its neighbours', so it is not checked here
const LABELS = '.panel-title, .panel-stats, .cell-text, .row-label, .legend-label, '
  + '.claim-title, .claim-body, .eda-title, .eda-body, .kor-rule, .kor-link-text, .leverage-hint, .drop-note';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('a.kor-link')).toHaveCount(3);
  await expect(page.locator('text.kor-rule')).toHaveText('Özet istatistik yeterli değildir, grafik şart.');
  await expect(page.locator('.formula')).toContainText('Özet istatistik yeterli değildir, grafik şart');
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
      small: await fontSizes(page, '.tick text, .axis-title, .panel-title, .panel-stats, .cell-text, .row-label, '
        + '.col-label, .legend-label, .claim-title, .claim-body, .eda-title, .eda-body, .kor-rule, .kor-link-text, .leverage-hint, .drop-note'),
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
    expect(await outsideStage(page, '.kor-scene text, .kor-scene .formula'), `step ${step + 1}`).toEqual([]);
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

test('ders: step 2 draws the trend line and r = 0,995', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 1, STEPS, 1200);
  await expect(page.locator('.formula')).toContainText('0,995');
  await expect(page.locator('svg.kor-plot path.trend')).toHaveCount(1);
});

test('ders: the quartet shows four panels under one shared summary', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 4, STEPS, 1200);
  await expect(page.locator('svg.kor-plot g.panel')).toHaveCount(4);
  await expect(page.locator('svg.kor-plot path.trend')).toHaveCount(4);
  const stats = page.locator('text.panel-stats');
  await expect(stats).toHaveCount(4);
  for (const t of await stats.allTextContents()) {
    expect(t).toContain('r ≈ 0,816');
    // the shared line is approximate by design (view.ts ANSCOMBE_SUMMARY); 7,5009 is in the step text
    expect(t).toContain('x̄ ≈ 9');
    expect(t).toContain('ȳ ≈ 7,5');
  }
  await expect(page.locator('.formula')).toContainText('aynı özet · dört farklı örüntü');
});

test('ders: dragging the leverage point to the top takes r to 0,958', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 5, STEPS, 1200);
  const lever = page.locator('svg.kor-plot circle.leverage');
  await expect(lever).toBeVisible();
  await expect(lever).toHaveAttribute('aria-valuenow', '12.5');
  const before = await page.locator('.kor-scene .formula').textContent();
  const circle = (await lever.boundingBox())!;
  const svg = (await page.locator('svg.kor-plot').boundingBox())!;
  const start = { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2 };
  const end = { x: start.x, y: svg.y + 6 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(start.x, start.y + ((end.y - start.y) * i) / 20);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(800);
  await expect(lever).toHaveAttribute('aria-valuenow', '20');
  const after = await page.locator('.kor-scene .formula').textContent();
  expect(after).not.toBe(before);
  await expect(page.locator('.kor-scene .formula')).toContainText('tek nokta y = 20 · r = 0,958');
});

test('ders: step 8 puts the numeric-coded churn column in the matrix', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 7, STEPS, 1200);
  await expect(page.locator('rect.cell')).toHaveCount(25);
  await expect(page.locator('text.row-label[data-var="churn"]')).toHaveCount(1);
  await expect(page.locator('text.col-label[data-var="churn"]')).toHaveCount(1);
  await expect(page.locator('.formula')).toContainText('churn 0/1 →');
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
  const shots: Array<['ders' | 'lab', number]> = [['ders', 5], ['ders', 6], ['ders', 8], ['lab', 6]];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, 1800);
    await expect(page).toHaveScreenshot(`korelasyon-isi-haritasi-${mode}-${step}.png`);
  }
});
