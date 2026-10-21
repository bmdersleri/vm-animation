// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { cvScenario } from '../../../src/concepts/capraz-dogrulama/scenario';
import { mountCvScene } from '../../../src/concepts/capraz-dogrulama/scene';
import { mountCvParams } from '../../../src/concepts/capraz-dogrulama/controls';
import { cText } from '../../../src/concepts/capraz-dogrulama/view';
import { evaluationData } from '../../../src/concepts/degerlendirme/data';

afterEach(()=>{ vi.useRealTimers(); document.body.replaceChildren(); });
const data=evaluationData.cv;
const development=data.samples.filter(s=>s.partition==='development');
const setup=()=>{const player=new StepPlayer(cvScenario);const host=document.createElement('div');const scene=mountCvScene(host,player,'lab');return {player,host,scene};};
describe('cross validation lesson',()=>{
  it('defines ten resettable moments and a five-fold new-model sweep',()=>{
    expect(cvScenario.steps.map(s=>s.id)).toEqual(['tek-bolunme','katlar','ilk-kat','yeni-model','her-ornek','ozet','duz-kfold','stratified','pipeline','son-test']);
    expect(cvScenario.steps[3].sweep).toEqual({key:'fold',values:[0,1,2,3,4],intervalMs:1200});
    const player=new StepPlayer(cvScenario);player.setParams({k:3,fold:2,c:.1});player.goto(5);
    expect(player.state.params).toEqual({k:5,method:'stratified',fold:0,c:1});player.destroy();
  });
  it('keeps stable identities while every run drives fold roles, predictions, counts, scores and training-only scaler',()=>{
    const {player,host,scene}=setup();player.goto(2);
    const first=host.querySelector('[data-sample="development-01"]');
    for(const run of data.runs)for(let i=0;i<run.k;i++){
      player.setParams({k:run.k,method:run.method,c:run.c,fold:i});const fold=run.folds[i];
      expect(host.querySelector('[data-run]')?.getAttribute('data-run')).toBe(`${run.k}-${run.method}-${run.c}`);
      expect(host.querySelectorAll('[data-role="validation"][data-sample]')).toHaveLength(fold.validationIds.length);
      expect(host.querySelectorAll('[data-role="train"][data-sample]')).toHaveLength(fold.trainIds.length);
      for(const s of development){const chip=host.querySelector(`[data-sample="${s.id}"]`)!;
        expect(chip.getAttribute('data-role')).toBe(fold.validationIds.includes(s.id)?'validation':'train');
        expect(chip.getAttribute('data-actual')).toBe(String(s.actual));
      }
      expect(host.querySelector('[data-sample="development-01"]')).toBe(first);
      expect(host.querySelector('[data-fold-f1]')?.getAttribute('data-value')).toBe(String(fold.f1));
      expect(host.querySelector('[data-train-count]')?.textContent).toBe(String(fold.trainIds.length));
      expect(host.querySelector('[data-validation-positive]')?.textContent).toBe(String(development.filter(s=>s.actual===1&&fold.validationIds.includes(s.id)).length));
      for(const field of ['mean','scale'] as const)expect(JSON.parse(host.querySelector(`[data-fit="${field}"]`)!.getAttribute('data-values')!)).toEqual(fold[field]);
      for(const p of fold.predictions)expect(host.querySelector(`[data-sample="${p.id}"]`)?.getAttribute('data-predicted')).toBe(String(p.predicted));
    }
    scene.destroy();player.destroy();
  });
  it('reveals each completed sweep score and assigns each sample to validation once',()=>{
    vi.useFakeTimers();const {player,host,scene}=setup();player.goto(3);
    expect(host.querySelectorAll('[data-score][data-revealed="true"]')).toHaveLength(1);
    vi.advanceTimersByTime(2400);expect(host.querySelectorAll('[data-score][data-revealed="true"]')).toHaveLength(3);
    expect(host.querySelector('[data-active-fold]')?.getAttribute('data-active-fold')).toBe('2');
    player.goto(4);for(const s of development){const chip=host.querySelector(`[data-sample="${s.id}"]`)!;expect(chip.getAttribute('data-validation-count')).toBe('1');expect(chip.textContent).toContain('K');}
    scene.destroy();player.destroy();
  });
  it('shows mean and population std rather than a confidence interval; compares actual positive fold counts',()=>{
    const {player,host,scene}=setup();player.goto(5);const run=data.runs.find(r=>r.k===5&&r.method==='stratified'&&r.c===1)!;
    expect(host.querySelector('[data-mean]')?.getAttribute('data-value')).toBe(String(run.meanF1));
    expect(host.querySelector('[data-std]')?.getAttribute('data-value')).toBe(String(run.stdF1));
    expect(host.textContent).toContain('güven aralığı değildir');
    for(const [step,method]of [[6,'kfold'],[7,'stratified']] as const){player.goto(step);const selected=data.runs.find(r=>r.k===5&&r.method===method&&r.c===1)!;
      expect(player.state.params.method).toBe(method);
      selected.folds.forEach((fold,i)=>expect(host.querySelector(`[data-positive-fold="${i}"]`)?.getAttribute('data-count')).toBe(String(development.filter(s=>s.actual===1&&fold.validationIds.includes(s.id)).length)));
    }
    scene.destroy();player.destroy();
  });
  it('distinguishes undefined recall, conditional undefined F1 and sklearn zero_division convention',()=>{
    const {player,host,scene}=setup();player.goto(6);player.setParams({method:'kfold',c:.1,fold:0});
    const fold=data.runs.find(r=>r.k===5&&r.method==='kfold'&&r.c===.1)!.folds[0];
    expect(fold.confusion.tp+fold.confusion.fn).toBe(0);
    expect(host.querySelector('[data-recall]')?.textContent).toContain('tanımsız');
    expect(host.querySelector('[data-f1-definition]')?.textContent).toContain('2TP + FP + FN');
    expect(host.querySelector('[data-score-convention]')?.textContent).toContain('zero_division=0');
    player.setParams({c:1,fold:0});const nonempty=data.runs.find(r=>r.k===5&&r.method==='kfold'&&r.c===1)!.folds[0];
    if(nonempty.confusion.fp>0)expect(host.querySelector('[data-ui-f1]')?.textContent).toContain('0,000');
    scene.destroy();player.destroy();
  });
  it('makes training-only and wrong global-development fits explicit; never leaks held-out outcomes',()=>{
    const {player,host,scene}=setup();
    for(let step=0;step<9;step++){player.goto(step);expect(host.querySelector('[data-test-locked]')).not.toBeNull();expect(host.querySelectorAll('[data-test-outcome]')).toHaveLength(0);}
    expect(host.querySelector('[data-pipeline="correct"]')?.textContent).toContain('Eğitimde fit');
    expect(host.querySelector('[data-pipeline="wrong"]')?.textContent).toContain('Doğrulama bilgisi');
    expect(JSON.parse(host.querySelector('[data-global-fit="mean"]')!.getAttribute('data-values')!)).toEqual(data.selection.fitMean);
    expect(host.textContent).toContain('her zaman artırmaz');
    scene.destroy();player.destroy();
  });
  it('freezes the fixed K5 stratified candidate protocol, refits all development, and opens only the selected final test',()=>{
    const {player,host,scene}=setup();player.setParams({k:3,method:'kfold',c:.1,fold:2});player.goto(9);
    expect(host.querySelector('[data-final-protocol]')?.textContent).toContain('K=5 · StratifiedKFold');
    expect(host.querySelectorAll('[data-candidate]')).toHaveLength(2);
    for(const c of [.1,1]){const run=data.runs.find(r=>r.k===5&&r.method==='stratified'&&r.c===c)!;expect(host.querySelector(`[data-candidate="${c}"]`)?.getAttribute('data-mean')).toBe(String(run.meanF1));}
    expect(host.querySelector('[data-selected-c]')?.getAttribute('data-selected-c')).toBe(String(data.selection.c));
    expect(host.querySelector('[data-test-f1]')?.getAttribute('data-value')).toBe(String(data.selection.finalTest.f1));
    expect(host.querySelectorAll('[data-test-outcome]')).toHaveLength(data.selection.finalTest.predictions.length);
    expect(host.querySelector('[data-test-locked]')).toBeNull();
    expect(host.textContent).toContain('Zaman ve grup');scene.destroy();player.destroy();
  });
  it('clamps K and active fold atomically, exposes relevant controls, and removes all subscriptions on destroy',()=>{
    const {player,host,scene}=setup();const controls=document.createElement('div');const params=mountCvParams(controls,player);
    expect(controls.querySelector<HTMLElement>('[data-control="k"]')?.hidden).toBe(true);player.goto(5);player.setParam('fold',4);
    const select=controls.querySelector<HTMLSelectElement>('[name="k"]')!;select.value='3';select.dispatchEvent(new Event('change'));
    expect(player.state.params.k).toBe(3);expect(player.state.params.fold).toBe(2);expect(controls.querySelectorAll('[name="fold"] option')).toHaveLength(3);
    player.goto(9);for(const control of controls.querySelectorAll('select'))expect(control.disabled).toBe(true);
    scene.destroy();params.destroy();player.goto(0);expect(host.children).toHaveLength(0);expect(controls.children).toHaveLength(0);player.destroy();
  });
  it('derives the class counts from the data instead of hard-coded prose',()=>{
    const pos=development.filter(s=>s.actual===1).length,neg=development.length-pos;
    const {player,host,scene}=setup();const controls=document.createElement('div');const params=mountCvParams(controls,player);
    player.goto(7);expect(host.textContent).toContain(`${pos} pozitif, ${neg} negatif`);expect(host.textContent).not.toContain('10 pozitif');
    expect(controls.textContent).toContain(`${pos} pozitif ve ${neg} negatif`);expect(controls.textContent).not.toContain('10 pozitif');
    params.destroy();scene.destroy();player.destroy();
  });
  it('labels validation folds without a positive as undefined recall',()=>{
    const {player,host,scene}=setup();player.goto(6);
    const run=data.runs.find(r=>r.k===5&&r.method==='kfold'&&r.c===1)!;
    run.folds.forEach((fold,i)=>{const none=!development.some(s=>s.actual===1&&fold.validationIds.includes(s.id));
      expect(host.querySelector(`[data-positive-fold="${i}"]`)?.hasAttribute('data-recall-undefined')).toBe(none);});
    expect(host.querySelectorAll('[data-recall-undefined]').length).toBeGreaterThan(0);
    player.goto(7);expect(host.querySelectorAll('[data-recall-undefined]')).toHaveLength(0);
    scene.destroy();player.destroy();
  });
  it('wrong global fit equals the development-only mean and population scale; test rows are excluded',()=>{
    const x=development.map(s=>s.x);
    const mean=[0,1].map(j=>x.reduce((a,r)=>a+r[j],0)/x.length);
    const scale=[0,1].map(j=>Math.sqrt(x.reduce((a,r)=>a+(r[j]-mean[j])**2,0)/x.length));
    data.selection.fitMean.forEach((v,j)=>expect(v).toBeCloseTo(mean[j],9));
    data.selection.fitScale.forEach((v,j)=>expect(v).toBeCloseTo(scale[j],9));
    const {player,host,scene}=setup();player.goto(8);
    expect(host.querySelector('[data-pipeline="wrong"]')?.textContent).toContain('Yanlış');
    expect(JSON.parse(host.querySelector('[data-global-fit="scale"]')!.getAttribute('data-values')!)).toEqual(data.selection.fitScale);
    scene.destroy();player.destroy();
  });
  it('shows the frozen chosen model in disabled final controls and formats C in Turkish',()=>{
    expect(cText(.1)).toBe('0,1');expect(cText(1)).toBe('1');
    const {player,host,scene}=setup();const controls=document.createElement('div');const params=mountCvParams(controls,player);
    player.goto(9);
    const val=(n:string)=>controls.querySelector<HTMLSelectElement>(`[name="${n}"]`)!;
    expect(val('k').value).toBe('5');expect(val('method').value).toBe('stratified');expect(val('c').value).toBe(String(data.selection.c));
    for(const key of ['k','method','c']){expect(controls.querySelector<HTMLElement>(`[data-control="${key}"]`)?.hidden).toBe(false);expect(val(key).disabled).toBe(true);}
    expect(controls.querySelector<HTMLElement>('[data-control="fold"]')?.hidden).toBe(true);
    expect(host.querySelector('[data-selected-c]')?.textContent).toContain(`C=${cText(data.selection.c)}`);
    params.destroy();scene.destroy();player.destroy();
  });
  it('gives the score chart an accessible text summary with the real numbers',()=>{
    const {player,host,scene}=setup();player.goto(5);
    const label=host.querySelector('.cv-score-plot')!.getAttribute('aria-label')!;
    const run=data.runs.find(r=>r.k===5&&r.method==='stratified'&&r.c===1)!;
    expect(label).toContain(run.meanF1.toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3}));
    expect(label).toContain('K5');
    scene.destroy();player.destroy();
  });
});
