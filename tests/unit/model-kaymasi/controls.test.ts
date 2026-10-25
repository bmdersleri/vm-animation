// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { LAB_MONTHS, THRESHOLD, modelKaymasiScenario as sc } from '../../../src/concepts/model-kaymasi/scenario';
import { SCENARIO_IDS } from '../../../src/concepts/model-kaymasi/data';
import { labTextTests } from '../lab-text';
import { go, setup, texts } from './harness';

labTextTests(sc.steps, [3, 4, 5, 6, 7, 8, 10]);

const select = (host: HTMLElement, key: string) => host.querySelector<HTMLSelectElement>(`select[data-param="${key}"]`)!;
const range = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`input[type="range"][data-param="${key}"]`)!;

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const visible = (host: HTMLElement): string[] =>
  [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);

describe('model-kaymasi Lab controls', () => {
  it('kavram shows no input alarm and an accuracy alarm at 15 known at 18', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'aylik-izleme');
    choose(select(host, 'scenario'), String(SCENARIO_IDS.indexOf('kavram')));
    expect(el.querySelector('[data-read="alarms"]')!.textContent).toContain('yok');
    expect(el.querySelectorAll('.alarm-mark')).toHaveLength(0);
    const acc = el.querySelector('[data-read="acc"]')!.textContent!;
    expect(acc).toContain('ay 15');
    expect(acc).toContain('ay 18');
    expect(el.querySelector('.monitor-note')!.textContent).toBe('Girdi izlemesi kavram kaymasını görmez.');
    expect(el.querySelector('.monitor')!.getAttribute('data-scenario')).toBe('kavram');
    // the performance alarm reads in the accuracy strip as low points
    expect(el.querySelectorAll('.acc-dot.is-low').length).toBeGreaterThan(0);
  });

  it('psi metric switches the threshold range and default', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'aylik-izleme');
    const slider = range(host, 'threshold');
    expect([slider.min, slider.max, slider.step]).toEqual(['1', '20', '0.5']);
    expect(Number(slider.value)).toBe(THRESHOLD.mean.def);
    slide(slider, 11);
    choose(select(host, 'metric'), 'psi');
    expect(player.state.params.metric).toBe('psi');
    expect(player.state.params.threshold).toBe(THRESHOLD.psi.def);
    expect([slider.min, slider.max, slider.step]).toEqual(['0.05', '1', '0.05']);
    expect(Number(slider.value)).toBe(THRESHOLD.psi.def);
    expect(host.querySelector('.threshold-value')!.textContent).toBe('0,25');
    expect(texts(el, '.lc-ref-label')[0]).toBe('0,25');
    choose(select(host, 'metric'), 'mean');
    expect(player.state.params.threshold).toBe(THRESHOLD.mean.def);
    expect([slider.min, slider.max]).toEqual(['1', '20']);
    expect(host.querySelector('.threshold-value')!.textContent).toBe('8,0');
  });

  it('esik slider moves the badge', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'fark-esik');
    expect(visible(host)).toEqual(['esik']);
    slide(range(host, 'esik'), 20);
    expect(host.querySelector('.esik-value')!.textContent).toBe('20,0');
    expect(el.querySelector('.status-badge')!.getAttribute('data-status')).toBe('NORMAL');
    slide(range(host, 'esik'), 3);
    expect(el.querySelector('.status-badge')!.getAttribute('data-status')).toBe('UYARI');
  });

  it('month choice redraws the histogram pair and the terms', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'psi');
    const month = select(host, 'month');
    expect([...month.options].map((o) => Number(o.value))).toEqual(
      Array.from({ length: LAB_MONTHS.max - LAB_MONTHS.min + 1 }, (_v, i) => LAB_MONTHS.min + i),
    );
    const before = texts(el, '.psi-term');
    choose(month, '9');
    expect(player.state.params.month).toBe(9);
    expect(texts(el, '.psi-term')).not.toEqual(before);
    go(player, 'ortalama-yaniltir');
    const share = (): string[] => [...el.querySelectorAll('.hist-cur')].map((b) => b.getAttribute('data-share')!);
    const at9 = share();
    choose(month, '20');
    expect(share()).not.toEqual(at9);
  });

  it('only the step\'s controls are visible', () => {
    const { host, player } = setup(745, 530, 'lab');
    const expected: Record<string, string[]> = {
      'fark-esik': ['esik'],
      'veri-kavram': ['scenario'],
      'aylik-izleme': ['scenario', 'metric', 'threshold'],
      'esik-secimi': ['scenario', 'metric', 'threshold'],
      'ortalama-yaniltir': ['scenario', 'month'],
      psi: ['scenario', 'month'],
      'hata-ayiklama': ['fixed'],
    };
    for (const [id, keys] of Object.entries(expected)) {
      go(player, id);
      expect(visible(host), id).toEqual(keys);
      expect(host.hasAttribute('data-off'), id).toBe(false);
    }
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup(745, 530, 'lab');
    for (const id of ['alti-ay-sonra', 'iki-donem', 'alarm-akisi']) {
      go(player, id);
      expect(visible(host), id).toEqual([]);
      expect(host.hasAttribute('data-off'), id).toBe(true);
      expect(host.querySelector('.kayma-params')!.hasAttribute('data-off'), id).toBe(true);
    }
  });

  it('Ders story ignores the Lab choices', () => {
    const { host, el, player } = setup(1280, 540, 'ders');
    go(player, 'veri-kavram');
    choose(select(host, 'scenario'), '0');
    expect(el.querySelectorAll('.drift-panel')).toHaveLength(2);
  });
});
