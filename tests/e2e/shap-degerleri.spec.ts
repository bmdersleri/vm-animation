import { test, expect } from '@playwright/test';

test('shap-degerleri: page opens', async ({ page }) => {
  await page.goto('/shap-degerleri/');
  await expect(page.locator('h1.title')).toHaveText('SHAP: Shapley değerleriyle katkı');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
