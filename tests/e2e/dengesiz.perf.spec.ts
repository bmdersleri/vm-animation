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

test('dengesiz-veri step 9: target ratio drag (SMOTE + Newton refit) renders within 25 ms', async ({ page }, info) => {
  await open(page, '/dengesiz-veri/', 'lab', 'svg.imb-plot');
  await page.locator('.step-dot').nth(8).click();
  await expect(page.locator('.imb-stage')).toHaveAttribute('data-step', 'sinir');
  await page.locator('select[data-param="method"]').selectOption('smote');
  await settled(() => page.locator('.imb-scene').innerHTML());
  const durations = await drag(page, 'ratio', 'imb-render', 4, '.imb-scene');
  const detail = `imb-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});

test('smote-sizinti step 8: threshold drag renders within 25 ms', async ({ page }, info) => {
  await open(page, '/smote-sizinti/', 'lab', 'svg.leak-plot');
  await page.locator('.step-dot').nth(7).click();
  await expect(page.locator('.leak-stage')).toHaveAttribute('data-step', 'esik');
  await settled(() => page.locator('.leak-scene').innerHTML());
  const durations = await drag(page, 'threshold', 'leak-render', 2, '.leak-scene');
  const detail = `leak-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});
