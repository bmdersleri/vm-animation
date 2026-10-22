// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { cvScenario } from '../../../src/concepts/capraz-dogrulama/scenario';
import { mountCvScene } from '../../../src/concepts/capraz-dogrulama/scene';
import { classPanel } from '../../../src/concepts/capraz-dogrulama/panels';
import { evaluationData } from '../../../src/concepts/degerlendirme/data';

afterEach(()=>{ vi.useRealTimers(); document.body.replaceChildren(); });
const setup=()=>{const player=new StepPlayer(cvScenario);const host=document.createElement('div');const scene=mountCvScene(host,player,'lab');return {player,host,scene};};

describe('cross validation scene timing',()=>{
  it('a C change mid-turn restarts the turn instead of opening its score',()=>{
    vi.useFakeTimers();const {player,host,scene}=setup();player.goto(3);
    const f1=()=>host.querySelector('[data-fold-f1]')!;
    // Turn 5 (the last) starts at 4 x 1200 ms; a C change in the middle of it must keep the score masked.
    vi.advanceTimersByTime(4*1200+600);
    expect(host.querySelector('[data-active-fold]')?.getAttribute('data-active-fold')).toBe('4');
    expect(f1().getAttribute('data-revealed')).toBe('false');
    player.setParam('c',.1);
    expect(f1().getAttribute('data-revealed')).toBe('false');
    expect(f1().textContent).toBe('bekliyor');
    vi.advanceTimersByTime(1199);expect(f1().getAttribute('data-revealed')).toBe('false');
    vi.advanceTimersByTime(1);expect(f1().getAttribute('data-revealed')).toBe('true');
    scene.destroy();player.destroy();
  });
});

describe('cross validation class encoding',()=>{
  it('positive class uses the chapter\'s diamond',()=>{
    const {player,host,scene}=setup();
    expect(host.querySelector('[data-positive-key]')?.textContent).toContain('◆ Pozitif');
    expect(host.querySelector('[data-positive-key]')?.textContent).not.toContain('■');
    player.goto(6);
    const run=evaluationData.cv.runs.find(r=>r.k===5&&r.method==='stratified')!;
    expect(classPanel(run).textContent).toContain('◆ Ayrılan müşteri');
    expect(classPanel(run).textContent).not.toContain('■');
    expect(host.querySelector('.cv-classes')?.textContent).not.toContain('■');
    expect(host.querySelector('.cv-role-validation')?.textContent).toContain('lacivert');
    scene.destroy();player.destroy();
  });
});
