import { test, expect } from '@playwright/test';

test('pca: page opens', async ({ page }) => {
  await page.goto('/pca/');
  await expect(page.locator('h1.title')).toHaveText('PCA ve t-SNE ile boyut indirgeme');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
