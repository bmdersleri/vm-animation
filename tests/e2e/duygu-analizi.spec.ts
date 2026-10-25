import { test, expect } from '@playwright/test';

test('duygu-analizi: page opens', async ({ page }) => {
  await page.goto('/duygu-analizi/');
  await expect(page.locator('h1.title')).toHaveText('Duygu analizi: TF-IDF ve lojistik regresyon');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
