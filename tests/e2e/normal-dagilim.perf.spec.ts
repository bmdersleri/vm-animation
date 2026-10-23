import { test, expect } from '@playwright/test';
import { open, p95, round, settled } from './helpers';

test('normal sigma slider renders within 25 ms', async ({ page }, info) => {
  await open(page, '/normal-dagilim/', 'lab', 'svg.normal-plot path.hist-bar');
  await page.locator('.step-dot').nth(2).click();
  await expect(page.locator('svg.normal-plot')).toHaveAttribute('data-view', 'mu-sigma');
  await settled(() => page.locator('.normal-scene').innerHTML());
  const slider = page.locator('input[data-param="sigma"]');
  const box = (await slider.boundingBox())!;
  await page.evaluate(() => performance.clearMeasures('normal-render'));
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(box.x + 3 + (box.width - 6) * i / 60, box.y + box.height / 2);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  }
  await page.mouse.up();
  await settled(() => page.locator('.normal-scene').innerHTML());
  const durations = await page.evaluate(() => performance.getEntriesByName('normal-render').map(e => e.duration));
  const detail = `normal-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
  await expect(slider).toHaveValue('20');
});
