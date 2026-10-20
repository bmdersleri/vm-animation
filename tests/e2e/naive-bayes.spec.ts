import { test, expect } from '@playwright/test';

test('naive-bayes: page opens', async ({ page }) => {
  await page.goto('/naive-bayes/');
  await expect(page.locator('h1.title')).toHaveText('Naive Bayes');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
