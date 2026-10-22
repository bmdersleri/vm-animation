import { test, expect, type Page } from '@playwright/test';
import { concepts } from '../../src/concepts/registry';

test.use({ viewport: { width: 390, height: 844 } });

const ready = concepts.filter((c) => c.status === 'hazir' && c.href);

async function checkStep(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
  const box = await page.locator('.stage').boundingBox();
  expect(box, `${label}: stage box`).not.toBeNull();
  expect(box!.width, `${label}: stage width`).toBeLessThanOrEqual(390 + 1);
  // scenes are SVG, canvas or HTML cards; some steps hide a layer, so any visible layer counts
  const scene = page.locator('.stage :is(svg, canvas, div):visible').first();
  await expect(scene, `${label}: scene visible`).toBeVisible();
  const sb = await scene.boundingBox();
  expect(sb!.width, `${label}: scene width`).toBeGreaterThan(0);
  expect(sb!.height, `${label}: scene height`).toBeGreaterThan(0);
}

test('every ready page fits 390 px in Ders and Lab', async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(ready.length).toBeGreaterThanOrEqual(17);
  for (const c of ready) {
    for (const mode of ['ders', 'lab'] as const) {
      await page.goto(`/${c.href}?mod=${mode}`);
      await expect(page.locator(`[data-mode="${mode}"]`).first()).toBeVisible({ timeout: 15_000 });
      const dots = page.locator('.step-dot');
      const n = await dots.count();
      await checkStep(page, `${c.id} ${mode} step 1`);
      await dots.nth(n - 1).click();
      await expect(page.locator('.step-count')).toHaveText(new RegExp(`Adım ${n} / ${n}`));
      await page.waitForTimeout(300);
      await checkStep(page, `${c.id} ${mode} step ${n}`);
    }
  }
});

test('confusion matrix digits stay inside their cells at 390 px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const mode of ['ders', 'lab'] as const) {
    await page.goto(`/karmasiklik-matrisi/?mod=${mode}`);
    await page.locator('.step-dot').nth(6).click();
    await expect(page.locator('.matrix-scene')).toHaveAttribute('data-step', '6');
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const cell of document.querySelectorAll<SVGGElement>('[data-cell]')) {
        const bg = cell.querySelector<SVGRectElement>('.matrix-cell-bg')!.getBoundingClientRect();
        for (const t of cell.querySelectorAll<SVGTextElement>('.matrix-count')) {
          const r = t.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.left < bg.left - 0.5 || r.right > bg.right + 0.5 || r.top < bg.top - 0.5 || r.bottom > bg.bottom + 0.5) {
            out.push(`${cell.getAttribute('data-cell')} "${t.textContent}" text ${[r.left, r.top, r.right, r.bottom].map(Math.round)} cell ${[bg.left, bg.top, bg.right, bg.bottom].map(Math.round)}`);
          }
        }
      }
      return out;
    });
    expect(bad, mode).toEqual([]);
  }
});
