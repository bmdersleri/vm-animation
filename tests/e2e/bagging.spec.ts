import { test, expect } from '@playwright/test';

test('bagging: page opens', async ({ page }) => {
  await page.goto('/bagging/');
  await expect(page.locator('h1.title')).toHaveText('Bootstrap ve bagging');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
