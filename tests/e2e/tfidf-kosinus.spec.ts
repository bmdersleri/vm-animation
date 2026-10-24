import { test, expect } from '@playwright/test';

test('tfidf-kosinus: page opens', async ({ page }) => {
  await page.goto('/tfidf-kosinus/');
  await expect(page.locator('h1.title')).toHaveText('TF-IDF ve kosinüs benzerliği');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
