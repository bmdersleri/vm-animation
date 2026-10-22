import { test, expect } from '@playwright/test';

const pages = [
  { href: 'karmasiklik-matrisi/', steps: 8, scene: '.matrix-scene' },
  { href: 'roc-esik/', steps: 10, scene: '.roc-scene' },
  { href: 'capraz-dogrulama/', steps: 10, scene: '.cv-scene' },
];

test('the chapter 6 cards open their pages from the home page', async ({ page }) => {
  for (const p of pages) {
    await page.goto('/');
    await page.locator(`a.card.hazir[href$="${p.href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${p.href}$`));
    await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${p.steps}`);
    await expect(page.locator(p.scene).first()).toBeVisible();
  }
});

test('the chapter 6 Ders shortcuts open the pages in Ders mode', async ({ page }) => {
  for (const p of pages) {
    await page.goto('/');
    await page.locator(`a.card-ders[href="${p.href}?mod=ders"]`).click();
    await expect(page.locator(p.scene).first()).toBeVisible();
    await expect(page.locator('[data-mode="ders"]').first()).toBeVisible();
    expect(page.url().endsWith(`/${p.href}?mod=ders`)).toBe(true);
  }
});
