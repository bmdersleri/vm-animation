import { test, expect } from '@playwright/test';

test('model-kaymasi: page opens', async ({ page }) => {
  await page.goto('/model-kaymasi/');
  await expect(page.locator('h1.title')).toHaveText('Model kayması ve izleme eşiği');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
