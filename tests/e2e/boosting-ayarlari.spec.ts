import { test, expect } from '@playwright/test';

test('boosting-ayarlari: page opens', async ({ page }) => {
  await page.goto('/boosting-ayarlari/');
  await expect(page.locator('h1.title')).toHaveText('Boosting ayarları: öğrenme oranı, erken durdurma, arama');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
