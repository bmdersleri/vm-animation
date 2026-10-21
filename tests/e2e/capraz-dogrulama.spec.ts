import { test, expect } from '@playwright/test';
const SHOTS='.superpowers/sdd/2026-10-21-bolum6-model-degerlendirme/screenshots';
for(const mode of ['ders','lab'] as const){
  test(`${mode}: ten visible moments, keyboard, reduced motion and no clipped content`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`/capraz-dogrulama/?mod=${mode}`);
    await expect(page.locator('h1.title')).toHaveText('Çapraz doğrulama ve veri sızıntısı');
    await expect(page.locator('[data-sample]')).toHaveCount(40);
    await expect(page.locator('[data-test-locked]')).toBeVisible();
    await page.screenshot({path:`${SHOTS}/cv-${mode}-beginning.png`});
    for(let i=0;i<10;i++){
      await page.locator('.step-dot').nth(i).click();await expect(page.locator('.cv-scene')).toHaveAttribute('data-step',String(i));
      if(i<9){await expect(page.locator('[data-test-locked]')).toBeVisible();await expect(page.locator('[data-test-outcome]')).toHaveCount(0);}
      if(i===1)await expect(page.locator('[data-fold-block]')).toHaveCount(5);
      if(i===2){await expect(page.locator('[data-sample][data-role="validation"]')).toHaveCount(8);await expect(page.locator('[data-fit="mean"]')).toBeVisible();}
      if(i===4)await expect(page.locator('.cv-membership').first()).toHaveText(/K[1-5]/);
      if(i===5){await expect(page.locator('[data-mean]')).toHaveText('0,688');await expect(page.locator('.cv-score-note')).toContainText('güven aralığı değildir');const r=await page.locator('.cv-score-plot').boundingBox();expect(r!.height).toBeGreaterThanOrEqual(180);}
      if(i===6)await expect(page.locator('[data-recall]')).toContainText('tanımsız');
      if(i===7)await expect(page.locator('[data-positive-fold="0"]')).toHaveAttribute('data-count','2');
      if(i===8){await expect(page.locator('[data-pipeline="correct"]')).toBeVisible();await expect(page.locator('[data-pipeline="wrong"]')).toBeVisible();await page.screenshot({path:`${SHOTS}/cv-${mode}-pipeline.png`});}
      if(i===9){await expect(page.locator('[data-test-f1]')).toHaveText('0,571');await expect(page.locator('[data-test-outcome]')).toHaveCount(15);await page.screenshot({path:`${SHOTS}/cv-${mode}-final.png`});}
      if(i===6)await page.screenshot({path:`${SHOTS}/cv-${mode}-dense.png`});
      const geometry=await page.evaluate(()=>{const b=document.querySelector('.stage')!.getBoundingClientRect();return {bad:[...document.querySelectorAll('.cv-scene p,.cv-scene h2,.cv-sample,.cv-score-plot text,.cv-positive-row,.cv-test-outcomes span')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1);}).map(el=>el.textContent),overflow:document.documentElement.scrollWidth-innerWidth,height:document.documentElement.scrollHeight-innerHeight};});
      expect(geometry.bad,`step ${i+1}`).toEqual([]);expect(geometry.overflow).toBeLessThanOrEqual(0);expect(geometry.height).toBeLessThanOrEqual(0);
    }
    await page.keyboard.press('Home');await expect(page.locator('.step-count')).toHaveText('Adım 1 / 10');
    await page.keyboard.press('ArrowRight');await expect(page.locator('.step-count')).toHaveText('Adım 2 / 10');
    await page.keyboard.press('P');await expect(page.locator('.play')).toHaveAttribute('aria-label','Duraklat');await page.keyboard.press('P');
    await page.locator(`[data-mode-btn="${mode==='ders'?'lab':'ders'}"]`).click();await expect(page.locator('#app')).toHaveAttribute('data-mode',mode==='ders'?'lab':'ders');
  });
}
test('lab: real K/method/fold/C values, atomic fold clamp, reset and fixed final protocol',async({page})=>{
  await page.goto('/capraz-dogrulama/?mod=lab');await page.locator('.step-dot').nth(8).click();
  await page.locator('[name="fold"]').selectOption('4');await page.locator('[name="k"]').selectOption('3');
  await expect(page.locator('[name="fold"]')).toHaveValue('2');await expect(page.locator('[name="fold"] option')).toHaveCount(3);
  await expect(page.locator('[data-active-fold]')).toHaveAttribute('data-active-fold','2');
  await expect(page.locator('.cv-scene')).toHaveAttribute('data-run','3-stratified-1');
  await page.locator('[name="method"]').selectOption('kfold');await page.locator('[name="c"]').selectOption('0.1');
  await expect(page.locator('.cv-scene')).toHaveAttribute('data-run','3-kfold-0.1');
  await expect(page.locator('[data-pipeline="correct"]')).toContainText('27 müşteri');
  await page.getByRole('button',{name:'Bu adımı sıfırla'}).click();await expect(page.locator('[name="k"]')).toHaveValue('5');
  await page.locator('[name="k"]').selectOption('3');await page.locator('[name="method"]').selectOption('kfold');
  await page.locator('.step-dot').nth(9).click();await expect(page.locator('.cv-scene')).toHaveAttribute('data-run','5-stratified-1');
  await expect(page.locator('[data-final-protocol]')).toContainText('K=5 · StratifiedKFold');
  await expect(page.locator('[name="k"]')).toBeDisabled();await expect(page.locator('[name="method"]')).toBeDisabled();
});
test('narrow ders and lab keep board, pipeline, score chart and final test readable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const mode of ['ders','lab']){
    await page.goto(`/capraz-dogrulama/?mod=${mode}`);
    for(const i of [0,3,5,6,8,9]){await page.locator('.step-dot').nth(i).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
      const bad=await page.evaluate(()=>{const b=document.querySelector('.stage')!.getBoundingClientRect();return [...document.querySelectorAll('.cv-scene p,.cv-scene h2,.cv-sample,.cv-test-outcomes span')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<b.left-1||r.right>b.right+1||r.bottom>b.bottom+1);}).map(el=>el.textContent);});expect(bad,`${mode} step ${i+1}`).toEqual([]);
    }
    await page.screenshot({path:`${SHOTS}/cv-${mode}-narrow.png`,fullPage:true});
  }
});
