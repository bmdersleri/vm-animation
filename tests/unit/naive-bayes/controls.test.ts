// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { nbScenario, type NbParams } from '../../../src/concepts/naive-bayes/scenario';
import { mountNbParams } from '../../../src/concepts/naive-bayes/controls';
import { mountNbExtra } from '../../../src/concepts/naive-bayes/extra';
import { createNbPointer } from '../../../src/concepts/naive-bayes/main';

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<NbParams>; host: HTMLElement } {
  const player = new StepPlayer(nbScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

describe('mountNbParams', () => {
  it('prior slider step is 0.1%', () => {
    const { player, host } = make();
    mountNbParams(host, player);
    const slider = host.querySelector<HTMLInputElement>('input[data-param="prior"]')!;
    expect([slider.min, slider.max, slider.step]).toEqual(['0.1', '50', '0.1']);
    const sens = host.querySelector<HTMLInputElement>('input[data-param="sens"]')!;
    expect([sens.min, sens.max, sens.step]).toEqual(['50', '99', '1']);
    const fpr = host.querySelector<HTMLInputElement>('input[data-param="fpr"]')!;
    expect([fpr.min, fpr.max, fpr.step]).toEqual(['1', '50', '1']);
    expect(slider.value).toBe('1');
    slider.value = '2.5';
    slider.dispatchEvent(new Event('input'));
    expect(player.state.params.prior).toBe(0.025);
    expect(host.querySelector('output[for="' + slider.id + '"]')!.textContent).toBe('%2,5');
    player.setParam('prior', 0.1);
    expect(slider.value).toBe('10');
  });

  it('word buttons build words in click order', () => {
    const { player, host } = make();
    mountNbParams(host, player);
    const btns = [...host.querySelectorAll<HTMLButtonElement>('button[data-word]')];
    expect(btns.length).toBe(8);
    const by = (w: string): HTMLButtonElement => btns.find((b) => b.dataset.word === w)!;
    by('toplantı').click();
    by('bedava').click();
    expect(player.state.params.words).toEqual(['toplantı', 'bedava']);
    expect(by('bedava').getAttribute('aria-pressed')).toBe('true');
    expect(by('rapor').getAttribute('aria-pressed')).toBe('false');
    by('toplantı').click();
    expect(player.state.params.words).toEqual(['bedava']);
    expect(by('toplantı').getAttribute('aria-pressed')).toBe('false');
    player.goto(6);
    expect(by('kazandınız').getAttribute('aria-pressed')).toBe('true');
  });

  it('laplace checkbox follows step 9 sweep', () => {
    const { player, host } = make();
    mountNbParams(host, player);
    const lap = host.querySelector<HTMLInputElement>('input[data-param="alpha"]')!;
    const reg = host.querySelector<HTMLInputElement>('input[data-param="regions"]')!;
    player.goto(9);
    expect(lap.checked).toBe(false);
    expect(player.state.params.alpha).toBe(0);
    player.setParam('alpha', 1);
    expect(lap.checked).toBe(true);
    lap.checked = false;
    lap.dispatchEvent(new Event('change'));
    expect(player.state.params.alpha).toBe(0);
    reg.checked = true;
    reg.dispatchEvent(new Event('change'));
    expect(player.state.params.regions).toBe(true);
    reg.checked = false;
    reg.dispatchEvent(new Event('change'));
    expect(player.state.params.regions).toBe(false);
    player.setParam('regions', true);
    expect(reg.checked).toBe(true);
  });
});

describe('mountNbExtra', () => {
  it('extra shows the exact value only when it differs', async () => {
    const { player, host } = make();
    mountNbExtra(host, player);
    await frame();
    const exact = host.querySelector<HTMLElement>('.nb-extra-exact')!;
    // 9/108 = 8.33 % against exact 8.26 %: differs by less than 0.1 point
    player.goto(2);
    await frame();
    expect(exact.hidden).toBe(true);
    // 0.5 % prior: 5 sick, 5 true positives, 50 false positives: 9.1 % vs exact 8.3 %
    player.setParams({ prior: 0.005, sens: 0.9, fpr: 0.05 });
    await frame();
    expect(exact.hidden).toBe(false);
    expect(exact.textContent).toMatch(/^kesin değer: %\d+,\d$/);
    player.setParams({ prior: 0.1, sens: 0.9, fpr: 0.1 });
    await frame();
    expect(exact.hidden).toBe(true);
  });

  it('shows the word table at the current alpha and the book sentence in part 3', async () => {
    const { player, host } = make();
    mountNbExtra(host, player);
    player.goto(9);
    await frame();
    const rapor = [...host.querySelectorAll('.nb-extra-words tbody tr')]
      .find((r) => r.firstElementChild!.textContent === 'rapor')!;
    expect([...rapor.children].map((c) => c.textContent)).toEqual(['rapor', '0,020', '0,000']);
    player.setParam('alpha', 1);
    await frame();
    expect([...rapor.children].map((c) => c.textContent)).toEqual(['rapor', '0,023', '0,005']);
    expect(host.querySelector('.nb-extra-hata')!.hasAttribute('hidden')).toBe(true);
    player.goto(11);
    await frame();
    const hata = [...host.querySelectorAll<HTMLElement>('.nb-extra-hata')].at(-1)!; // Hata 2
    expect(hata.hidden).toBe(false);
    expect(hata.querySelector('code')!.textContent).toBe('predict_proba');
    expect(hata.textContent).toContain('Sınıflandırma kararı (hangi sınıf daha olası) çoğunlukla doğru kalsa da');
  });

  it('part 3 names the book\'s Hata 1 above Hata 2, in the same markup', async () => {
    const { player, host } = make();
    mountNbExtra(host, player);
    player.goto(11);
    await frame();
    const blocks = [...host.querySelectorAll<HTMLElement>('.nb-extra-hata')];
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => !b.hidden)).toBe(true);
    const [h1, h2] = blocks;
    expect(h1.querySelector('.nb-extra-hata-title')!.textContent).toBe('Hata 1 — Kategorik/metin verisinde GaussianNB kullanmak');
    expect(h1.querySelector('.nb-extra-hata-title code')!.textContent).toBe('GaussianNB');
    expect(h1.querySelector('p:not(.nb-extra-hata-title)')!.innerHTML).toBe(
      '<code>GaussianNB</code>, her özniteliğin sınıf içinde normal dağıldığını varsayar; kategorik veya sayım (count) verisinde bu varsayım geçersizdir ve yanlış olasılık tahminlerine yol açar.',
    );
    expect(h2.querySelector('.nb-extra-hata-title')!.textContent).toMatch(/^Hata 2 — /);
    player.goto(9);
    await frame();
    expect(blocks.every((b) => b.hidden)).toBe(true);
  });
});

describe('createNbPointer', () => {
  it('drags the query only in Lab, steps 11-13 (indices 10-12)', () => {
    const { player } = make();
    let lab = true;
    const ptr = createNbPointer(player, () => lab);
    player.goto(5);
    ptr({ t: 30, c: 2 }, 'down');
    expect(player.state.params.query).toEqual({ t: 18, c: 1 });
    player.goto(10);
    ptr({ t: 30, c: 2 }, 'down');
    expect(player.state.params.query).toEqual({ t: 30, c: 2 });
    ptr({ t: 31, c: 2.5 }, 'move');
    expect(player.state.params.query).toEqual({ t: 31, c: 2.5 });
    lab = false;
    ptr({ t: 40, c: 3 }, 'move');
    expect(player.state.params.query).toEqual({ t: 31, c: 2.5 });
    lab = true;
    player.goto(12);
    ptr({ t: 40, c: 3 }, 'move');
    expect(player.state.params.query).toEqual({ t: 40, c: 3 });
    player.goto(9);
    ptr({ t: 50, c: 4 }, 'move');
    expect(player.state.params.query).toEqual({ t: 40, c: 3 });
  });
});
