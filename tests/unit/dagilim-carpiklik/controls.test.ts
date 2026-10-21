// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  BINS_STEPS, EXTREME_STEPS, LOG_STEPS, SERIES_STEPS,
  dagilimScenario, type DagilimParams,
} from '../../../src/concepts/dagilim-carpiklik/scenario';
import { mountDagilimParams } from '../../../src/concepts/dagilim-carpiklik/controls';
import { mountDagilimExtra } from '../../../src/concepts/dagilim-carpiklik/extra';
import { deriveDagilimView } from '../../../src/concepts/dagilim-carpiklik/view';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<DagilimParams>; host: HTMLElement } {
  const player = new StepPlayer(dagilimScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const range = (host: HTMLElement): HTMLInputElement =>
  host.querySelector<HTMLInputElement>('input[type=range][data-param=extreme]')!;
const bins = (host: HTMLElement): HTMLSelectElement =>
  host.querySelector<HTMLSelectElement>('select[data-param=bins]')!;
const log = (host: HTMLElement): HTMLInputElement =>
  host.querySelector<HTMLInputElement>('input[type=checkbox][data-param=log]')!;
const seri = (host: HTMLElement): HTMLSelectElement =>
  host.querySelector<HTMLSelectElement>('select[data-param=seri]')!;
const readout = (host: HTMLElement): string => (host.querySelector('output')?.textContent ?? '').trim();
const row = (host: HTMLElement, param: string): HTMLElement =>
  host.querySelector(`[data-param=${param}]`)!.closest<HTMLElement>('.ctl')!;
const pick = (el: HTMLSelectElement, value: string): void => {
  el.value = value;
  el.dispatchEvent(new Event('change'));
};

describe('mountDagilimParams', () => {
  it('has the four controls with their exact selectors and ranges', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    expect(range(host).min).toBe('28');
    expect(range(host).max).toBe('60');
    expect(range(host).step).toBe('1');
    expect([...bins(host).options].map((o) => o.value)).toEqual(['3', '5', '10']);
    expect(log(host).type).toBe('checkbox');
    expect([...seri(host).options].map((o) => o.value)).toEqual(['002', '003', 'simetrik', 'sol']);
    expect([...seri(host).options].every((o) => o.textContent!.trim().length > 3)).toBe(true);
  });

  it('moving the range writes the param and follows the readout', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    player.goto(6);
    const spy = vi.spyOn(player, 'setParam');
    const r = range(host);
    r.value = '45';
    r.dispatchEvent(new Event('input'));
    expect(spy).toHaveBeenCalledWith('extreme', 45);
    expect(player.state.params.extreme).toBe(45);
    expect(readout(host)).toBe('uç değer: 45');
    // never 0,00 on the slider readout
    expect(readout(host)).not.toContain('0,00');
  });

  it('the readout follows the player state (sync), including a shortcut change', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    expect(readout(host)).toBe('uç değer: 28');
    player.goto(6);
    player.setParam('extreme', 60);
    expect(readout(host)).toBe('uç değer: 60');
    player.goto(0);
    expect(readout(host)).toBe('uç değer: 28');
  });

  it('the selects and the checkbox write the params', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    player.goto(1);
    pick(bins(host), '10');
    expect(player.state.params.bins).toBe(10);
    pick(seri(host), 'sol');
    expect(player.state.params.seri).toBe('sol');
    log(host).checked = true;
    log(host).dispatchEvent(new Event('change'));
    expect(player.state.params.log).toBe(true);
  });

  it('a control outside its steps is disabled and its row marked off (Lab hides it)', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    for (let i = 0; i < dagilimScenario.steps.length; i++) {
      player.goto(i);
      const groups: [string, HTMLInputElement | HTMLSelectElement, readonly number[]][] = [
        ['extreme', range(host), EXTREME_STEPS],
        ['bins', bins(host), BINS_STEPS],
        ['log', log(host), LOG_STEPS],
        ['seri', seri(host), SERIES_STEPS],
      ];
      for (const [param, control, steps] of groups) {
        const off = !steps.includes(i);
        expect(control.disabled, `${param} step ${i + 1}`).toBe(off);
        expect(row(host, param).hasAttribute('data-off'), `${param} step ${i + 1}`).toBe(off);
      }
    }
  });

  it('a step change re-syncs the widgets to the player state', () => {
    const { player, host } = make();
    mountDagilimParams(host, player);
    player.goto(4);
    expect(bins(host).value).toBe('3');
    expect(range(host).value).toBe('28');
    player.setParam('bins', 10);
    expect(bins(host).value).toBe('10');
    player.goto(6);
    expect(log(host).checked).toBe(false);
    player.goto(5);
    expect(log(host).checked).toBe(true);
    player.goto(7);
    expect(seri(host).value).toBe('002');
    expect([...seri(host).options].filter((o) => o.selected).length).toBe(1);
  });
});

describe('mountDagilimExtra', () => {
  it('gives the five Lab paragraphs and a live note bound to view.note', () => {
    const { player, host } = make();
    mountDagilimExtra(host, player);
    const paras = [...host.querySelectorAll<HTMLParagraphElement>('p:not(.live-note)')];
    expect(paras).toHaveLength(5);
    expect(paras.every((p) => p.textContent!.length > 30)).toBe(true);
    const note = host.querySelector<HTMLElement>('p.live-note')!;
    for (let i = 0; i < dagilimScenario.steps.length; i++) {
      player.goto(i);
      expect(note.textContent).toBe(deriveDagilimView(i, player.state.params).note);
    }
  });
});
