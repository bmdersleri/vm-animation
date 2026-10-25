import type { Scenario } from '../../core/player';
import { formatNumber as f, formatPercent } from '../../core/plot/format';
import { orderText } from './calc';
import { BASELINE, BOOK, DAYS, META, cellOf, type Days, type Missing, type Stock } from './data';

/**
 * Parameters of the CRISP-DM page: the four Lab choices (training days, missing value handling, stock-out handling,
 * the leaking input), the debugging-code switch of step 10, and `scan`, how far the step's sweep has come
 * (`SCAN_DONE` once finished).
 */
export interface CrispParams {
  days: Days;
  missing: Missing;
  stock: Stock;
  leak: boolean;
  fixed: boolean;
  scan: number;
}

/** The finished value of a sweep (and the default, so a view derived without a sweep shows everything). */
export const SCAN_DONE = Number.POSITIVE_INFINITY;

/** The cells the Ders story walks through (the Lab choices do not touch them). */
export const STORY = {
  first: cellOf(56, 'cikar', 'satis', false),
  second: cellOf(56, 'cikar', 'soran', false),
  zero: cellOf(56, 'sifir', 'soran', false),
};

/** The 56 day pool the models train on. */
export const POOL = DAYS.filter(d => !d.test);

const sandwich = BOOK.kafeVerisi.filter(r => r.urun === 'Sandvic');
const examSandwich = sandwich.filter(r => r.sinav_haftasi);
const poolExam = POOL.filter(d => d.sinav);
const stockOut = POOL.filter(d => d.stokTukendi);
const missing = POOL.filter(d => d.satis === null);
const pct = (v: number | null): string => (v === null ? '—' : formatPercent(v));

/** The deployment rule of the second round, as step 9 and the Lab card write it. */
export const ruleText = (exam: string, other: string): string => `Sınav haftasında ${exam}, diğer günler ${other} sandviç`;

/** The step scenario of the CRISP-DM page (Ders steps 1-10). */
export const crispDmScenario: Scenario<CrispParams> = {
  defaults: { days: 56, missing: 'cikar', stock: 'soran', leak: false, fixed: false, scan: SCAN_DONE },
  steps: [
    {
      id: 'sorun',
      title: 'Sorun: kafede sandviç',
      text: 'Kampüs kafeteryasında bazı günler sandviç öğleden önce biter, bazı günler çok ürün atılır. "Daha çok sipariş" yanıt değildir: gün, sınav haftası, hava, ürün, satış ve stok birlikte okunmalıdır. Döngü altı evreden oluşur; jeton İş anlama\'da.',
    },
    {
      id: 'is-anlama',
      title: 'İş anlama',
      term: 'iş anlama',
      text: `Kitabın isHedefi sözlüğü: amaç "${BOOK.isHedefi.amac}", başarı ölçütü "${BOOK.isHedefi.basari_olcutu}", veri sorusu "${BOOK.isHedefi.veri_sorusu}". Sayfanın eklediği hizmet koşulu: kaçan talep en çok ${formatPercent(META.criteria.service, 0)} (israfı sıfırlamanın yolu hiç hazırlamamaktır).`,
    },
    {
      id: 'veri-anlama',
      title: 'Veri anlama',
      term: 'veri anlama',
      text: 'Kitabın dört satırlık kafeVerisi tablosu; gözlem birimi gün-ürün. Mart ayının üçüncü günündeki Kahve satırı (stok tükendi) vurgulu: satış, talebin alt sınırıdır; stok bitince gelen müşteri kayda geçmez.',
    },
    {
      id: 'veri-yeterli',
      title: 'Veri yeterli mi? Hayır',
      text: `Veri yetmiyor: sandviç için ${sandwich.length} kayıt, sınav haftasında ${examSandwich.length}. Geri kenar İş anlama'ya döner, veri sorusu "8 haftalık günlük kayıt" olur. Yeni tablo ${POOL.length} gün: ${POOL.length - poolExam.length} normal, ${poolExam.length} sınav günü; ${stockOut.length} gününde stok tükenmiş, ${missing.length} kayıt eksik. Her grupta en az ${META.minGroup} gün var: Evet.`,
      labText:
        'Gün sayısını seçin: kart her grubun kalan gün sayısını gösterir ve yol, veri yetmiyorsa ilk karardan İş anlama evresine geri döner.',
      sweep: { key: 'scan', values: [1, 2, 3, 4], intervalMs: 2500 },
    },
    {
      id: 'eksik-sifir-degil',
      title: 'Veri hazırlama: eksik sıfır değildir',
      term: 'eksik değer',
      text: `Kitabın ham verisi ("kahve", " Kahve ", None) strip().title() ile temizlenir. Kahve ortalaması fillna(0) ile ${f(BOOK.hamVeri.kahveFillna0, 1)}, eksik atlanınca ${f(BOOK.hamVeri.kahveAtlanir, 1)}. Aynı hata ${POOL.length} günde: sınav günü ortalaması ${f(STORY.second.pred.sinav!, 2)} iken eksikler 0 yapılınca ${f(STORY.zero.pred.sinav!, 2)} olur. Eksikler stok tükenen sınav günlerinde; işaretle ve çıkar.`,
      labText:
        'Gün sayısını, eksik değer işlemini ve stok tükenen günlerin sayımını seçin: kart eksik kayıt sayısını ve grup ortalamalarına etkisini yeniden hesaplar.',
    },
    {
      id: 'sizinti',
      title: 'Veri hazırlama: sızıntı',
      term: 'veri sızıntısı',
      text: 'ay_sonu_israfi ayın sonunda kesinleşir; tahmin yapılan gün bilinmez. Girdilerden çıkarılır, kitabın doğru girdisi yalnız sıcaklıktır. Girdide kalırsa değerlendirmede iyi görünür, sahada yoktur.',
      labText:
        'Sızıntı seçimini açıp kapatın: kart ay_sonu_israfi katsayısını ve girdi listesini gösterir; yol, sahada başarım düşerse yaygınlaştırmadan sonra İş anlama evresine döner.',
    },
    {
      id: 'modelleme',
      title: 'Modelleme: ilk hipotez',
      term: 'modelleme',
      text: `${POOL.length} günde sınav haftasına göre ortalama satış: normal ${f(STORY.first.pred.normal!, 2)}, sınav ${f(STORY.first.pred.sinav!, 2)}. Sipariş kuralı: sipariş = ${f(META.margin, 2)} × grup ortalaması (${orderText(STORY.first, false)} / ${orderText(STORY.first, true)}). Not: satış talep sayıldı.`,
      labText:
        'Dört seçimi değiştirin: çubuklar ve sipariş kuralı seçime göre yeniden kurulur; verisi olmayan grup "veri yok" yazar.',
    },
    {
      id: 'degerlendirme',
      title: 'Değerlendirme: sonuç uygun mu? Hayır',
      term: 'değerlendirme',
      text: `Test penceresinde sabit ${META.oldOrder} siparişin israf oranı ${pct(BASELINE.wasteRate)}. Kural israfı düşürür (düşüş ${pct(STORY.first.eval.reduction)}) ama kaçan talep ${pct(STORY.first.eval.lostShare)}: hizmet koşulu tutmaz. Geri kenar Veri anlama'ya döner. Eğitimdeki ${poolExam.filter(d => d.stokTukendi).length} sınav günü stok tükenmişti; satış hep ${Math.max(...poolExam.map(d => d.satis ?? 0))}: sınav talebi bu sayı sanıldı.`,
      labText:
        'Dört seçimi değiştirin: pano taban, değerlendirme ve yaygınlaştırma sütunlarını yeniden hesaplar; iki koşul işaretle gösterilir.',
      sweep: { key: 'scan', values: [1, 2, 3], intervalMs: 2500 },
    },
    {
      id: 'ikinci-tur',
      title: 'İkinci tur ve yaygınlaştırma',
      term: 'yaygınlaştırma',
      text: `Veri anlama'da tükenince soran sütunu açılır: sınav tahmini ${f(STORY.second.pred.sinav!, 2)} olur. Değerlendirme yeniden: düşüş ${pct(STORY.second.eval.reduction)}, kaçan talep ${pct(STORY.second.eval.lostShare)}; iki koşul tutar. Yaygınlaştırma kuralı: ${ruleText(orderText(STORY.second, true), orderText(STORY.second, false))}. İzleme dış döngüyle İş anlama'ya döner. Kural kullanılırken bozulabilir: Bölüm 14, model kayması.`,
      labText:
        'Dört seçimi değiştirin: yol seçimin tek turunu izler; sızıntı açıksa değerlendirme tutsa da sahadaki sonuç tutmaz ve dış döngü uyarı rengine döner.',
      sweep: { key: 'scan', values: [1, 2, 3, 4, 5, 6, 7], intervalMs: 2200 },
    },
    {
      id: 'hata-ayiklama',
      title: 'Hata ayıklama',
      text: `Kitabın KafeAnalizi kodunda altı hata sırayla işaretlenir. Düzeltilmiş kod "Ortalama: ${BOOK.kafeAnalizi.mean.toFixed(1)}" ve "Kayıt sayısı: ${BOOK.kafeAnalizi.count}" yazar; ortalamaya giren ${BOOK.kafeAnalizi.used} değer var, eksik olan çıkarılmıştır.`,
      labText: 'Düzeltilmiş kodu göster anahtarıyla hatalı ve düzeltilmiş kod arasında geçin.',
      sweep: { key: 'scan', values: [1, 2, 3, 4, 5, 6, 7], intervalMs: 1600 },
    },
  ],
};
