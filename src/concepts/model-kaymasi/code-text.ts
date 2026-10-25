import type { CodeBug, CodeLine } from '../../core/plot/code-panel';

/** The four faults of the book's `HataAyiklama` exercise ("Hata türleri", in the book's order); the fourth is a design gap, not a code error. */
export const BUGS: readonly CodeBug[] = [
  { n: 1, kind: 'tür hatası', what: 'kayma_farki metin, sayıyla karşılaştırılamaz', fix: 'float(...) ile sayıya çevrildi' },
  { n: 2, kind: 'sıfıra bölme', what: 'toplam_sayi sıfır olabilir', fix: 'payda 0 ise 0.0 döner' },
  { n: 3, kind: 'kişisel veri', what: 'telefon numarası açık yazdırılıyor', fix: 'telefon yerine anonim müşteri kodu' },
  { n: 4, kind: 'tasarım eksiği', what: 'eşiğin gerekçesi ve kaydı yok', fix: 'kodda düzelmez: eşiğin gerekçesi kayda yazılmalı' },
];

/** What the faulty program prints when it stops at the first fault (shown under the code panel). */
export const RUN_ERROR = "TypeError: '>' not supported between instances of 'str' and 'int'";

const CUSTOMER_CODE = 'M-1042';

/** The ratio the corrected function returns; the empty denominator gives 0. */
const risk = (positive: number, total: number): number => (total === 0 ? 0 : positive / total);

/** The two lines the corrected program prints, as Python prints them. */
export const OUTPUT: readonly string[] = [
  `UYARI: ${CUSTOMER_CODE} segmentinde inceleme gerekli.`,
  `Risk oranı: ${risk(3, 0).toFixed(2)}`,
];

const line = (text: string, extra: Partial<CodeLine> = {}): CodeLine => ({ text, bugs: [], ...extra });

/** The book's faulty code, verbatim. Bug 1 sits on the text assignment, bug 4 on the unexplained threshold. */
export const BUGGY_CODE: readonly CodeLine[] = [
  line('# File: HataAyiklama.python'),
  line('# Eşik karşılaştırmasında veri türü hatası vardır.'),
  line('# Bölme işlemi sıfıra bölme riski taşır.'),
  line('# Gizli bilgi doğrudan ekrana yazdırılmamalıdır.'),
  line(''),
  line('def risk_orani_hesapla(olumlu_sayi, toplam_sayi):'),
  line('    return olumlu_sayi / toplam_sayi', { bugs: [2] }),
  line(''),
  line('musteri_telefonu = "05321234567"'),
  line('kayma_farki = "12.5"', { bugs: [1] }),
  line('if kayma_farki > 10:', { bugs: [4] }),
  line('    print("UYARI:", musteri_telefonu)', { bugs: [3] }),
  line(''),
  line('print(risk_orani_hesapla(3, 0))'),
  line('# Çıktı: Program hata vermeden güvenli uyarı üretmelidir.'),
  line('# Çıktı: Telefon numarası görünmemelidir.'),
];

/** The book's corrected code; each changed line lists the bugs it fixes, once per bug; bug 4 (the missing rationale) sits on the unchanged threshold line, as a note that the fix is outside the code. */
export const FIXED_CODE: readonly CodeLine[] = [
  line('# File: HataAyiklama.python'),
  line('# Sayısal değer açıkça float türüne dönüştürülür.'),
  line('# Sıfır payda için güvenli sonuç üretilir.'),
  line('# Kişisel veri yerine anonim müşteri kodu kullanılır.'),
  line(''),
  line('def risk_orani_hesapla(olumlu_sayi: int, toplam_sayi: int) -> float:', { fix: true }),
  line('    if toplam_sayi == 0:', { fix: true, bugs: [2] }),
  line('        return 0.0', { fix: true }),
  line('    return olumlu_sayi / toplam_sayi'),
  line(''),
  line(`musteri_kodu = "${CUSTOMER_CODE}"`, { fix: true, bugs: [3] }),
  line('kayma_farki = float("12.5")', { fix: true, bugs: [1] }),
  line(''),
  line('if kayma_farki > 10:', { bugs: [4] }),
  line(`    print(f"UYARI: {musteri_kodu} segmentinde inceleme gerekli.")`, { fix: true }),
  line(''),
  line('print(f"Risk oranı: {risk_orani_hesapla(3, 0):.2f}")', { fix: true }),
  ...OUTPUT.map(text => line(`# Çıktı: ${text}`)),
];
