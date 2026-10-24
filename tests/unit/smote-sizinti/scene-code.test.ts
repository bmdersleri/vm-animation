// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  vi.useRealTimers();
  document.body.replaceChildren();
});

function setup(id: string) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLeakScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(1280, 540);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  player.goto(stepIndex(sc, id));
  return { el, player };
}

const badges = (el: HTMLElement) => [...el.querySelectorAll('.bug-badge')].map((b) => b.getAttribute('data-bug')).sort();

describe('code scene', () => {
  it('step 9 sweep marks five bug lines in order', () => {
    const { el, player } = setup('hata-ayiklama');
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('code');
    const lines = [...el.querySelectorAll('.code-line')];
    expect(lines.length).toBeGreaterThan(8);
    expect(lines.map((l) => l.querySelector('.code-no')!.textContent)).toEqual(lines.map((_, i) => String(i + 1)));
    // the bugs land on: SMOTE before the split, training on the test part, accuracy only, no random_state, no stratify
    // (the last two share the split line, so the fifth bug marks no new line)
    const marked: number[] = [];
    for (let n = 1; n <= 5; n++) {
      player.setParam('bug', n);
      expect(badges(el)).toEqual(['1', '2', '3', '4', '5'].slice(0, n));
      marked.push(el.querySelectorAll('.code-line.is-bug').length);
      expect(el.querySelector('.code-line.is-current')!.querySelector('.bug-badge:last-child')!.getAttribute('data-bug')).toBe(String(n));
    }
    expect(marked).toEqual([1, 2, 3, 4, 4]);
    expect(el.querySelector('.code-line.is-bug .code-text')!.textContent).toContain('SMOTE().fit_resample(ozellikler, hedef)');
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
  });

  it('the sweep ends on the corrected code', () => {
    const { el, player } = setup('hata-ayiklama');
    player.setParam('bug', 6);
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(0);
    expect(el.querySelectorAll('.code-line.code-fixed').length).toBeGreaterThan(10);
    expect(el.querySelector('.code-title')!.textContent).toBe('Düzeltilmiş kod');
  });

  it('leaving step 9 and coming back restarts the sweep from the first bug', () => {
    vi.useFakeTimers();
    const { el, player } = setup('hata-ayiklama');
    const step9 = stepIndex(sc, 'hata-ayiklama');
    // the sweep plays to its end: the corrected code
    vi.advanceTimersByTime(1400 * 6);
    expect(player.state.params.bug).toBe(6);
    expect(el.querySelectorAll('.code-line.code-fixed').length).toBeGreaterThan(10);
    for (const away of [step9 + 1, step9 - 1]) {
      player.goto(away);
      player.goto(step9);
      // back on step 9 the faulty code returns with only the first bug marked, then the sweep plays on
      expect(player.state.params.bug).toBe(1);
      expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
      expect(badges(el)).toEqual(['1']);
      vi.advanceTimersByTime(1400);
      expect(badges(el)).toEqual(['1', '2']);
      vi.advanceTimersByTime(1400 * 5);
      expect(player.state.params.bug).toBe(6);
    }
  });

  it('fixed toggle shows the corrected code', () => {
    const { el, player } = setup('hata-ayiklama');
    player.setParams({ bug: 5, fixed: false });
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    player.setParam('fixed', true);
    const fixed = [...el.querySelectorAll('.code-line.code-fixed .code-text')].map((t) => t.textContent).join('\n');
    expect(fixed).toContain('stratify=hedef, random_state=42');
    expect(fixed).toContain('SMOTE(random_state=42).fit_resample(');
    expect(fixed).toContain('average_precision_score(test_y');
    expect(el.querySelectorAll('.is-fix')).toHaveLength(4);
    player.setParam('fixed', false);
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
  });

  it('step 10 draws three cards and two links', () => {
    const { el } = setup('baska-sizintilar');
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('cards');
    expect([...el.querySelectorAll('.leak-card')].map((c) => c.getAttribute('data-kind'))).toEqual(['hedef', 'zaman', 'grup']);
    expect(el.querySelector('.leak-card[data-kind="zaman"]')!.textContent).toContain('TimeSeriesSplit');
    expect(el.querySelector('.leak-card[data-kind="grup"]')!.textContent).toContain('GroupKFold');
    expect([...el.querySelectorAll('.leak-links a')].map((a) => a.getAttribute('href'))).toEqual(['../dengesiz-veri/', '../capraz-dogrulama/']);
    expect(el.querySelector('.exam-note')!.textContent).toContain('yalnızca eğitim verisinden öğrenmelidir');
  });
});
