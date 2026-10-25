import { test, expect, type Page } from '@playwright/test';
import { open, p95, round, settled } from './helpers';

const TEXT = 'internet bağlantısı kesiliyor ve destek ekibi dönüş yapmadı fatura tutarı beklediğimden yüksek geldi hızlı çözüm iyi oldu';

/**
 * Types into a Lab text box one key at a time, slower than the box's 150 ms debounce so that every key
 * ends in one scene render (the measure is the render after the debounced write, not the keystroke).
 */
async function typeInto(page: Page, input: string, measure: string, scene: string) {
  const box = page.locator(input);
  await expect(box).toBeVisible();
  await box.click();
  await box.fill('');
  await settled(() => page.locator(scene).innerHTML());
  await page.evaluate((m) => performance.clearMeasures(m), measure);
  await box.pressSequentially(TEXT, { delay: 190 });
  await settled(() => page.locator(scene).innerHTML());
  return page.evaluate((m) => performance.getEntriesByName(m).map((e) => e.duration), measure);
}

test('tfidf-kosinus step 6: typing into a document box (TF-IDF recomputed) renders within 25 ms', async ({ page }, info) => {
  await open(page, '/tfidf-kosinus/', 'lab', '.tf-stage');
  await page.locator('.step-dot').nth(5).click();
  await expect(page.locator('.tf-stage')).toHaveAttribute('data-step', 'tfidf-norm');
  await settled(() => page.locator('.tf-scene').innerHTML());
  const durations = await typeInto(page, 'input[type="text"][data-param="doc-0"]', 'tf-render', '.tf-scene');
  const detail = `tf-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});

test('duygu-analizi step 4: typing a comment (score recomputed) renders within 25 ms', async ({ page }, info) => {
  await open(page, '/duygu-analizi/', 'lab', '.sa-stage');
  await page.locator('.step-dot').nth(3).click();
  await expect(page.locator('.sa-stage')).toHaveAttribute('data-step', 'yorum-skor');
  await settled(() => page.locator('.sa-scene').innerHTML());
  const durations = await typeInto(page, 'input[type="text"][data-param="text"]', 'sa-render', '.sa-scene');
  const detail = `sa-render n=${durations.length} p95=${round(p95(durations))} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'render', description: detail });
  console.log(detail);
  expect(durations.length).toBeGreaterThanOrEqual(25);
  expect(p95(durations)).toBeLessThanOrEqual(25);
});
