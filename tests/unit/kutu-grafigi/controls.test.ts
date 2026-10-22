// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  DOTS_STEPS, K_STEPS, SIXTH_STEPS, THIRD_STEPS,
  kutuScenario, type KutuParams,
} from '../../../src/concepts/kutu-grafigi/scenario';
import { mountKutuParams } from '../../../src/concepts/kutu-grafigi/controls';
import { mountKutuExtra } from '../../../src/concepts/kutu-grafigi/extra';
import { deriveKutuView } from '../../../src/concepts/kutu-grafigi/view';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<KutuParams>; host: HTMLElement } {
  const player = new StepPlayer<KutuParams>(kutuScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const radios = (host: HTMLElement): HTMLInputElement[] =>
  [...host.querySelectorAll<HTMLInputElement>('input[type=radio][data-param=k]')];
const box = (host: HTMLElement, param: string): HTMLInputElement =>
  host.querySelector<HTMLInputElement>(`input[type=checkbox][data-param=${param}]`)!;
const row = (host: HTMLElement, param: string): HTMLElement =>
  host.querySelector<HTMLElement>(`[data-param=${param}]`)!.closest<HTMLElement>('.ctl')!;
const label = (input: HTMLInputElement): string => (input.closest('label')?.textContent ?? '').trim();
const pick = (input: HTMLInputElement, checked: boolean): void => {
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
};

describe('mountKutuParams', () => {
  it('has the k radio pair and the three checkboxes with their exact selectors', () => {
    const { player, host } = make();
    mountKutuParams(host, player);
    const k = radios(host);
    expect(k).toHaveLength(2);
    expect(k.map((r) => r.value)).toEqual(['1.5', '3']);
    expect(k.map(label)).toEqual(['k = 1,5', 'k = 3,0']);
    expect(box(host, 'sixth').type).toBe('checkbox');
    expect(box(host, 'third').type).toBe('checkbox');
    expect(box(host, 'dots').type).toBe('checkbox');
    expect(box(host, 'dots').checked).toBe(true);
  });

  it('choosing k = 3 writes the param with the right type', () => {
    const { player, host } = make();
    mountKutuParams(host, player);
    player.goto(4);
    const spy = vi.spyOn(player, 'setParam');
    pick(radios(host)[1], true);
    expect(spy).toHaveBeenCalledWith('k', 3);
    expect(player.state.params.k).toBe(3);
    pick(radios(host)[0], true);
    expect(player.state.params.k).toBe(1.5);
  });

  it('the checkboxes write the params', () => {
    const { player, host } = make();
    mountKutuParams(host, player);
    player.goto(1);
    pick(box(host, 'sixth'), true);
    expect(player.state.params.sixth).toBe(true);
    pick(box(host, 'dots'), false);
    expect(player.state.params.dots).toBe(false);
    player.goto(6);
    pick(box(host, 'third'), false);
    expect(player.state.params.third).toBe(false);
    // the panel follows the view: closing the third group leaves two rows
    expect(deriveKutuView(6, player.state.params).groups.map((g) => g.id)).toEqual(['bilgisayar', 'elektrik']);
  });

  it('a control outside its steps is disabled and its row marked off (Lab hides it)', () => {
    const { player, host } = make();
    mountKutuParams(host, player);
    for (let i = 0; i < kutuScenario.steps.length; i++) {
      player.goto(i);
      const groups: [string, HTMLInputElement, readonly number[]][] = [
        ['k', radios(host)[0], K_STEPS],
        ['sixth', box(host, 'sixth'), SIXTH_STEPS],
        ['third', box(host, 'third'), THIRD_STEPS],
        ['dots', box(host, 'dots'), DOTS_STEPS],
      ];
      for (const [param, control, steps] of groups) {
        const off = !steps.includes(i);
        expect(control.disabled, `${param} adım ${i + 1}`).toBe(off);
        expect(row(host, param).hasAttribute('data-off'), `${param} adım ${i + 1}`).toBe(off);
      }
      for (const r of radios(host)) expect(r.disabled, `k adım ${i + 1}`).toBe(!K_STEPS.includes(i));
    }
  });

  it('a step change re-syncs the widgets to the player state', () => {
    const { player, host } = make();
    mountKutuParams(host, player);
    player.goto(4);
    expect(radios(host).find((r) => r.checked)?.value).toBe('1.5');
    player.setParam('k', 3);
    expect(radios(host).find((r) => r.checked)?.value).toBe('3');
    // step 6 owns k again: its step params reset the manual override
    player.goto(5);
    expect(radios(host).find((r) => r.checked)?.value).toBe('1.5');
    player.goto(1);
    player.setParam('sixth', true);
    expect(box(host, 'sixth').checked).toBe(true);
    player.goto(6);
    expect(box(host, 'third').checked).toBe(true);
    player.goto(0);
    expect(box(host, 'third').checked).toBe(false);
    expect(box(host, 'sixth').checked).toBe(false);
  });
});

describe('mountKutuExtra', () => {
  it('gives the four Lab paragraphs and a live note bound to view.note', () => {
    const { player, host } = make();
    mountKutuExtra(host, player);
    const paras = [...host.querySelectorAll<HTMLParagraphElement>('p:not(.live-note)')];
    expect(paras).toHaveLength(4);
    expect(paras.every((p) => p.textContent!.length > 60)).toBe(true);
    const note = host.querySelector<HTMLElement>('p.live-note')!;
    for (let i = 0; i < kutuScenario.steps.length; i++) {
      player.goto(i);
      expect(note.textContent).toBe(deriveKutuView(i, player.state.params).note);
    }
  });
});
