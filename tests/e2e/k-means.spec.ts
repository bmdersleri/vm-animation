import { test, expect } from '@playwright/test';

test('k-means: page opens', async ({ page }) => {
  await page.goto('/k-means/');
  await expect(page.locator('h1.title')).toHaveText('K-Means döngüsü');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
