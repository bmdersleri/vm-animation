// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNumber as f, formatPercent } from '../../../src/core/plot/format';
import { BASELINE, BOOK, META, cellOf } from '../../../src/concepts/crisp-dm/data';
import { go, num, setup, texts } from './harness';

describe('phase cards', () => {
  it('step 2 shows the book goal and the service row', () => {
    const { el, player } = setup();
    go(player, 'is-anlama');
    expect(el.querySelector('.crisp-stage')!.getAttribute('data-card')).toBe('goal');
    const dict = el.querySelector('.goal-dict')!;
    expect(texts(dict, 'code.goal-key')).toEqual(['amac', 'basari_olcutu', 'veri_sorusu']);
    expect(dict.textContent).toContain(BOOK.isHedefi.basari_olcutu);
    expect(el.querySelector('.service-row')!.textContent).toContain(`kaçan talep en çok ${formatPercent(META.criteria.service, 0)}`);
    expect(el.querySelector('.formula')!.textContent).toContain('En sık hata, modelleme evresinden başlamaktır.');
  });

  it('step 3 marks the stockout row', () => {
    const { el, player } = setup();
    go(player, 'veri-anlama');
    expect(el.querySelectorAll('.cafe-table tbody tr')).toHaveLength(4);
    const rows = el.querySelectorAll('.cafe-table tr.row-stockout');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Kahve');
    expect(rows[0].textContent).toContain(String(BOOK.kafeVerisi.find((r) => r.stok_tukendi && r.urun === 'Kahve')!.satis_adedi));
    expect(el.querySelector('.table-note')!.textContent).toBe('satış, talebin alt sınırıdır');
  });

  it('step 4 summarises the 56 days and answers yes', () => {
    const { el, player } = setup();
    go(player, 'veri-yeterli');
    const s = el.querySelector('.data-summary')!;
    expect(texts(s, '.summary-label')).toEqual(['Gün', 'Normal gün', 'Sınav günü', 'Stok tükenen gün', 'Eksik kayıt']);
    expect(s.querySelector('.summary-decision')!.textContent).toContain('Evet');
  });

  it('step 5 reads the book means', () => {
    const { el, player } = setup();
    go(player, 'eksik-sifir-degil');
    const kahve = el.querySelector('.mean-compare[data-group="kahve"]')!;
    expect(kahve.querySelector('[data-k="fill0"]')!.textContent).toBe(f(BOOK.hamVeri.kahveFillna0, 1));
    expect(kahve.querySelector('[data-k="skip"]')!.textContent).toBe(f(BOOK.hamVeri.kahveAtlanir, 1));
    const exam = el.querySelector('.mean-compare[data-group="sinav"]')!;
    const zero = cellOf(56, 'sifir', 'soran', false);
    const skip = cellOf(56, 'cikar', 'soran', false);
    expect(exam.querySelector('[data-k="fill0"]')!.textContent).toBe(f(zero.pred.sinav!, 2));
    expect(exam.querySelector('[data-k="skip"]')!.textContent).toBe(f(skip.pred.sinav!, 2));
    expect(el.querySelectorAll('.clean-table tbody tr').length).toBe(BOOK.hamVeri.once.length);
  });

  it('step 6 lists the wrong and the right inputs', () => {
    const { el, player } = setup();
    go(player, 'sizinti');
    expect(texts(el, '.leak-wrong li code')).toEqual(BOOK.sizinti.yanlisGirdiler);
    expect(texts(el, '.leak-right li code')).toEqual(BOOK.sizinti.dogruGirdiler);
    expect(el.querySelector('.leak-record')!.textContent).toContain('ay_sonu_israfi');
    expect(el.querySelector('.leak-card')!.textContent).toContain('Değerlendirmede iyi görünür, sahada yoktur.');
  });

  it('step 7 bars read the group means', () => {
    const { el, player } = setup();
    go(player, 'modelleme');
    const cell = cellOf(56, 'cikar', 'satis', false);
    const normal = el.querySelector('.group-bar[data-group="normal"]')!;
    const sinav = el.querySelector('.group-bar[data-group="sinav"]')!;
    expect(normal.querySelector('.bar-value')!.textContent).toBe(f(cell.pred.normal!, 2));
    expect(sinav.querySelector('.bar-value')!.textContent).toBe(f(cell.pred.sinav!, 2));
    expect(num(sinav.querySelector('rect.bar')!, 'width')).toBeGreaterThan(num(normal.querySelector('rect.bar')!, 'width'));
    expect(el.querySelector('.order-rule')!.textContent).toBe('sipariş = 1,10 × grup ortalaması');
  });

  it('step 8 evaluation fails the service condition', () => {
    const { el, player } = setup();
    go(player, 'degerlendirme');
    const cell = cellOf(56, 'cikar', 'satis', false);
    const col = (k: string) => el.querySelector(`.result-col[data-col="${k}"]`)!;
    expect(col('base').textContent).toContain(f(BASELINE.wasteRate! * 100, 1));
    const waste = col('eval').querySelector('.cond[data-cond="waste"]')!;
    const service = col('eval').querySelector('.cond[data-cond="service"]')!;
    expect(waste.getAttribute('data-ok')).toBe('true');
    expect(waste.textContent).toContain('✓');
    expect(waste.textContent).toContain('tutar');
    expect(service.getAttribute('data-ok')).toBe('false');
    expect(service.textContent).toContain('✗');
    expect(service.textContent).toContain('tutmaz');
    expect(col('eval').textContent).toContain(f(cell.eval.lostShare! * 100, 1));
    expect(el.querySelector('.result-col[data-col="deploy"]')).toBeNull();
    expect(el.querySelector('.result-board')!.classList.contains('is-hypothetical')).toBe(false);
    expect(el.querySelector('.result-note')!.textContent).toContain('stok tükenmiş');
  });

  it('step 9 reaches the deployment rule and links to model drift', () => {
    const { el, player } = setup();
    go(player, 'ikinci-tur');
    expect(el.querySelector('.result-col[data-col="deploy"]')).not.toBeNull();
    expect(el.querySelector('.deploy-rule')!.textContent).toMatch(/^Sınav haftasında \d+(–\d+)?, diğer günler \d+(–\d+)? sandviç/);
    expect(el.querySelector('.deploy-rule a')!.getAttribute('href')).toBe('../model-kaymasi/');
    for (const c of el.querySelectorAll('.cond')) {
      expect(c.getAttribute('data-ok')).toBe('true');
    }
  });

  it('an empty group reads veri yok', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'modelleme');
    player.setParams({ days: 14 });
    const sinav = el.querySelector('.group-bar[data-group="sinav"]')!;
    expect(sinav.querySelector('.bar-value')!.textContent).toBe('veri yok');
    expect(el.querySelector('.group-bar[data-group="normal"] .bar-value')!.textContent).not.toBe('veri yok');
  });

  it('a faded result board says yine de denenseydi', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'degerlendirme');
    player.setParams({ days: 4 });
    const board = el.querySelector('.result-board')!;
    expect(board.classList.contains('is-hypothetical')).toBe(true);
    expect(board.querySelector('.result-title')!.textContent).toContain('yine de denenseydi');
  });
});
