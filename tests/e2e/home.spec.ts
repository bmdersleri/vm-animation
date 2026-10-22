import { test, expect } from '@playwright/test';

test('home lists 23 concepts and the k-NN card opens the k-NN page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(23);
  await page.locator('a.card.hazir[href$="knn/"]').click();
  await expect(page).toHaveURL(/\/knn\/$/);
  await expect(page.locator('.step-count')).toHaveText('Adım 1 / 12');
  await expect(page.locator('svg.plot circle.pt').first()).toBeAttached();
});

test('the chapter 3, 4 and 5 cards open their pages', async ({ page }) => {
  const pages = [
    { href: 'karar-agaci/', steps: 12, scene: '.cards-layer .card' },
    { href: 'naive-bayes/', steps: 13, scene: 'canvas.icons[data-cell-px]' },
    { href: 'iqr-aykiri/', steps: 11, scene: 'svg.iqr-plot circle.pt' },
    { href: 'olcekleme/', steps: 13, scene: 'svg.scale-plot circle.pt.cust' },
    { href: 'pca/', steps: 13, scene: 'svg.pca-plot path.pts' },
    { href: 'ozellik-secimi/', steps: 10, scene: 'svg.secim-plot g.row path.dots' },
  ];
  for (const p of pages) {
    await page.goto('/');
    await page.locator(`a.card.hazir[href$="${p.href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${p.href}$`));
    await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${p.steps}`);
    await expect(page.locator(p.scene).first()).toBeVisible();
  }
});

test('the chapter 2 cards open their pages and walk every Ders step', async ({ page }) => {
  const pages = [
    { href: 'dagilim-carpiklik/', steps: 9, scene: 'svg.dag-plot path.hist-bar', title: 'Dağılım, ortalama–medyan ve çarpıklık' },
    { href: 'korelasyon-isi-haritasi/', steps: 10, scene: 'svg.kor-plot g.panel', title: 'Korelasyon, ısı haritası ve Anscombe Dörtlüsü' },
    { href: 'kutu-grafigi/', steps: 8, scene: 'svg.kutu-plot rect.box', title: 'Kutu grafiği: çeyrekler ve aykırı değerler' },
  ];
  for (const p of pages) {
    await page.goto('/');
    await page.locator(`a.card.hazir[href$="${p.href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${p.href}$`));
    await page.locator('[data-mode-btn="ders"]').click();
    await expect(page.locator('[data-mode="ders"]').first()).toBeVisible();
    await expect(page.locator('h1.title')).toHaveText(p.title);
    await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${p.steps}`);
    await expect(page.locator(p.scene).first()).toBeAttached();
    for (let i = 1; i < p.steps; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.step-count')).toHaveText(`Adım ${i + 1} / ${p.steps}`);
    }
    await page.waitForTimeout(1200);
    await expect(page.locator(p.scene).first()).toBeAttached();
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
