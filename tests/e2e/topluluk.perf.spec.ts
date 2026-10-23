import { test, expect, type Page } from '@playwright/test';
import { open, p95, round, settled } from './helpers';

/** Drags the slider thumb from end to end and back `passes` times, one frame per move. */
async function drag(page: Page, key: string, measure: string, passes: number, scene: string) {
  const slider = page.locator(`input[data-param="${key}"]`);
  await expect(slider).toBeVisible();
  const box = (await slider.boundingBox())!;
  await page.evaluate((m) => performance.clearMeasures(m), measure);
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await page.mouse.down();
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i <= 60; i++) {
      const t = pass % 2 === 0 ? i / 60 : 1 - i / 60;
      await page.mouse.move(box.x + 3 + (box.width - 6) * t, box.y + box.height / 2);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }
  }
  await page.mouse.up();
  await settled(() => page.locator(scene).innerHTML());
  return page.evaluate((m) => performance.getEntriesByName(m).map((e) => e.duration), measure);
}

test('bagging step 7: tree count drag repaints the vote map within 25 ms', async ({ page }, info) => {
  await open(page, '/bagging/', 'lab', 'svg.bagging-plot');
  await page.locator('.step-dot').nth(6).click();
  await expect(page.locator('.bagging-stage')).toHaveAttribute('data-step', 'oylama');
  await expect(page.locator('.formula')).toContainText('50 ağaç', { timeout: 15_000 });
  await settled(() => page.locator('.bagging-scene').innerHTML());
  const durations = await drag(page, 'trees', 'bagging-render', 2, '.bagging-scene');
  const detail = `bagging-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});

test('random forest step 4: max_features drag renders within 25 ms', async ({ page }, info) => {
  await open(page, '/random-forest/', 'lab', 'svg.rf-plot');
  await page.locator('.step-dot').nth(3).click();
  await expect(page.locator('.rf-stage')).toHaveAttribute('data-step', 'max-features');
  await expect(page.locator('.formula')).toContainText('max_features = 8', { timeout: 15_000 });
  await settled(() => page.locator('.rf-scene').innerHTML());
  // the slider has eight stops: many passes give enough renders
  const durations = await drag(page, 'maxFeatures', 'rf-render', 12, '.rf-scene');
  const detail = `rf-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});
