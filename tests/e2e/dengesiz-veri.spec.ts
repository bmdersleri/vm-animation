import { test, expect } from '@playwright/test';

test('dengesiz-veri: page opens', async ({ page }) => {
  await page.goto('/dengesiz-veri/');
  await expect(page.locator('h1.title')).toHaveText('Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf ağırlığı');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
