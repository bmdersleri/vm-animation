import { test, expect } from '@playwright/test';

test('k-secimi: page opens', async ({ page }) => {
  await page.goto('/k-secimi/');
  await expect(page.locator('h1.title')).toHaveText('k sayısının seçimi');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
