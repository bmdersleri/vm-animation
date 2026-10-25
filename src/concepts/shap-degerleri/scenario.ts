import type { Scenario } from '../../core/player';
import { formatNumber as f, formatPercent } from '../../core/plot/format';
import { CUSTOMERS, FEATURES, MODEL, PRESETS, customerByRow, type Customer } from '../xai/data';
import { marginals, orderings, shapleyWeight } from '../xai/shapley';
import { fraction, plainCharge, tenureCorrelation } from './calc';

/**
 * Parameters of the SHAP page. `customer` and `second` are test-customer data rows (the Lab picks them; the
 * Ders uses the book customer 301 and the disagreement customer 77); `order` is the index (0-5) of the ordering
 * step 4 highlights; `highlight` is the customer whose dot is ringed in step 9; `colorBy` is the feature index
 * whose value colours the step-9 dots, -1 meaning each row colours by its own feature. `scan` is how far a
 * sweep has come (nodes filled in step 3, orderings filled in step 5) and `SCAN_DONE` once it is finished.
 */
export interface ShapParams {
  customer: number;
  order: number;
  second: number;
  highlight: number;
  colorBy: number;
  scan: number;
}

/** The finished value of a sweep (and the default, so a view derived without a sweep shows everything). */
export const SCAN_DONE = Number.POSITIVE_INFINITY;

/** Trees of the book's forest (`RandomForestClassifier(n_estimators=200)`); the data file does not carry it. */
export const TREES = 200;

const f3 = (v: number): string => f(v, 3);
const signed = (v: number): string => (v > 0 ? `+${f3(v)}` : f3(v));
const order = orderings();
const orderText = (o: readonly number[]): string => o.map((i) => FEATURES[i]).join(' → ');

const BOOK_ROW = PRESETS[0];
const SECOND_ROW = PRESETS[1];
const MID_ROW = PRESETS[2];
const book = customerByRow(BOOK_ROW);
const second = customerByRow(SECOND_ROW);
const mid = customerByRow(MID_ROW);
const m0 = marginals(book.v, order[0]);
const m5 = marginals(book.v, order[order.length - 1]);
const coalitions = 1 << FEATURES.length;
/** Weights of the four coalitions that do not hold a given feature: sizes 0, 1, 1, 2 of 3. */
const weights = [0, 1, 1, 2].map((size) => fraction(shapleyWeight(size, FEATURES.length)));
const topOf = (c: Customer): number => c.shap.reduce((best, v, i) => (Math.abs(v) > Math.abs(c.shap[best]) ? i : best), 0);
const midTop = topOf(mid);

/** "bütün katkılar turuncu" or "tenure +0,200 turuncu; MonthlyCharges −0,273 ve TotalCharges −0,118 mavi". */
function describeParts(c: Customer): string {
  const groups: { sign: 1 | -1; color: string }[] = [
    { sign: 1, color: 'turuncu' },
    { sign: -1, color: 'mavi' },
  ];
  const used = groups
    .map((g) => ({ color: g.color, names: FEATURES.map((name, i) => ({ name, v: c.shap[i] })).filter((p) => (g.sign > 0 ? p.v >= 0 : p.v < 0)) }))
    .filter((g) => g.names.length > 0);
  if (used.length === 1 && used[0].names.length === FEATURES.length) {
    return `bütün katkılar ${used[0].color}`;
  }
  return used.map((g) => `${g.names.map((p) => `${p.name} ${signed(p.v)}`).join(' ve ')} ${g.color}`).join('; ');
}

/** The step scenario of the SHAP page (Ders steps 1-10). */
export const shapDegerleriScenario: Scenario<ShapParams> = {
  defaults: { customer: BOOK_ROW, order: 0, second: SECOND_ROW, highlight: BOOK_ROW, colorBy: -1, scan: SCAN_DONE },
  steps: [
    {
      id: 'kara-kutu',
      title: 'Kara kutu',
      text: `Müşteri ${book.row} (tenure ${f(book.values[0], 0)}, MonthlyCharges ${f(book.values[1], 2)}, TotalCharges ${plainCharge(f(book.values[2], 2))}): ${TREES} ağaçlı orman p(ayrılma) = ${f3(book.p)} der; test doğruluğu ${formatPercent(MODEL.accuracy, 1)}. Tahmin var; gerekçe yok. Kitabın kod01 satırları şeritte.`,
    },
    {
      id: 'genel-onem',
      title: 'Genel önem yön vermez',
      text: `Ormanın feature_importances_ değerleri ${MODEL.importances.map(f3).join(' / ')} (${FEATURES.join(' / ')}). Model tenure'u çok kullanıyor; ama tenure bu müşteride tahmini artırdı mı, azalttı mı? Önem bunu söylemez.`,
    },
    {
      id: 'koalisyon',
      title: 'Koalisyonlar',
      term: 'koalisyon değeri v(S)',
      text: `Kafesin ${coalitions} düğümü (${coalitions} koalisyon) sırayla dolar: v(∅) = ${f3(book.v[0])} temel değer (ağaçların kök düğümlerindeki ayrılma oranının ortalaması), v({${FEATURES[0]}}) = ${f3(book.v[1])} … v(hepsi) = ${f3(book.v[coalitions - 1])}. v(S): yalnız S içindeki özellikler bilinirken ormanın beklenen tahmini; bilinmeyen özellikte ağaç iki dala da gider, eğitim örneği sayısıyla ağırlıklı ortalanır.`,
      sweep: { key: 'scan', values: Array.from({ length: coalitions }, (_, i) => i + 1), intervalMs: 700 },
    },
    {
      id: 'marjinal',
      title: 'Bir sıralamada marjinal katkı',
      text: `${orderText(order[0])} yolu kafeste vurgulu: ${m0.map(signed).join(', ')}; toplam ${f3(book.p - MODEL.base)} = ${f3(book.p)} − ${f3(MODEL.base)}. Başka bir sırada tenure'un katkısı farklıdır: ${orderText(order[order.length - 1])} sırasında ${signed(m5[0])}.`,
    },
    {
      id: 'alti-siralama',
      title: 'Altı sıralamanın ortalaması',
      term: 'Shapley değeri',
      text: `Altı sıralamanın her biri üç marjinal katkı verir; tablo satır satır dolar. Her sütunun ortalaması o özelliğin Shapley değeri φ: ${book.shap.map(f3).join(' / ')}. Formül şeridi kitabın formülü; ağırlıklar ${weights.join(', ')}.`,
      sweep: { key: 'scan', values: Array.from({ length: order.length }, (_, i) => i + 1), intervalMs: 900 },
    },
    {
      id: 'toplam',
      title: 'Toplama: temel değerden tahmine',
      term: 'temel değer φ₀',
      text: `Şelale: ${f3(MODEL.base)} → ${signed(book.shap[0])} → ${signed(book.shap[1])} → ${signed(book.shap[2])} → ${f3(book.p)}. Katkılar temel değerden tahmine tam toplanır: φ₀ + Σ φ = p. Kitabın kod04 tablosu aynı üç katkıyı verir.`,
    },
    {
      id: 'kuvvet',
      title: 'Kuvvet grafiği: iki müşteri',
      term: 'kuvvet grafiği',
      text: `Müşteri ${book.row} (p = ${f3(book.p)}: ${describeParts(book)}) ve müşteri ${second.row} (p = ${f3(second.p)}: ${describeParts(second)}) iki kuvvet çubuğunda, ortak eksende ve temel değer çizgisiyle. Turuncu ayrılmaya iter, mavi kalmaya çeker.`,
    },
    {
      id: 'global',
      title: 'Yerelden globale',
      text: `Ortalama |SHAP| ${MODEL.meanAbsShap.map(f3).join(' / ')} ile feature_importances_ ${MODEL.importances.map(f3).join(' / ')} yan yana. İkisi de tenure'u öne koyar; SHAP olasılık ölçeğinde konuşur, önem ölçütü bölünme kazancında.`,
    },
    {
      id: 'ozet-grafik',
      title: 'Özet grafiği',
      term: 'özet grafiği (summary plot)',
      text: `${CUSTOMERS.length} test müşterisi, her özellik bir satır; nokta konumu SHAP, rengi özellik değeri. tenure satırında yüksek değerler (kırmızı-pembe) sağda: bu sentetik veride uzun süre ayrılma tahminini artırır (değer ile katkı arasındaki korelasyon ${f(tenureCorrelation(), 2)}).`,
    },
    {
      id: 'sinirlar',
      title: 'Sınırlar',
      text: `Dört kart. (a) Global ≠ yerel: müşteri ${mid.row} için en büyük katkı ${FEATURES[midTop]} (${signed(mid.shap[midTop])}), ${FEATURES[0]} ${signed(mid.shap[0])}. (b) Açıklama nedensellik değildir. (c) Ölçek: bu modelde katkı olasılık birimidir, XGBoost'ta log-odds. (d) Sızıntı: yüksek katkılı bir özellik önce hedefle nasıl hesaplandığına bakılarak denetlenir.`,
    },
  ],
};
