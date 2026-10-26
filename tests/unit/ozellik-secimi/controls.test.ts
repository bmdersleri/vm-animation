// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { ozellikSecimiScenario, type SecimParams } from '../../../src/concepts/ozellik-secimi/scenario';
import { deriveSecimView } from '../../../src/concepts/ozellik-secimi/view';
import { mountSecimParams } from '../../../src/concepts/ozellik-secimi/controls';
import { mountSecimExtra } from '../../../src/concepts/ozellik-secimi/extra';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<SecimParams>; host: HTMLElement } {
  const player = new StepPlayer(ozellikSecimiScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const radios = (host: HTMLElement, name: string): HTMLInputElement[] =>
  [...host.querySelectorAll<HTMLInputElement>(`input[type=radio][name=${name}]`)];
const checked = (host: HTMLElement, name: string): string | undefined =>
  radios(host, name).find((r) => r.checked)?.value;
const slider = (host: HTMLElement, param: string): HTMLInputElement =>
  host.querySelector<HTMLInputElement>(`input[type=range][data-param=${param}]`)!;
const ctl = (el: Element): HTMLElement => el.closest<HTMLElement>('.ctl')!;
const setSlider = (s: HTMLInputElement, v: number): void => {
  s.value = String(v);
  s.dispatchEvent(new Event('input'));
};

function groups(host: HTMLElement): Record<'vt' | 'k' | 'nSelect' | 'scaling', HTMLElement> {
  return {
    vt: ctl(radios(host, 'vt')[0]),
    k: ctl(slider(host, 'k')),
    nSelect: ctl(slider(host, 'nSelect')),
    scaling: ctl(radios(host, 'scaling')[0]),
  };
}
const openGroups = (host: HTMLElement): string[] =>
  Object.entries(groups(host)).filter(([, g]) => !g.hasAttribute('data-off')).map(([k]) => k);

describe('mountSecimParams', () => {
  it('builds the groups with the specified ranges and values', () => {
    const { player, host } = make();
    mountSecimParams(host, player);
    expect(host.querySelector('div.knn-params.secim-params')).not.toBeNull();
    expect(radios(host, 'vt').map((r) => r.value)).toEqual(['0', '0.01', '1', '10']);
    expect(radios(host, 'scaling').map((r) => r.value)).toEqual(['yok', 'standard']);
    for (const name of ['k', 'nSelect']) {
      const s = slider(host, name);
      expect([s.min, s.max, s.step]).toEqual(['1', '7', '1']);
    }
    expect(host.querySelectorAll('fieldset.ctl.choice')).toHaveLength(2);
    expect(host.querySelectorAll('div.ctl.range')).toHaveLength(2);
  });

  it('radios and sliders follow the steps and hide outside them', () => {
    const { player, host } = make();
    mountSecimParams(host, player);
    expect(openGroups(host)).toEqual([]);
    player.goto(1);
    expect(openGroups(host)).toEqual(['vt']);
    expect(checked(host, 'vt')).toBe('0.01');
    player.goto(3);
    expect(openGroups(host)).toEqual(['k']);
    expect(slider(host, 'k').value).toBe('4');
    expect(ctl(slider(host, 'k')).querySelector('output')!.textContent).toBe('4');
    player.goto(6);
    expect(openGroups(host)).toEqual(['nSelect', 'scaling']);
    player.goto(8);
    expect(checked(host, 'scaling')).toBe('standard');
    player.goto(9);
    expect(checked(host, 'scaling')).toBe('standard');
    expect(slider(host, 'nSelect').value).toBe('2');
    for (let i = 0; i < 10; i++) {
      player.goto(i);
      for (const g of Object.values(groups(host))) {
        const inputs = [...g.querySelectorAll<HTMLInputElement>('input')];
        expect(inputs.every((x) => x.disabled), `step ${i + 1}`).toBe(g.hasAttribute('data-off'));
      }
    }
  });

  it('k slider writes k', () => {
    const { player, host } = make();
    mountSecimParams(host, player);
    player.goto(3);
    setSlider(slider(host, 'k'), 2);
    expect(player.state.params.k).toBe(2);
    expect(ctl(slider(host, 'k')).querySelector('output')!.textContent).toBe('2');
    player.goto(4);
    expect(slider(host, 'k').value).toBe('4');
    expect(player.state.params.k).toBe(4);
  });

  it('nSelect slider and scaling radio write params', () => {
    const { player, host } = make();
    mountSecimParams(host, player);
    player.goto(6);
    setSlider(slider(host, 'nSelect'), 3);
    expect(player.state.params.nSelect).toBe(3);
    const std = radios(host, 'scaling').find((r) => r.value === 'standard')!;
    std.checked = true;
    std.dispatchEvent(new Event('change'));
    expect(player.state.params.scaling).toBe('standard');
  });

  it('vt radio writes vt', () => {
    const { player, host } = make();
    mountSecimParams(host, player);
    player.goto(1);
    const r = radios(host, 'vt').find((x) => x.value === '10')!;
    r.checked = true;
    r.dispatchEvent(new Event('change'));
    expect(player.state.params.vt).toBe(10);
    expect(checked(host, 'vt')).toBe('10');
  });
});

describe('mountSecimExtra', () => {
  const visible = (host: HTMLElement): string[] =>
    [...host.querySelectorAll<HTMLElement>('.secim-extra p:not(.live-note)')]
      .filter((e) => !e.hidden).map((e) => e.textContent!);

  it('extra shows feature engineering, embedded methods and the comparison table', () => {
    const { player, host } = make();
    mountSecimExtra(host, player);
    const t0 = visible(host);
    expect(t0).toHaveLength(1);
    expect(t0[0]).toContain('Özellik mühendisliği var olan sütunlardan yeni sütun türetir');
    expect(host.querySelectorAll('table.methods tbody tr')).toHaveLength(3);
    expect([...host.querySelectorAll('table.methods thead th')].map((t) => t.textContent))
      .toEqual(['Tür', 'Örnek', 'Hız', 'Etkileşim']);
    player.goto(5);
    const t1 = visible(host);
    expect(t1).toHaveLength(1);
    expect(t1[0]).toContain('Gömülü yöntemler seçimi modelin eğitimi sırasında yapar');
    expect(host.querySelectorAll('table.methods tbody tr')).toHaveLength(3);
    for (const i of [0, 3, 6, 9]) {
      player.goto(i);
      expect(host.querySelector('p.live-note')!.textContent).toBe(deriveSecimView(i, player.state.params).note);
    }
    player.goto(3);
    player.setParam('k', 2);
    expect(host.querySelector('p.live-note')!.textContent).toBe(deriveSecimView(3, player.state.params).note);
  });
});
