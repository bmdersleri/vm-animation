import { test, expect } from '@playwright/test';
const TITLE = 'Karmaşıklık matrisi ve metrikler';
async function settle(page: import('@playwright/test').Page) { await page.waitForTimeout(750); }

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: eight visible teaching moments, keyboard, reset and mode switch`, async({page},testInfo)=> {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/karmasiklik-matrisi/?mod=${mode}`);
    await expect(page.locator('h1.title')).toHaveText(TITLE);
    await expect(page.locator('.matrix-customer')).toHaveCount(100);
    await expect(page.locator('.matrix-key')).toContainText('Pozitif: Ayrılan müşteri (churn=1)');
    await page.screenshot({ path:testInfo.outputPath(`matrix-${mode}-beginning.png`) });
    const first = await page.locator('[data-customer="N1"]').getAttribute('transform');
    const expected = ['TN', 'TN', '%86', '%37,5', '%60', '%46,15', 'hiçbiri yakalanmıyor', '10 × 1 + 4 × 5 = 30'];
    for (let step = 1; step < 8; step++) {
      await page.locator('.step-dot').nth(step).click();
      await expect(page.locator('.matrix-scene')).toHaveAttribute('data-step', String(step));
      await expect(page.locator('.stage')).toContainText(expected[step]);
      if (step === 1) expect(await page.locator('[data-customer="N1"]').getAttribute('transform')).not.toBe(first);
      if (step >= 2 && step <= 5) {
        await expect(page.locator('.matrix-formula')).toBeVisible();
        await expect(page.locator('[data-cell][data-highlight="true"]')).toHaveCount(step === 5 ? 3 : 2);
      }
      const geometry = await page.evaluate(() => {
        const stage = document.querySelector('.stage')!.getBoundingClientRect();
        const bad = [...document.querySelectorAll('.matrix-plot text, .matrix-formula, .matrix-note, .matrix-comparison, .matrix-costs')]
          .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1 || r.bottom > stage.bottom + 1); })
          .map(e => e.textContent);
        return { bad, overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight - innerHeight };
      });
      expect(geometry.bad, `step ${step + 1}`).toEqual([]);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      expect(geometry.height).toBeLessThanOrEqual(0);
    }
    await page.screenshot({ path:testInfo.outputPath(`matrix-${mode}-dense.png`) });
    await page.keyboard.press('Home');
    await expect(page.locator('.step-count')).toHaveText('Adım 1 / 8');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.step-count')).toHaveText('Adım 2 / 8');
    await page.locator(`[data-mode-btn="${mode === 'ders' ? 'lab' : 'ders'}"]`).click();
    await expect(page.locator('#app')).toHaveAttribute('data-mode', mode === 'ders' ? 'lab' : 'ders');
    await page.keyboard.press('P');
    await expect(page.locator('.play')).toHaveAttribute('aria-label', 'Duraklat');
    await page.keyboard.press('P');
    await expect(page.locator('.play')).toHaveAttribute('aria-label', 'Oynat');
  });
}

test('lab: live counts, same-cohort costs, null ratios and navigation reset', async({page},testInfo)=> {
  await page.goto('/karmasiklik-matrisi/?mod=lab');
  await page.locator('.step-dot').nth(7).click();
  for (const [key, value] of [['tn', '20'], ['fp', '3'], ['fn', '2'], ['tp', '5'], ['fpCost', '2'], ['fnCost', '7']]) await page.locator(`input[name="${key}"]`).fill(value);
  await expect(page.locator('[data-cost="model"]')).toHaveText('Kaynak model: 3 × 2 + 2 × 7 = 20');
  await expect(page.locator('[data-cost="dummy"]')).toHaveText('Herkese kalır: 0 × 2 + 7 × 7 = 49');
  await page.locator('select[name="model"]').selectOption('dummy');
  await expect(page.locator('[data-cell="tn"] .matrix-count')).toHaveText('23');
  await expect(page.locator('[data-cell="fn"] .matrix-count')).toHaveText('7');
  await expect(page.locator('.matrix-customer')).toHaveCount(30);
  await page.locator('.step-dot').nth(3).click();
  await expect(page.locator('input[name="tp"]')).toHaveValue('6');
  await expect(page.locator('.matrix-formula')).toContainText('6 / (6 + 10) = %37,5');
  for (const [key, value] of [['tn', '20'], ['fp', '3'], ['fn', '2'], ['tp', '5']]) await page.locator(`input[name="${key}"]`).fill(value);
  await expect(page.locator('.matrix-formula')).toContainText('5 / (5 + 3) = %62,5');
  await expect(page.locator('[data-metric="accuracy"] strong')).toHaveText('%83,33');
  await expect(page.locator('[data-metric="recall"] strong')).toHaveText('%71,43');
  await expect(page.locator('[data-metric="f1"] strong')).toHaveText('%66,67');
  for (const key of ['tn', 'fp', 'fn', 'tp']) await page.locator(`input[name="${key}"]`).fill('0');
  await expect(page.locator('.matrix-formula')).toContainText('— (tanımsız)');
  await expect(page.locator('.matrix-note')).toContainText('Müşteri yok');
  await expect(page.locator('.stage')).not.toContainText(/NaN|Infinity/);
});

test('ders panel and narrow lab keep the scene readable', async({page},testInfo)=> {
  await page.goto('/karmasiklik-matrisi/?mod=ders');
  await page.locator('.step-dot').nth(7).click();
  await page.locator('.params-toggle').click();
  await settle(page);
  const separated = await page.evaluate(() => document.querySelector('.stage')!.getBoundingClientRect().right <= document.querySelector('.params')!.getBoundingClientRect().left);
  expect(separated).toBe(true);
  await page.locator('[data-mode-btn="lab"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const outside = await page.evaluate(() => {
    const b = document.querySelector('.stage')!.getBoundingClientRect();
    return [...document.querySelectorAll('.matrix-plot text')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < b.left || r.right > b.right || r.bottom > b.bottom); }).map(e => e.textContent);
  });
  expect(outside).toEqual([]);
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode} 390 px: customer marks never overlap; count-only cells when they do not fit`, async({page},testInfo)=> {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/karmasiklik-matrisi/?mod=${mode}`);
    for (let step = 0; step < 8; step++) {
      await page.locator('.step-dot').nth(step).click();
      await expect(page.locator('.matrix-scene')).toHaveAttribute('data-step', String(step));
      const state = await page.evaluate(() => {
        const marks = [...document.querySelectorAll<SVGGElement>('.matrix-customer')].map(n => { const r = n.querySelector('.prediction-ring')!.getBoundingClientRect(); return { cell: n.dataset.outcome, x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width }; });
        let close = 0;
        for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
          const a = marks[i], b = marks[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < Math.min(a.d, b.d) - 0.5) close++;
        }
        const counts = [...document.querySelectorAll('[data-cell] .matrix-count')].map(n => n.textContent);
        return { aggregate: document.querySelector<HTMLElement>('.matrix-scene')!.dataset.aggregate, marks: marks.length, close, counts, note: document.querySelector('.matrix-note')!.textContent };
      });
      expect(state.close, `${mode} step ${step + 1}: overlapping marks`).toBe(0);
      if (state.aggregate === 'true') { expect(state.marks).toBe(0); expect(state.note).toContain('tam sayım'); }
      if (step >= 1) expect(state.counts.every(c => /^\d+$/.test(c ?? ''))).toBe(true);
      if (step === 2 || step === 6) await page.screenshot({ path:testInfo.outputPath(`matrix-${mode}-narrow-${step + 1}.png`), fullPage: true });
    }
  });
}
