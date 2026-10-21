import { test, expect } from '@playwright/test';

test('ozellik-secimi: page opens', async ({ page }) => {
  await page.goto('/ozellik-secimi/');
  await expect(page.locator('h1.title')).toHaveText('Özellik seçimi: filtre ve sarmalayıcı');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
