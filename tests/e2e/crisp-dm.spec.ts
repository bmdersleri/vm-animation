import { test, expect } from '@playwright/test';

test('crisp-dm: page opens', async ({ page }) => {
  await page.goto('/crisp-dm/');
  await expect(page.locator('h1.title')).toHaveText('CRISP-DM döngüsü: altı evre ve geri dönüşler');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
