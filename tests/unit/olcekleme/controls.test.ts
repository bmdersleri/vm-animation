// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { FIT_STEPS, SCATTER_STEPS, olceklemeScenario, type OlcParams } from '../../../src/concepts/olcekleme/scenario';
import { mountOlcParams } from '../../../src/concepts/olcekleme/controls';
import { mountOlcExtra } from '../../../src/concepts/olcekleme/extra';
import { createOlcPointer } from '../../../src/concepts/olcekleme/main';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<OlcParams>; host: HTMLElement } {
  const player = new StepPlayer(olceklemeScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const radios = (host: HTMLElement, name: string): HTMLInputElement[] =>
  [...host.querySelectorAll<HTMLInputElement>(`input[type=radio][name=${name}]`)];
const checked = (host: HTMLElement, name: string): string | undefined =>
  radios(host, name).find((r) => r.checked)?.value;
const pick = (host: HTMLElement, name: string, value: string): void => {
  const r = radios(host, name).find((x) => x.value === value)!;
  r.checked = true;
  r.dispatchEvent(new Event('change'));
};

describe('mountOlcParams hide-by-step rule', () => {
  it('a group is marked off exactly when its radios are disabled (Birim/Ölçekleme: scatter steps, fit: split steps)', () => {
    const { player, host } = make();
    mountOlcParams(host, player);
    const groups = [...host.querySelectorAll<HTMLElement>('fieldset.ctl')];
    expect(groups).toHaveLength(3);
    for (let i = 0; i < 13; i++) {
      player.goto(i);
      const off = groups.map((g) => g.dataset.off === 'true');
      expect(off, `step ${i + 1}`).toEqual([
        !SCATTER_STEPS.includes(i), !SCATTER_STEPS.includes(i), !FIT_STEPS.includes(i),
      ]);
      groups.forEach((g, k) => {
        expect([...g.querySelectorAll<HTMLInputElement>('input')].every((r) => r.disabled)).toBe(off[k]);
      });
    }
  });
});

describe('mountOlcParams', () => {
  it('radios follow the steps and disable outside them', () => {
    const { player, host } = make();
    mountOlcParams(host, player);
    expect(host.querySelector('div.knn-params.olc-params')).not.toBeNull();
    expect(radios(host, 'unit').map((r) => r.value)).toEqual(['ay', 'yil', 'gun']);
    expect(radios(host, 'scaling').map((r) => r.value)).toEqual(['yok', 'standard']);
    expect(radios(host, 'fit').map((r) => r.value)).toEqual(['egitim', 'tum']);
    player.goto(5);
    expect(checked(host, 'scaling')).toBe('standard');
    expect(radios(host, 'unit').every((r) => !r.disabled)).toBe(true);
    expect(radios(host, 'fit').every((r) => r.disabled)).toBe(true);
    player.goto(3);
    expect(checked(host, 'scaling')).toBe('yok');
    player.goto(7);
    expect(radios(host, 'unit').every((r) => r.disabled)).toBe(true);
    expect(radios(host, 'scaling').every((r) => r.disabled)).toBe(true);
    player.goto(11);
    expect(checked(host, 'fit')).toBe('tum');
    expect(radios(host, 'fit').every((r) => !r.disabled)).toBe(true);
  });

  it('radios write the params', () => {
    const { player, host } = make();
    mountOlcParams(host, player);
    player.goto(1);
    pick(host, 'unit', 'yil');
    expect(player.state.params.unit).toBe('yil');
    pick(host, 'scaling', 'standard');
    expect(player.state.params.scaling).toBe('standard');
    player.goto(10);
    pick(host, 'fit', 'tum');
    expect(player.state.params.fit).toBe('tum');
  });
});

describe('createOlcPointer', () => {
  const q = { t: 30, f: 90 };
  it('pointer works only in lab at steps 1-7 and 9', () => {
    const { player } = make();
    const spy = vi.spyOn(player, 'setParam');
    const lab = createOlcPointer(player, () => true);
    const ders = createOlcPointer(player, () => false);
    player.goto(1);
    ders(q, 'down');
    ders(q, 'move');
    expect(spy).not.toHaveBeenCalled();
    lab(q, 'down');
    expect(spy).toHaveBeenCalledWith('query', q);
    lab({ t: 40, f: 100 }, 'move');
    expect(player.state.params.query).toEqual({ t: 40, f: 100 });
    lab({ t: 50, f: 120 }, 'up');
    expect(player.state.params.query).toEqual({ t: 40, f: 100 });
    spy.mockClear();
    for (const i of [7, 9, 10]) {
      player.goto(i);
      lab(q, 'move');
    }
    expect(spy).not.toHaveBeenCalled();
    player.goto(8);
    lab(q, 'move');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('mountOlcExtra', () => {
  it('shows the customer table with the nearest row', () => {
    const { player, host } = make();
    mountOlcExtra(host, player);
    player.goto(1);
    const table = host.querySelector('table.cust-table')!;
    expect(table.querySelectorAll('tbody tr').length).toBe(7);
    expect(table.querySelectorAll('tbody tr:not(.query-row)').length).toBe(6);
    expect(table.querySelector('tr.nearest')!.textContent).toContain('M3');
    expect([...table.querySelectorAll('th')].map((h) => h.textContent)).toEqual([
      'Müşteri', 'Hizmet süresi (ay)', 'Aylık fatura (TL)', 'Uzaklık',
    ]);
    expect(table.querySelector('tr.query-row')!.textContent).toContain('Yeni');
    expect(table.querySelector('tbody')!.lastElementChild).toBe(table.querySelector('tr.query-row'));
    expect(table.querySelectorAll('th.z').length).toBe(0);
    player.setParam('scaling', 'standard');
    expect(table.querySelectorAll('th.z').length).toBe(2);
    expect([...table.querySelectorAll('th')].map((h) => h.textContent)).toEqual([
      'Müşteri', 'Hizmet süresi (ay)', 'Aylık fatura (TL)', 'z süre', 'z fatura', 'Uzaklık',
    ]);
    player.setParam('unit', 'gun');
    expect(table.querySelectorAll('th')[1].textContent).toBe('Hizmet süresi (gün)');
    player.goto(9);
    expect(host.querySelector('table.cust-table')!.closest<HTMLElement>('.olc-table-wrap')!.hidden).toBe(true);
  });

  it('extra at step 8 says tree models need no scaling', () => {
    const { player, host } = make();
    mountOlcExtra(host, player);
    player.goto(7);
    const note = host.querySelector<HTMLElement>('p.tree-note')!;
    expect(note.textContent).toBe(
      'Ağaç tabanlı modeller (karar ağacı, Random Forest, XGBoost) her özelliği ayrı eşiklerle böldüğü için ölçeklemeye duyarlı değildir.',
    );
    expect(note.hidden).toBe(false);
    player.goto(6);
    expect(note.hidden).toBe(true);
  });

  it('extra at steps 10-13 lists the three book errors', () => {
    const { player, host } = make();
    mountOlcExtra(host, player);
    const list = host.querySelector<HTMLElement>('ul.book-errors')!;
    player.goto(5);
    expect(list.hidden).toBe(true);
    for (const i of [9, 10, 11, 12]) {
      player.goto(i);
      expect(list.hidden).toBe(false);
      expect([...list.querySelectorAll('li')].map((l) => l.textContent)).toEqual([
        'Test verisinde ölçekleyiciyi yeniden fit etmek: test kendi istatistiğini öğrenir; yalnızca transform kullanılmalı.',
        'Ayrımdan önce tüm veriyi ölçeklemek: test bilgisi eğitim istatistiklerine sızar.',
        'train_test_split’te stratify ve random_state vermemek: sonuç tekrarlanamaz, churn oranı bölünmede bozulabilir.',
      ]);
    }
  });
});
