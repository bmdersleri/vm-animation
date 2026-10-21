// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { iqrAykiriScenario, type IqrParams } from '../../../src/concepts/iqr-aykiri/scenario';
import { mountIqrParams } from '../../../src/concepts/iqr-aykiri/controls';
import { mountIqrExtra } from '../../../src/concepts/iqr-aykiri/extra';

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<IqrParams>; host: HTMLElement } {
  const player = new StepPlayer(iqrAykiriScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const radios = (host: HTMLElement, name: string): HTMLInputElement[] =>
  [...host.querySelectorAll<HTMLInputElement>(`input[type=radio][name=${name}]`)];
const checked = (host: HTMLElement, name: string): string | undefined =>
  radios(host, name).find((r) => r.checked)?.value;

describe('mountIqrParams', () => {
  it('slider writes extreme and follows the step', () => {
    const { player, host } = make();
    mountIqrParams(host, player);
    const s = host.querySelector<HTMLInputElement>('input[type=range][data-param=extreme]')!;
    expect([s.min, s.max, s.step]).toEqual(['50', '500', '1']);
    const out = host.querySelector('output')!;
    expect(out.textContent).toBe('200,00 TL');
    s.value = '300';
    s.dispatchEvent(new Event('input'));
    expect(player.state.params.extreme).toBe(300);
    expect(out.textContent).toBe('300,00 TL');
    player.goto(5);
    expect(s.value).toBe('480');
    expect(out.textContent).toBe('480,00 TL');
  });

  it('radios follow the step and disable outside their part', () => {
    const { player, host } = make();
    mountIqrParams(host, player);
    expect(radios(host, 'fill').map((r) => r.value)).toEqual(['yok', 'ortalama', 'medyan']);
    expect(radios(host, 'k').map((r) => r.value)).toEqual(['1.5', '3']);
    expect(radios(host, 'action').map((r) => r.value)).toEqual(['yok', 'sil', 'kirp']);
    player.goto(3);
    expect(checked(host, 'fill')).toBe('ortalama');
    expect(radios(host, 'fill').every((r) => !r.disabled)).toBe(true);
    expect(radios(host, 'k').every((r) => r.disabled)).toBe(true);
    expect(radios(host, 'action').every((r) => r.disabled)).toBe(true);
    player.goto(10);
    expect(checked(host, 'action')).toBe('kirp');
    expect(checked(host, 'k')).toBe('1.5');
    expect(radios(host, 'fill').every((r) => r.disabled)).toBe(true);
    expect(radios(host, 'k').every((r) => !r.disabled)).toBe(true);
    const sil = radios(host, 'action').find((r) => r.value === 'sil')!;
    sil.checked = true;
    sil.dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.action).toBe('sil');
    const k3 = radios(host, 'k').find((r) => r.value === '3')!;
    k3.checked = true;
    k3.dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.k).toBe(3);
  });
});

describe('mountIqrParams hide-by-step rule', () => {
  const offGroups = (host: HTMLElement): string[] =>
    [...host.querySelectorAll<HTMLElement>('fieldset.ctl')]
      .filter((f) => f.dataset.off === 'true').map((f) => f.querySelector('legend')!.textContent!);

  it('marks Doldurma off in steps 6-11 and IQR katsayısı / Müdahale off in steps 1-5', () => {
    const { player, host } = make();
    mountIqrParams(host, player);
    for (let i = 0; i < 11; i++) {
      player.goto(i);
      expect(offGroups(host), `step ${i + 1}`).toEqual(i <= 4 ? ['IQR katsayısı', 'Müdahale'] : ['Doldurma']);
    }
  });

  it('every off group has only disabled radios; the slider group is never off', () => {
    const { player, host } = make();
    mountIqrParams(host, player);
    for (let i = 0; i < 11; i++) {
      player.goto(i);
      for (const f of host.querySelectorAll<HTMLElement>('fieldset.ctl')) {
        const dis = [...f.querySelectorAll<HTMLInputElement>('input')].every((r) => r.disabled);
        expect(f.dataset.off === 'true', `step ${i + 1} ${f.textContent}`).toBe(dis);
      }
      expect(host.querySelector<HTMLElement>('.ctl.range')!.dataset.off).toBeUndefined();
      expect(host.querySelector<HTMLInputElement>('input[type=range]')!.disabled).toBe(false);
    }
  });
});

describe('mountIqrExtra', () => {
  const texts = (host: HTMLElement): string[] =>
    [...host.querySelectorAll('.iqr-extra p')].map((p) => p.textContent ?? '');

  it('extra part 1 shows MCAR/MAR/MNAR, the mode example and the live note', () => {
    const { player, host } = make();
    mountIqrExtra(host, player);
    const t = texts(host);
    expect(t.slice(0, 4)).toEqual([
      'MCAR (tamamen rastgele eksik): eksiklik hiçbir değişkenle ilişkili değildir; örneğin bir sensör rastgele arıza yapar.',
      'MAR (rastgele eksik): eksiklik gözlenen başka bir değişkenle ilişkilidir; örneğin yaşlı müşteriler çevrimiçi formdaki alanları daha sık boş bırakır.',
      'MNAR (rastgele olmayan eksik): eksiklik eksik değerin kendisiyle ilişkilidir; örneğin yüksek gelirli müşteriler gelir bilgisini gizler.',
      'Kategorik sütunda mod kullanılır: Aylık, Aylık, boş, Bir Yıllık → boş hücre Aylık olur.',
    ]);
    const note = host.querySelector('p.live-note')!;
    expect(note.textContent).toContain('ortalama');
    expect(host.querySelectorAll('.iqr-extra p.live-note').length).toBe(1);
    expect(host.querySelector('.iqr-extra')!.lastElementChild).toBe(note);
    player.setParam('extreme', 300);
    expect(note.textContent).toContain('300');
  });

  it('extra part 2 shows the whisker rule, the √7 bound and the book\'s formula error', () => {
    const { player, host } = make();
    mountIqrExtra(host, player);
    player.goto(8);
    const ps = [...host.querySelectorAll<HTMLElement>('.iqr-extra p')].filter((p) => !p.hidden);
    const t = ps.map((p) => p.textContent);
    expect(t).toEqual([
      'Bıyıklar sınırın kendisinde değil, sınırın içindeki en uç gözlemde biter: 29,85 ve 60,20 (matplotlib’in kuralı). Kitabın Şekil 3.2 açıklaması bıyığı sınıra kadar anlatır.',
      'Sekiz gözlemde, ddof = 0 ile hiçbir z değeri √7 ≈ 2,65’i geçemez; bu yüzden |z| > 3 kuralı burada hiçbir şeyi yakalayamaz.',
      'Kitabın hata alıştırmasında üst sınır q3 + 1.5 * q1 diye yazılmış; doğrusu q3 + 1.5 * (q3 - q1).',
      host.querySelector('p.live-note')!.textContent,
    ]);
    const codes = [...ps[2].querySelectorAll('code')].map((c) => c.textContent);
    expect(codes).toEqual(['q3 + 1.5 * q1', 'q3 + 1.5 * (q3 - q1)']);
    expect(host.querySelector('p.live-note')!.textContent).toContain('480');
  });
});
