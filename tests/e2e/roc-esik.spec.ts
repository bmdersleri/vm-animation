import { test, expect } from '@playwright/test';
const SHOTS='.superpowers/sdd/2026-10-21-bolum6-model-degerlendirme/screenshots';
for(const mode of ['ders','lab'] as const) {
  test(`${mode}: ten visible scenes, controller, keyboard and no viewport overflow`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`/roc-esik/?mod=${mode}`);
    await expect(page.locator('h1.title')).toHaveText('ROC, PR ve karar eşiği');
    await expect(page.locator('[data-sample]')).toHaveCount(4);
    await page.screenshot({path:`${SHOTS}/roc-${mode}-beginning.png`});
    const expected=['kalibre olasılık','skor ≥ eşik','Recall artabilir','Precision','FPR yatay','Trapez alanı','AP:','PR referansı','Daha yüksek eşik','Test seçim döngüsüne'];
    for(let i=0;i<10;i++) {
      await page.locator('.step-dot').nth(i).click();await expect(page.locator('.roc-scene')).toHaveAttribute('data-step',String(i));
      await expect(page.locator('.roc-note')).toContainText(expected[i]);
      if(i===4)await expect(page.locator('[data-operating="roc"]')).toHaveAttribute('data-x','0.5');
      if(i===5)await expect(page.locator('[data-auc]')).toHaveText('AUC 0,625');
      if(i===6)await expect(page.locator('[data-ap]')).toHaveText('AP 0,583');
      if(i===4||i===6) {
        const shape=await page.locator(`[data-panel="${i===4?'roc':'pr'}"] svg`).evaluate(el=>{const r=el.getBoundingClientRect();return {height:r.height-64,ratio:(r.width-70)/(r.height-64)};});
        expect(shape.height).toBeGreaterThanOrEqual(160);expect(shape.ratio).toBeLessThanOrEqual(3.2);
      }
      if(i===4||i===6)await page.screenshot({path:`${SHOTS}/roc-${mode}-${i===4?'roc':'pr'}-teaching.png`});
      if(i===8)await page.screenshot({path:`${SHOTS}/roc-${mode}-dense.png`});
      const geometry=await page.evaluate(()=>{const b=document.querySelector('.stage')!.getBoundingClientRect();return {bad:[...document.querySelectorAll('.roc-scene p, .roc-strip text, .roc-plot text, .roc-cost-table, .roc-flow')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1);}).map(el=>el.textContent),overflow:document.documentElement.scrollWidth-innerWidth,height:document.documentElement.scrollHeight-innerHeight};});
      expect(geometry.bad,`step ${i+1}`).toEqual([]);expect(geometry.overflow).toBeLessThanOrEqual(0);expect(geometry.height).toBeLessThanOrEqual(0);
    }
    await page.keyboard.press('Home');await expect(page.locator('.step-count')).toHaveText('Adım 1 / 10');
    await page.keyboard.press('ArrowRight');await expect(page.locator('.step-count')).toHaveText('Adım 2 / 10');
    await page.keyboard.press('P');await expect(page.locator('.play')).toHaveAttribute('aria-label','Duraklat');await page.keyboard.press('P');
    await page.locator(`[data-mode-btn="${mode==='ders'?'lab':'ders'}"]`).click();await expect(page.locator('#app')).toHaveAttribute('data-mode',mode==='ders'?'lab':'ders');
  });
}
test('lab: tied scores, none-positive convention, dataset, costs and reset',async({page})=>{
  await page.goto('/roc-esik/?mod=lab');await page.locator('.step-dot').nth(6).click();
  const slider=page.locator('input[name="threshold"]');await slider.fill('0.81');
  await expect(page.locator('[data-count="tp"]')).toHaveText('0');
  await slider.focus();await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-count="tp"]')).toHaveText('1');await expect(page.locator('[data-count="fp"]')).toHaveText('1');
  await expect(page.locator('[data-operating="pr"]')).toHaveAttribute('data-x','0.5');
  await page.locator('input[name="nonePositive"]').check();
  await expect(page.locator('[data-precision]')).toContainText('tanımsız');await expect(page.locator('[data-operating="pr"]')).toHaveAttribute('data-y','1');
  await expect(page.locator('[data-convention]')).toContainText('precision=1');await expect(page.locator('[data-auc]')).toHaveText('AUC 0,625');
  await page.locator('.step-dot').nth(7).click();
  await page.locator('select[name="dataset"]').selectOption('imbalanced');await expect(page.locator('[data-sample]')).toHaveCount(12);
  await expect(page.locator('[data-prevalence]')).toContainText('%16,67');
  const scoreLabels=await page.locator('.roc-id').evaluateAll(nodes=>{const boxes=nodes.map(n=>n.getBoundingClientRect());return boxes.some((a,i)=>boxes.some((b,j)=>j>i&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));});
  expect(scoreLabels).toBe(false);
  await page.locator('.step-dot').nth(8).click();await expect(page.locator('.roc-cost-summary')).toContainText('Öneri 0,20 → maliyet 1. Varsayılan 0,50 → 6');
  await page.locator('input[name="fpCost"]').fill('0');await page.locator('input[name="fnCost"]').fill('0');
  await expect(page.locator('[data-best="true"]')).toHaveAttribute('data-candidate','none');
  await page.getByRole('button',{name:'Bu adımı sıfırla'}).click();await expect(page.locator('input[name="fnCost"]')).toHaveValue('5');
  await page.locator('.step-dot').nth(9).click();await expect(page.locator('[data-test-report]')).toContainText('dondurulan eşik 0,20');await expect(slider).toBeDisabled();
});
test('narrow lab and ders parameter panel remain readable',async({page})=>{
  await page.goto('/roc-esik/?mod=ders');await page.locator('.step-dot').nth(8).click();await page.locator('.params-toggle').click();
  expect(await page.evaluate(()=>document.querySelector('.stage')!.getBoundingClientRect().right<=document.querySelector('.params')!.getBoundingClientRect().left)).toBe(true);
  await page.locator('[data-mode-btn="lab"]').click();await page.setViewportSize({width:390,height:844});
  for(const index of [0,6,7,8,9]) {await page.locator('.step-dot').nth(index).click();await page.waitForTimeout(50);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
    const bad=await page.evaluate(()=>{const b=document.querySelector('.stage')!.getBoundingClientRect();return [...document.querySelectorAll('.roc-scene p,.roc-plot text,.roc-strip text')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<b.left-1||r.right>b.right+1||r.bottom>b.bottom+1);}).map(el=>el.textContent);});expect(bad,`narrow ${index}`).toEqual([]);
  }
});
