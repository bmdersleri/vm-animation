import { test, expect } from '@playwright/test';

test('gradyan-artirma: page opens', async ({ page }) => {
  await page.goto('/gradyan-artirma/');
  await expect(page.locator('h1.title')).toHaveText('Gradyan artırma: artıklarla düzeltme');
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \/ \d+/);
});
