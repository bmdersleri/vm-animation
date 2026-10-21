// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { rocScenario } from '../../../src/concepts/roc-esik/scenario';
import { mountRocScene } from '../../../src/concepts/roc-esik/scene';
const fixture=vi.hoisted(()=>({validation:[{id:'one',actual:0,score:.8},{id:'two',actual:0,score:.2}],test:[]}));
vi.mock('../../../src/concepts/degerlendirme/data',()=>({evaluationData:{scoreSets:{balanced:fixture,imbalanced:fixture}}}));
it.each([0,1])('renders one-class validation=%i without undefined curves or coordinates',actual=>{
  fixture.validation.forEach(s=>s.actual=actual);
  const player=new StepPlayer(rocScenario),host=document.createElement('div');
  const scene=mountRocScene(host,player,'lab');player.goto(7);
  expect(host.querySelector('[data-auc]')?.textContent).toContain('tanımsız');
  expect(host.querySelector('[data-curve="roc"]')).toBeNull();
  expect(host.querySelector('[data-operating="roc"]')).toBeNull();
  expect(host.querySelector('[data-panel="roc"]')?.textContent).toContain('iki gerçek sınıf');
  if(actual===0){expect(host.querySelector('[data-ap]')?.textContent).toContain('tanımsız');expect(host.querySelector('[data-curve="pr"]')).toBeNull();}
  else expect(host.querySelector('[data-ap]')?.textContent).toBe('AP 1');
  for(const node of host.querySelectorAll('.roc-plot *'))for(const attr of node.attributes)expect(attr.value).not.toMatch(/NaN|Infinity|undefined/);
  scene.destroy();player.destroy();
});
