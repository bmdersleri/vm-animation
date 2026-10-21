// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { rocScenario } from '../../../src/concepts/roc-esik/scenario';
import { mountRocScene } from '../../../src/concepts/roc-esik/scene';
import { mountRocParams } from '../../../src/concepts/roc-esik/controls';
import { selectFinalThreshold } from '../../../src/concepts/roc-esik/selection';
import { evaluationData } from '../../../src/concepts/degerlendirme/data';
import { bestThreshold, classify } from '../../../src/concepts/degerlendirme/curves';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
describe('ROC threshold lesson', () => {
  it('teaches ten concrete moments and sweeps in both directions', () => {
    expect(rocScenario.steps.map(s => s.id)).toEqual(['skor','esik','dusur','yukselt','roc','auc','pr','dengesizlik','maliyet','test']);
    expect(rocScenario.defaults.threshold).toBe(.5);
    expect(rocScenario.steps[2].sweep).toEqual({ key: 'threshold', values: [.8,.5,.3,.1], intervalMs: 1200 });
    expect(rocScenario.steps[3].sweep?.values).toEqual([.1,.3,.5,.8]);
  });
  it('moves tied scores together and binds counts and operating points to the same threshold', () => {
    const player = new StepPlayer(rocScenario); const host = document.createElement('div');
    const scene = mountRocScene(host, player, 'ders');
    expect(host.querySelectorAll('.roc-positive-region')).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('[data-threshold]')?.hidden).toBe(true);
    player.goto(4);
    const first = host.querySelector('[data-sample="balanced-validation-01"]');
    for (const threshold of [.81,.8,.2,0]) {
      player.setParam('threshold', threshold);
      const c = classify(evaluationData.scoreSets.balanced.validation, threshold);
      for (const key of ['tn','fp','fn','tp'] as const) expect(host.querySelector(`[data-count="${key}"]`)?.textContent).toBe(String(c[key]));
      const point = host.querySelector('[data-operating="roc"]')!;
      expect(Number(point.getAttribute('data-x'))).toBe(c.fp / 2);
      expect(Number(point.getAttribute('data-y'))).toBe(c.tp / 2);
      expect(host.querySelector('[data-sample="balanced-validation-01"]')).toBe(first);
      expect(first?.getAttribute('data-predicted')).toBe(host.querySelector('[data-sample="balanced-validation-02"]')?.getAttribute('data-predicted'));
    }
    scene.destroy(); player.destroy();
  });
  it('keeps AUC fixed, distinguishes AP and empty precision, redraws the selected dataset, and destroys subscriptions', () => {
    const player = new StepPlayer(rocScenario); const host = document.createElement('div');
    const scene = mountRocScene(host, player, 'lab'); player.goto(6);
    expect(host.querySelector('[data-auc]')?.textContent).toContain('0,625');
    expect(host.querySelector('[data-ap]')?.textContent).toContain('0,583');
    player.setParams({ threshold: 0, nonePositive: true });
    expect(host.querySelector('[data-auc]')?.textContent).toContain('0,625');
    expect(host.querySelector('[data-precision]')?.textContent).toContain('tanımsız');
    expect(host.querySelector('[data-convention]')?.textContent).toContain('precision=1');
    expect(host.querySelector('[data-operating="pr"]')?.getAttribute('data-y')).toBe('1');
    const oldPath = host.querySelector('[data-curve="roc"]')?.getAttribute('d');
    player.setParam('dataset', 'imbalanced');
    expect(host.querySelectorAll('[data-sample]')).toHaveLength(12);
    expect(host.querySelector('[data-curve="roc"]')?.getAttribute('d')).not.toBe(oldPath);
    expect(host.querySelector('[data-prevalence]')?.textContent).toContain('16,67');
    const subscribe = player.subscribe.bind(player); const cleanupSpy = vi.fn();
    vi.spyOn(player, 'subscribe').mockImplementation(listener => { const off=subscribe(listener); return () => { cleanupSpy(); off(); }; });
    const other = mountRocScene(document.createElement('div'), player, 'lab');
    other.destroy(); other.destroy(); expect(cleanupSpy).toHaveBeenCalledTimes(1);
    scene.destroy(); player.setParam('threshold', .4);
    expect(host.children).toHaveLength(0); player.destroy();
  });
  it('shows each teaching moment and uses validation only for the frozen final test', () => {
    const player = new StepPlayer(rocScenario); const host = document.createElement('div'); const controls = document.createElement('div');
    const scene = mountRocScene(host, player, 'lab'); const params = mountRocParams(controls, player);
    expect(controls.querySelector<HTMLElement>('[data-control="threshold"]')?.hidden).toBe(true);
    expect(controls.querySelector<HTMLElement>('[data-control="dataset"]')?.hidden).toBe(true);
    const expected = ['Skor, kalibre olasılık garantisi değildir','skor ≥ eşik','Recall artabilir','Precision','FPR','Trapez','AP','pozitif oranı','Daha yüksek eşik','Eğitim'];
    for(let i=0;i<10;i++) { player.goto(i); expect(host.textContent).toContain(expected[i]); }
    const data = evaluationData.scoreSets.balanced;
    const selected = selectFinalThreshold(data, 1, 5);
    expect(selected).toBe(bestThreshold(data.validation, 1, 5));
    expect(selected).toBe(.2);
    expect(selectFinalThreshold({ ...data, test: data.test.map(s => ({ ...s, actual: s.actual ? 0 : 1, score: 1-s.score })) }, 1, 5)).toBe(selected);
    expect(host.querySelector('[data-test-report]')?.textContent).toContain('Bağımsız test');
    expect(controls.querySelector('output')?.textContent).toBe('0,20');
    expect(controls.querySelector<HTMLElement>('[data-control="costs"]')?.hidden).toBe(true);
    player.goto(8); expect(controls.querySelector<HTMLElement>('[data-control="costs"]')?.hidden).toBe(false);
    expect(host.querySelector('.roc-cost-summary')?.textContent).toContain('Öneri 0,20 → maliyet 1. Varsayılan 0,50 → 6');
    player.setParams({fpCost:0,fnCost:0}); expect(host.querySelector('[data-best="true"]')?.getAttribute('data-candidate')).toBe('none');
    player.setParam('threshold', .91); player.first(); expect(player.state.params.threshold).toBe(.5);
    params.destroy(); scene.destroy(); player.destroy();
  });
  it('sweep changes the displayed threshold while preserving AUC', () => {
    vi.useFakeTimers(); const player = new StepPlayer(rocScenario); const host = document.createElement('div'); const scene = mountRocScene(host, player, 'ders');
    player.goto(2); expect(host.querySelector('[data-threshold]')?.textContent).toContain('0,80');
    vi.advanceTimersByTime(2400); expect(host.querySelector('[data-threshold]')?.textContent).toContain('0,30');
    expect(host.querySelector('[data-auc]')?.textContent).toContain('0,625'); scene.destroy(); player.destroy();
  });
  it('carries only cost-to-final validation choices, keeps the test locked earlier, and freezes final controls', () => {
    const player=new StepPlayer(rocScenario),host=document.createElement('div'),controls=document.createElement('div');
    const scene=mountRocScene(host,player,'lab'),params=mountRocParams(controls,player);
    expect(host.querySelector('[data-test-locked]')?.textContent).toContain('Test kilitli');
    expect(host.querySelector('[data-test-report]')?.textContent).toBe('');
    for(const [fpCost,fnCost]of [[0,0],[3,9]]) {
      player.goto(8);player.setParams({dataset:'imbalanced',fpCost,fnCost});
      const selected=bestThreshold(evaluationData.scoreSets.imbalanced.validation,fpCost,fnCost);
      player.goto(9);
      expect(player.state.params).toMatchObject({dataset:'imbalanced',fpCost,fnCost});
      expect(host.querySelector('[data-threshold]')?.textContent).toContain(selected==='none'?'Hiç pozitif tahmin yok':'0,55');
      expect(controls.querySelector<HTMLSelectElement>('select[name="dataset"]')?.disabled).toBe(true);
      expect(host.querySelector<HTMLElement>('[data-test-locked]')?.hidden).toBe(true);
    }
    player.first();expect(player.state.params).toEqual(rocScenario.defaults);
    player.goto(7);player.setParam('dataset','imbalanced');player.goto(9);
    expect(player.state.params.dataset).toBe('balanced');
    params.destroy();scene.destroy();player.destroy();
  });
});
