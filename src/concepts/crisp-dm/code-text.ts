import type { CodeBug, CodeLine } from '../../core/plot/code-panel';
import { BOOK } from './data';

/** The six bugs of the book's `KafeAnalizi` exercise ("Hata türleri", in the book's order); `fix` is the corrected code's badge. */
export const BUGS: readonly CodeBug[] = [
  { n: 1, kind: 'sözdizimi hatası', what: '= karşılaştırma değil atama', fix: '== ile karşılaştırılır' },
  { n: 2, kind: 'tür hatası', what: '"100" metin, ortalamaya katılamaz', fix: 'pd.to_numeric ile sayıya çevrildi' },
  { n: 3, kind: 'mantık hatası', what: 'mean çağrılmamış (parantez yok)', fix: 'mean() parantezle çağrıldı' },
  { n: 4, kind: 'tür hatası', what: 'metin ile sayı + ile birleşmez', fix: 'f-string sayıyı metne yazar' },
  { n: 5, kind: 'anahtar hatası', what: 'olmayan_sutun diye sütun yok', fix: 'var olan kayıtların sayısı yazdırılır' },
  { n: 6, kind: 'veri kalitesi hatası', what: 'eksik değer ele alınmamış', fix: 'dropna() eksik değeri çıkarır' },
];

const line = (text: string, extra: Partial<CodeLine> = {}): CodeLine => ({ text, bugs: [], ...extra });

/** The book's faulty code, verbatim. Bug 6 sits on the data line that holds the `None`. */
export const BUGGY_CODE: readonly CodeLine[] = [
  line('# // File: KafeAnalizi.python'),
  line('# Bu örnekte sözdizimi, mantık ve tür hataları vardır.'),
  line('# Amaç, sınav haftasındaki ortalama satışı hesaplamaktır.'),
  line(''),
  line('import pandas as pd'),
  line(''),
  line('satisVerisi = pd.DataFrame({"sinav": [True, False, True], "adet": [90, "100", None]})', { bugs: [2, 6] }),
  line('sinavVerisi = satisVerisi[satisVerisi["sinav"] = True]', { bugs: [1] }),
  line('ortalama = sinavVerisi["adet"].mean', { bugs: [3] }),
  line('print("Ortalama: " + ortalama)', { bugs: [4] }),
  line('print(satisVerisi["olmayan_sutun"])', { bugs: [5] }),
];

const { mean, count } = BOOK.kafeAnalizi;

/** The printed lines of the corrected code, as Python prints them. */
export const OUTPUT: readonly string[] = [`Ortalama: ${mean.toFixed(1)}`, `Kayıt sayısı: ${count}`];

/** The book's corrected code; each changed line lists the bugs it fixes (bug 5's faulty line is dropped: the count line replaces it). */
export const FIXED_CODE: readonly CodeLine[] = [
  line('# // File: KafeAnalizi.python'),
  line('# Satış sütunu güvenli biçimde sayısala dönüştürülür.'),
  line('# Eksik değerler hesaplamadan önce çıkarılır.'),
  line('# Yalnızca sınav haftası kayıtları filtrelenir.'),
  line(''),
  line('import pandas as pd'),
  line(''),
  line('satisVerisi = pd.DataFrame({"sinav": [True, False, True], "adet": [90, "100", None]})'),
  line('satisVerisi["adet"] = pd.to_numeric(satisVerisi["adet"], errors="coerce")', { fix: true, bugs: [2] }),
  line(''),
  line('sinavVerisi = satisVerisi[satisVerisi["sinav"] == True]', { fix: true, bugs: [1] }),
  line('ortalama = sinavVerisi["adet"].dropna().mean()', { fix: true, bugs: [3, 6] }),
  line(''),
  line('print(f"Ortalama: {ortalama}")', { fix: true, bugs: [4] }),
  line('print("Kayıt sayısı:", len(sinavVerisi))', { fix: true, bugs: [5] }),
  line(''),
  line('# Beklenen Çıktı:'),
  ...OUTPUT.map(text => line(`# ${text}`)),
];
