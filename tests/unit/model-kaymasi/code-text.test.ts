import { describe, expect, it } from 'vitest';
import { BUGGY_CODE, BUGS, FIXED_CODE, OUTPUT, RUN_ERROR } from '../../../src/concepts/model-kaymasi/code-text';

describe('model-kaymasi code text', () => {
  it('the faulty code is the book text', () => {
    expect(BUGGY_CODE.map(l => l.text)).toEqual([
      '# File: HataAyiklama.python',
      '# Eşik karşılaştırmasında veri türü hatası vardır.',
      '# Bölme işlemi sıfıra bölme riski taşır.',
      '# Gizli bilgi doğrudan ekrana yazdırılmamalıdır.',
      '',
      'def risk_orani_hesapla(olumlu_sayi, toplam_sayi):',
      '    return olumlu_sayi / toplam_sayi',
      '',
      'musteri_telefonu = "05321234567"',
      'kayma_farki = "12.5"',
      'if kayma_farki > 10:',
      '    print("UYARI:", musteri_telefonu)',
      '',
      'print(risk_orani_hesapla(3, 0))',
      '# Çıktı: Program hata vermeden güvenli uyarı üretmelidir.',
      '# Çıktı: Telefon numarası görünmemelidir.',
    ]);
  });

  it('the corrected code is the book text', () => {
    expect(FIXED_CODE.map(l => l.text)).toEqual([
      '# File: HataAyiklama.python',
      '# Sayısal değer açıkça float türüne dönüştürülür.',
      '# Sıfır payda için güvenli sonuç üretilir.',
      '# Kişisel veri yerine anonim müşteri kodu kullanılır.',
      '',
      'def risk_orani_hesapla(olumlu_sayi: int, toplam_sayi: int) -> float:',
      '    if toplam_sayi == 0:',
      '        return 0.0',
      '    return olumlu_sayi / toplam_sayi',
      '',
      'musteri_kodu = "M-1042"',
      'kayma_farki = float("12.5")',
      '',
      'if kayma_farki > 10:',
      '    print(f"UYARI: {musteri_kodu} segmentinde inceleme gerekli.")',
      '',
      'print(f"Risk oranı: {risk_orani_hesapla(3, 0):.2f}")',
      '# Çıktı: UYARI: M-1042 segmentinde inceleme gerekli.',
      '# Çıktı: Risk oranı: 0.00',
    ]);
  });

  it('the printed output and the run error are the book text', () => {
    expect(OUTPUT).toEqual(['UYARI: M-1042 segmentinde inceleme gerekli.', 'Risk oranı: 0.00']);
    expect(RUN_ERROR).toBe("TypeError: '>' not supported between instances of 'str' and 'int'");
  });

  it('each of the four bugs is placed exactly once in the faulty code', () => {
    const placed = (lines: typeof BUGGY_CODE, n: number): number => lines.filter(l => l.bugs.includes(n)).length;
    expect(BUGS.map(b => b.n)).toEqual([1, 2, 3, 4]);
    for (const b of BUGS) {
      expect(placed(BUGGY_CODE, b.n), `bug ${b.n}`).toBe(1);
    }
    // the first fault is where the program stops: the text assignment, one line above the comparison
    expect(BUGGY_CODE.findIndex(l => l.bugs.includes(1))).toBe(BUGGY_CODE.findIndex(l => l.text === 'kayma_farki = "12.5"'));
    expect(BUGGY_CODE.find(l => l.bugs.includes(4))!.text).toBe('if kayma_farki > 10:');
  });

  it('the corrected code fixes the three code errors; the design gap is not a code change', () => {
    const fixed = (n: number): number => FIXED_CODE.filter(l => l.bugs.includes(n)).length;
    for (const n of [1, 2, 3]) {
      expect(fixed(n), `fix ${n}`).toBeGreaterThanOrEqual(1);
    }
    expect(fixed(4)).toBe(0);
    for (const l of FIXED_CODE.filter(x => x.bugs.length > 0)) {
      expect(l.fix, l.text).toBe(true);
    }
  });
});
