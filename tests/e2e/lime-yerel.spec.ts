import { test, expect } from '@playwright/test';

test('lime-yerel: page opens', async ({ page }) => {
  await page.goto('/lime-yerel/');
  await expect(page.locator('h1.title')).toHaveText('LIME: yerel vekil model ve SHAP ile karşılaştırma');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
