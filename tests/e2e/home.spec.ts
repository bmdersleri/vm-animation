import { test, expect } from '@playwright/test';

test('home lists 20 concepts and the k-NN card opens the k-NN page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(20);
  await page.locator('a.card.hazir[href$="knn/"]').click();
  await expect(page).toHaveURL(/\/knn\/$/);
  await expect(page.locator('.step-count')).toHaveText('Adım 1 / 12');
  await expect(page.locator('svg.plot circle.pt').first()).toBeAttached();
});

test('the karar-agaci and naive-bayes cards open their pages', async ({ page }) => {
  const pages = [
    { href: 'karar-agaci/', steps: 12, scene: '.cards-layer .card' },
    { href: 'naive-bayes/', steps: 13, scene: 'canvas.icons[data-cell-px]' },
  ];
  for (const p of pages) {
    await page.goto('/');
    await page.locator(`a.card.hazir[href$="${p.href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${p.href}$`));
    await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${p.steps}`);
    await expect(page.locator(p.scene).first()).toBeVisible();
  }
});

test('both pages link a favicon that loads', async ({ page, request }) => {
  for (const path of ['/', '/knn/']) {
    await page.goto(path);
    // a root-absolute href would load here but 404 under the Pages sub-path
    expect(await page.locator('link[rel="icon"]').getAttribute('href')).not.toMatch(/^\//);
    const href = await page.locator('link[rel="icon"]').evaluate((l: HTMLLinkElement) => l.href);
    const res = await request.get(href);
    expect(res.status(), `${path} → ${href}`).toBe(200);
    expect(res.headers()['content-type']).toContain('svg');
  }
});
