import { test, expect } from '@playwright/test';

test('smote-sizinti: page opens', async ({ page }) => {
  await page.goto('/smote-sizinti/');
  await expect(page.locator('h1.title')).toHaveText('SMOTE sızıntısı ve PR-AUC');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
