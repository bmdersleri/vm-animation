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

test('gradient boosting step 7: tree count drag repaints within 25 ms', async ({ page }, info) => {
  await open(page, '/gradyan-artirma/', 'lab', 'svg.gb-plot');
  await page.locator('.step-dot').nth(6).click();
  await expect(page.locator('.gb-stage')).toHaveAttribute('data-step', 'durma');
  await settled(() => page.locator('.gb-scene').innerHTML());
  const durations = await drag(page, 'trees', 'gb-render', 2, '.gb-scene');
  const detail = `gb-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});

test('boosting settings step 8: leaf count drag renders within 25 ms', async ({ page }, info) => {
  await open(page, '/boosting-ayarlari/', 'lab', 'svg.tune-plot');
  await page.locator('.step-dot').nth(7).click();
  await expect(page.locator('.tune-stage')).toHaveAttribute('data-step', 'yaprak-siniri');
  await settled(() => page.locator('.tune-scene').innerHTML());
  const durations = await drag(page, 'leaves', 'tune-render', 2, '.tune-scene');
  const detail = `tune-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});
