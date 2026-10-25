import { test, expect, type Page } from '@playwright/test';
import { open, p95, round, settled } from './helpers';

/** Alternates a select between two customers `n` times and returns the scene's render measures. */
async function switchCustomer(page: Page, measure: string, scene: string, rows: string[], n: number) {
  const select = page.locator('select[data-param="customer"]');
  await expect(select).toBeVisible();
  await page.evaluate((m) => performance.clearMeasures(m), measure);
  for (let i = 0; i < n; i++) {
    await select.selectOption(rows[i % rows.length]);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
  await settled(() => page.locator(scene).innerHTML());
  return page.evaluate((m) => performance.getEntriesByName(m).map((e) => e.duration), measure);
}

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

test('shap-degerleri step 5: switching the customer recomputes the orderings within 25 ms', async ({ page }, info) => {
  await open(page, '/shap-degerleri/', 'lab', '.shap-stage');
  await page.locator('.step-dot').nth(4).click();
  await expect(page.locator('.shap-stage')).toHaveAttribute('data-step', 'alti-siralama');
  await settled(() => page.locator('.shap-scene').innerHTML());
  const durations = await switchCustomer(page, 'shap-render', '.shap-scene', ['77', '301'], 40);
  const detail = `shap-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});

test('lime-yerel step 6: the kernel width slider refits the surrogate within 25 ms', async ({ page }, info) => {
  await open(page, '/lime-yerel/', 'lab', '.lime-stage');
  await page.locator('.step-dot').nth(5).click();
  await expect(page.locator('.lime-stage')).toHaveAttribute('data-step', 'vekil');
  await settled(() => page.locator('.lime-scene').innerHTML());
  const durations = await drag(page, 'width', 'lime-render', 2, '.lime-scene');
  const detail = `lime-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});
