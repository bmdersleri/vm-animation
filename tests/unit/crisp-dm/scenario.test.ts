import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { formatNumber as f, formatPercent } from '../../../src/core/plot/format';
import { BASELINE, BOOK, DAYS, META, cellOf } from '../../../src/concepts/crisp-dm/data';
import { SCAN_DONE, crispDmScenario as sc } from '../../../src/concepts/crisp-dm/scenario';
import { labTextTests } from '../lab-text';

const step = (id: string) => sc.steps.find(s => s.id === id)!;
const pool = DAYS.filter(d => !d.test);
const first = cellOf(56, 'cikar', 'satis', false);
const second = cellOf(56, 'cikar', 'soran', false);
const zero = cellOf(56, 'sifir', 'soran', false);

describe('crisp-dm scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map(s => s.id)).toEqual([
      'sorun', 'is-anlama', 'veri-anlama', 'veri-yeterli', 'eksik-sifir-degil',
      'sizinti', 'modelleme', 'degerlendirme', 'ikinci-tur', 'hata-ayiklama',
    ]);
    expect(sc.defaults).toEqual({ days: 56, missing: 'cikar', stock: 'soran', leak: false, fixed: false, scan: SCAN_DONE });
  });

  it('step texts read numbers from data', () => {
    const sandwich = BOOK.kafeVerisi.filter(r => r.urun === 'Sandvic');
    const examSandwich = sandwich.filter(r => r.sinav_haftasi);
    expect(step('veri-yeterli').text).toContain(`sandviç için ${sandwich.length} kayıt, sınav haftasında ${examSandwich.length}`);
    const exam = pool.filter(d => d.sinav);
    const stock = pool.filter(d => d.stokTukendi);
    const missing = pool.filter(d => d.satis === null);
    expect(step('veri-yeterli').text).toContain(`${pool.length} gün`);
    expect(step('veri-yeterli').text).toContain(`${pool.length - exam.length} normal, ${exam.length} sınav`);
    expect(step('veri-yeterli').text).toContain(`${stock.length} gününde stok tükenmiş`);
    expect(step('veri-yeterli').text).toContain(`${missing.length} kayıt eksik`);
    expect(step('eksik-sifir-degil').text).toContain(
      `Kahve ortalaması fillna(0) ile ${f(BOOK.hamVeri.kahveFillna0, 1)}, eksik atlanınca ${f(BOOK.hamVeri.kahveAtlanir, 1)}`,
    );
    expect(step('eksik-sifir-degil').text).toContain(`${f(second.pred.sinav!, 2)} iken eksikler 0 yapılınca ${f(zero.pred.sinav!, 2)}`);
    expect(step('sizinti').text).toContain('ay_sonu_israfi');
    expect(step('modelleme').text).toContain(`normal ${f(first.pred.normal!, 2)}, sınav ${f(first.pred.sinav!, 2)}`);
    expect(step('modelleme').text).toContain(`${first.orders.eval[0]} / ${first.orders.eval[3]}`);
    expect(step('degerlendirme').text).toContain(formatPercent(BASELINE.wasteRate!));
    expect(step('degerlendirme').text).toContain(`düşüş ${formatPercent(first.eval.reduction!)}`);
    expect(step('degerlendirme').text).toContain(`kaçan talep ${formatPercent(first.eval.lostShare!)}`);
    expect(step('degerlendirme').text).toContain(`${exam.filter(d => d.stokTukendi).length} sınav günü`);
    expect(step('ikinci-tur').text).toContain(f(second.pred.sinav!, 2));
    expect(step('ikinci-tur').text).toContain(`düşüş ${formatPercent(second.eval.reduction!)}`);
    expect(step('ikinci-tur').text).toContain(`kaçan talep ${formatPercent(second.eval.lostShare!)}`);
    expect(step('ikinci-tur').text).toContain(`Sınav haftasında ${second.orders.eval[3]}, diğer günler ${second.orders.eval[0]} sandviç`);
    expect(step('hata-ayiklama').text).toContain(`ortalamaya giren ${BOOK.kafeAnalizi.used} değer`);
    expect(step('hata-ayiklama').text).toContain(`Ortalama: ${BOOK.kafeAnalizi.mean.toFixed(1)}`);
    expect(step('is-anlama').text).toContain(formatPercent(META.criteria.service, 0));
    for (const s of sc.steps) {
      expect(s.text, s.id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('no computed number is followed by an apostrophe suffix', () => {
    for (const s of sc.steps) {
      expect(s.text, s.id).not.toMatch(/\d['’][a-zçğıöşü]/i);
    }
  });

  it('no step resets the lab choices', () => {
    for (const s of sc.steps) {
      for (const k of ['days', 'missing', 'stock', 'leak', 'fixed']) {
        expect(Object.keys(s.params ?? {}), s.id).not.toContain(k);
      }
    }
  });

  it('sweeps use scan with the stage counts', () => {
    const sweeps = Object.fromEntries(sc.steps.filter(s => s.sweep).map(s => [s.id, s.sweep!]));
    expect(Object.keys(sweeps)).toEqual(['veri-yeterli', 'degerlendirme', 'ikinci-tur', 'hata-ayiklama']);
    expect(sweeps['veri-yeterli'].values).toHaveLength(4);
    expect(sweeps['degerlendirme'].values).toHaveLength(3);
    expect(sweeps['ikinci-tur'].values).toHaveLength(7);
    expect(sweeps['hata-ayiklama'].values).toHaveLength(7);
    for (const w of Object.values(sweeps)) {
      expect(w.key).toBe('scan');
    }
    expect(stepIndex(sc, 'sorun')).toBe(0);
  });

  labTextTests(sc.steps, [4, 5, 6, 7, 8, 9, 10]);
});
