import { test, expect } from '@playwright/test';

test('home lists 20 concepts and the k-NN card opens the k-NN page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(20);
  await page.locator('a.card.hazir').first().click();
  await expect(page).toHaveURL(/\/knn\/$/);
  await expect(page.locator('.step-count')).toHaveText('Adım 1 / 12');
  await expect(page.locator('svg.plot circle.pt').first()).toBeAttached();
});
