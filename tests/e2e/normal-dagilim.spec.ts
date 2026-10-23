import { test, expect } from '@playwright/test';

test('normal-dagilim: page opens', async ({ page }) => {
  await page.goto('/normal-dagilim/');
  await expect(page.locator('h1.title')).toHaveText('Normal dağılım ve standart sapma');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
