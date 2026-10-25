import { describe, expect, it } from 'vitest';
import { BOOK } from '../../../src/concepts/crisp-dm/data';
import { BUGGY_CODE, BUGS, FIXED_CODE } from '../../../src/concepts/crisp-dm/code-text';

describe('crisp-dm code text', () => {
  it('the faulty code is the book text', () => {
    expect(BUGGY_CODE.map(l => l.text)).toEqual([
      '# // File: KafeAnalizi.python',
      '# Bu örnekte sözdizimi, mantık ve tür hataları vardır.',
      '# Amaç, sınav haftasındaki ortalama satışı hesaplamaktır.',
      '',
      'import pandas as pd',
      '',
      'satisVerisi = pd.DataFrame({"sinav": [True, False, True], "adet": [90, "100", None]})',
      'sinavVerisi = satisVerisi[satisVerisi["sinav"] = True]',
      'ortalama = sinavVerisi["adet"].mean',
      'print("Ortalama: " + ortalama)',
      'print(satisVerisi["olmayan_sutun"])',
    ]);
  });

  it('the corrected code is the book text with the output from data', () => {
    expect(FIXED_CODE.map(l => l.text)).toEqual([
      '# // File: KafeAnalizi.python',
      '# Satış sütunu güvenli biçimde sayısala dönüştürülür.',
      '# Eksik değerler hesaplamadan önce çıkarılır.',
      '# Yalnızca sınav haftası kayıtları filtrelenir.',
      '',
      'import pandas as pd',
      '',
      'satisVerisi = pd.DataFrame({"sinav": [True, False, True], "adet": [90, "100", None]})',
      'satisVerisi["adet"] = pd.to_numeric(satisVerisi["adet"], errors="coerce")',
      '',
      'sinavVerisi = satisVerisi[satisVerisi["sinav"] == True]',
      'ortalama = sinavVerisi["adet"].dropna().mean()',
      '',
      'print(f"Ortalama: {ortalama}")',
      'print("Kayıt sayısı:", len(sinavVerisi))',
      '',
      '# Beklenen Çıktı:',
      `# Ortalama: ${BOOK.kafeAnalizi.mean.toFixed(1)}`,
      `# Kayıt sayısı: ${BOOK.kafeAnalizi.count}`,
    ]);
  });

  it('each of the six bugs is placed exactly once in the faulty code, and each is fixed', () => {
    const placed = (lines: typeof BUGGY_CODE, n: number): number => lines.filter(l => l.bugs.includes(n)).length;
    expect(BUGS.map(b => b.n)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const b of BUGS) {
      expect(placed(BUGGY_CODE, b.n), `bug ${b.n}`).toBe(1);
      expect(placed(FIXED_CODE, b.n), `fix ${b.n}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('each bug has a fix text of its own, none repeating the bug description', () => {
    for (const b of BUGS) {
      expect(b.fix, `bug ${b.n}`).toBeTruthy();
      expect(b.fix).not.toBe(b.what);
      expect(b.fix).not.toContain(b.what);
    }
    expect(new Set(BUGS.map(b => b.fix)).size).toBe(BUGS.length);
  });
});
