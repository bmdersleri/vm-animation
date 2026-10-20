import { test, expect } from '@playwright/test';

test('karar-agaci: page opens', async ({ page }) => {
  await page.goto('/karar-agaci/');
  await expect(page.locator('h1.title')).toHaveText('Karar Ağacı');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
