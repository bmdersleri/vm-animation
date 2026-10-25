// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { cellOf } from '../../../src/concepts/crisp-dm/data';
import { crispDmScenario as sc } from '../../../src/concepts/crisp-dm/scenario';
import { labTextTests } from '../lab-text';
import { go, setup } from './harness';

labTextTests(sc.steps, [4, 5, 6, 7, 8, 9, 10]);

const select = (host: HTMLElement, key: string) => host.querySelector<HTMLSelectElement>(`select[data-param="${key}"]`)!;
const box = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`input[type="checkbox"][data-param="${key}"]`)!;

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function toggle(input: HTMLInputElement, on: boolean): void {
  input.checked = on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const visible = (host: HTMLElement): string[] =>
  [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);
const cond = (el: Element, col: string, c: string) => el.querySelector(`.result-col[data-col="${col}"] .cond[data-cond="${c}"]`)!.getAttribute('data-ok');

describe('crisp-dm Lab controls', () => {
  it('offers the four choices with the brief options', () => {
    const { host } = setup(745, 530, 'lab');
    expect([...select(host, 'days').options].map((o) => o.value)).toEqual(['4', '14', '28', '56']);
    expect([...select(host, 'missing').options].map((o) => o.textContent)).toEqual(['0 ile doldur', 'işaretle ve çıkar']);
    expect([...select(host, 'stock').options].map((o) => o.textContent)).toEqual(['satış = talep say', 'satış + soran (alt sınır)']);
    expect(box(host, 'leak')).not.toBeNull();
    expect(box(host, 'fixed')).not.toBeNull();
    expect(select(host, 'days').value).toBe('56');
    expect(select(host, 'missing').value).toBe('cikar');
    expect(select(host, 'stock').value).toBe('soran');
  });

  it('leak passes evaluation and fails deployment', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'ikinci-tur');
    toggle(box(host, 'leak'), true);
    expect(cond(el, 'eval', 'waste')).toBe('true');
    expect(cond(el, 'eval', 'service')).toBe('true');
    expect(cond(el, 'deploy', 'waste') === 'false' || cond(el, 'deploy', 'service') === 'false').toBe(true);
    expect(el.querySelector('.flow-edge.tone-alarm')).not.toBeNull();
    expect(el.querySelector('.path-reason')!.getAttribute('data-node')).toBe('ya');
    const cell = cellOf(56, 'cikar', 'soran', true);
    expect(cell.eval.ok && !cell.deploy.ok).toBe(true);
  });

  it('the leak step shows both coefficients', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'sizinti');
    const coef = cellOf(56, 'cikar', 'soran', true).leakCoef!;
    expect(el.querySelector('.leak-coef[data-leak="on"]')!.textContent).toContain(f(coef, 3));
    expect(el.querySelector('.leak-coef[data-leak="off"]')!.textContent).toContain('girdide değil');
    expect(el.querySelector('.leak-coef.is-active')!.getAttribute('data-leak')).toBe('off');
    toggle(box(host, 'leak'), true);
    expect(el.querySelector('.leak-coef.is-active')!.getAttribute('data-leak')).toBe('on');
  });

  it('four days stop at the first decision', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'veri-yeterli');
    choose(select(host, 'days'), '4');
    expect(el.querySelector('.flow-node.is-current')!.getAttribute('data-node')).toBe('d1');
    expect(el.querySelector('.flow-edge[data-edge="d1-ia"]')!.getAttribute('class')).toContain('is-path');
    expect(el.querySelector('.summary-decision')!.textContent).toContain('Hayır');
    expect(el.querySelector('.summary-decision')!.textContent).toContain('✗');
  });

  it('four days fade the results', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'ikinci-tur');
    choose(select(host, 'days'), '4');
    expect(el.querySelector('.result-board')!.classList.contains('is-hypothetical')).toBe(true);
    choose(select(host, 'days'), '56');
    expect(el.querySelector('.result-board')!.classList.contains('is-hypothetical')).toBe(false);
  });

  it('zero fill fails one condition', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'degerlendirme');
    choose(select(host, 'missing'), 'sifir');
    expect(el.querySelectorAll('.cond[data-ok="false"]').length).toBeGreaterThan(0);
  });

  it('only the step controls are visible', () => {
    const { host, player } = setup(745, 530, 'lab');
    for (const id of ['veri-yeterli', 'eksik-sifir-degil', 'sizinti', 'modelleme', 'degerlendirme', 'ikinci-tur']) {
      go(player, id);
      expect(visible(host), id).toEqual(['days', 'missing', 'stock', 'leak']);
    }
    go(player, 'hata-ayiklama');
    expect(visible(host)).toEqual(['fixed']);
    expect(box(host, 'fixed').parentElement!.textContent).toContain('düzeltilmiş kodu göster');
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup(745, 530, 'lab');
    for (const id of ['sorun', 'is-anlama', 'veri-anlama']) {
      go(player, id);
      expect(host.hasAttribute('data-off'), id).toBe(true);
      expect(host.querySelector('.crisp-params')!.hasAttribute('data-off'), id).toBe(true);
      expect(visible(host)).toEqual([]);
    }
    go(player, 'modelleme');
    expect(host.hasAttribute('data-off')).toBe(false);
    expect(host.querySelector('.crisp-params')!.hasAttribute('data-off')).toBe(false);
  });

  it('the fixed switch redraws the code and the controls follow the player state', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'hata-ayiklama');
    toggle(box(host, 'fixed'), true);
    expect(player.state.params.fixed).toBe(true);
    expect(el.querySelector('.code-output')).not.toBeNull();
    // the controls are rewritten from the state on every change, also when the state moves without them
    player.setParams({ fixed: false });
    expect(box(host, 'fixed').checked).toBe(false);
    player.setParams({ days: 28, missing: 'sifir', stock: 'satis', leak: true });
    expect(select(host, 'days').value).toBe('28');
    expect(select(host, 'missing').value).toBe('sifir');
    expect(select(host, 'stock').value).toBe('satis');
    expect(box(host, 'leak').checked).toBe(true);
  });
});
