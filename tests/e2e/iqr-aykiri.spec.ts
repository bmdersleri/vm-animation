import { test, expect } from '@playwright/test';

test('iqr-aykiri: page opens', async ({ page }) => {
  await page.goto('/iqr-aykiri/');
  await expect(page.locator('h1.title')).toHaveText('Eksik veri ve IQR ile aykırı değer');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
