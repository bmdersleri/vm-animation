import { test, expect } from '@playwright/test';

test('random-forest: page opens', async ({ page }) => {
  await page.goto('/random-forest/');
  await expect(page.locator('h1.title')).toHaveText('Random Forest, OOB ve öznitelik önemi');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
