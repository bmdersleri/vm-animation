import { test, expect } from '@playwright/test';

test('olcekleme: page opens', async ({ page }) => {
  await page.goto('/olcekleme/');
  await expect(page.locator('h1.title')).toHaveText('Ölçekleme ve veri sızıntısı');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
