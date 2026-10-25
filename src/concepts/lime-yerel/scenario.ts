import type { Scenario } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import {
  BINS,
  BOOK,
  CLOUD,
  CUSTOMERS,
  FEATURES,
  KERNEL_WIDTH,
  LIME_RUNS,
  MODEL,
  PRESETS,
  SAMPLE_SIZES,
  SEEDS,
  customerByRow,
  limeRun,
  type Customer,
  type Triple,
} from '../xai/data';
import { kernelWeight, patternDistance } from '../xai/lime';

/**
 * Parameters of the LIME page. `customer` and `compare` are test-customer data rows (preset customers: the Ders
 * uses the book customer 301 and the disagreement customer 77); `width` is the kernel width, `samples` the number
 * of neighbourhood samples (seed 42), `fixed` the debugging-code switch of step 10. `scan` is how far the step-3
 * sweep has come (groups of dots drawn) and `SCAN_DONE` once it is finished.
 */
export interface LimeParams {
  customer: number;
  width: number;
  samples: number;
  compare: number;
  fixed: boolean;
  scan: number;
}

/** The finished value of a sweep (and the default, so a view derived without a sweep shows everything). */
export const SCAN_DONE = Number.POSITIVE_INFINITY;

/** Neighbourhood size and seed of the book run. */
export const BOOK_SAMPLES = SAMPLE_SIZES[SAMPLE_SIZES.length - 1];
export const BOOK_SEED = SEEDS[0];

/** Dots drawn per sweep group in step 3. */
export const DOTS_PER_GROUP = 100;

const f3 = (v: number): string => f(v, 3);
const signed = (v: number): string => (v > 0 ? `+${f3(v)}` : f3(v));
/**
 * The three cut texts of a feature as the book prints them ("17", "41,25", "2294,79"): read from the lime-style
 * rule names, so a cut and its rule always agree (a cut such as 51.595 is written 51.59 by lime).
 */
export function cutTexts(feature: number): string[] {
  return [0, 1, 2].map((k) => {
    const number = /(\d+\.\d+)\s*$/.exec(BINS.names[feature][k])![1];
    return number.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
  });
}
/** A charge as the book prints it: two decimals, no thousands dot. */
export const plainCharge = (v: number): string => f(v, 2).replace(/\./g, '');
/** "0,146 + 0,540 + 0,074 − 0,023": the first number carries its own sign, later ones are written as operators. */
export const sumExpr = (values: readonly number[]): string =>
  values.map((v, i) => (i === 0 ? f3(v) : v < 0 ? `− ${f3(-v)}` : `+ ${f3(v)}`)).join(' ');

const BOOK_ROW = PRESETS[0];
const SECOND_ROW = PRESETS[1];
const book = customerByRow(BOOK_ROW);
const second = customerByRow(SECOND_ROW);
const run = limeRun(BOOK_ROW, BOOK_SEED, BOOK_SAMPLES);
const run2 = limeRun(SECOND_ROW, BOOK_SEED, BOOK_SAMPLES);
const rules = FEATURES.map((_, j) => BINS.names[j][run.bins[j]]);
const absOrder = (v: Triple): number[] => [0, 1, 2].sort((a, b) => Math.abs(v[b]) - Math.abs(v[a]));
const topOf = (v: Triple): number => absOrder(v)[0];
const shapTop = topOf(second.shap);
const limeTop = topOf(run2.fit.coef);
const sameOrder = absOrder(book.shap).join() === absOrder(run.fit.coef).join();
/** The factor of the LIME default kernel width (width = factor * sqrt(features)). */
const FACTOR = KERNEL_WIDTH / Math.sqrt(FEATURES.length);

/** Kernel weights of the patterns that differ in 0, 1, 2 and 3 bins (masks 7, 6, 4, 0 have 3, 2, 1, 0 matches). */
export const WEIGHTS = [7, 6, 4, 0].map((mask) => kernelWeight(patternDistance(mask), KERNEL_WIDTH));

/** Range of the tenure coefficient over the eleven seeds at one sample size, for the book customer. */
function tenureRange(samples: number): string {
  const xs = LIME_RUNS.filter((r) => r.row === BOOK_ROW && r.samples === samples).map((r) => r.fit.coef[0]);
  return `${f3(Math.min(...xs))}–${f3(Math.max(...xs))}`;
}

const describe = (c: Customer): string =>
  `tenure ${f(c.values[0], 0)}, MonthlyCharges ${f(c.values[1], 2)}, TotalCharges ${plainCharge(c.values[2])}`;

/** The step scenario of the LIME page (Ders steps 1-10). */
export const limeYerelScenario: Scenario<LimeParams> = {
  defaults: { customer: BOOK_ROW, width: KERNEL_WIDTH, samples: BOOK_SAMPLES, compare: SECOND_ROW, fixed: false, scan: SCAN_DONE },
  steps: [
    {
      id: 'yerel-soru',
      title: 'Yerel soru',
      text: `Müşteri ${book.row} (${describe(book)}): orman p(ayrılma) = ${f3(book.p)} der. LIME bunu dört adımda yerel bir vekille açıklar: komşuluk üret, kara kutuya sor, yakınlığa göre tart, basit model uydur. Kitabın kod05 satırı şeritte.`,
    },
    {
      id: 'kartil',
      title: 'Kartil bölmeleri',
      term: 'kartil bölmesi',
      text: `${MODEL.nTrain} eğitim müşterisinden her özelliğin ${BINS.cuts[0].length} kartil sınırı: ${FEATURES.map((name, j) => `${name} ${cutTexts(j).join(' / ')}`).join('; ')}. Müşteri ${book.row} için vurgulu bölmeler: ${rules.join(', ')}. LIME sürekli özelliği dört bölmeye ayırır.`,
      labText:
        'Hazır müşteriyi seçin: sayı doğruları ve vurgulu bölmeler seçilen müşteriye göre yenilenir.',
    },
    {
      id: 'komsuluk',
      title: 'Komşuluk örnekleme',
      term: 'komşuluk',
      text: `Örnek sayısı ${run.samples}; bulutta ilk ${CLOUD[BOOK_ROW].p.length} nokta gruplar hâlinde gelir. Her özellik için bölme eğitim sıklığıyla seçilir (tenure bölmelerinde ${BINS.freqs[0].join(' / ')} müşteri), değer bölme içinde kesik normalden çekilir. Yıldız müşteri ${book.row}, ızgara kartil sınırları.`,
      labText:
        'Hazır müşteriyi seçin: bulut, yıldız ve ızgara o müşteri için yeniden çizilir; bulut her zaman sabit tohumlu en büyük örnek sayılı çalıştırmadır.',
      sweep: {
        key: 'scan',
        values: Array.from({ length: CLOUD[BOOK_ROW].p.length / DOTS_PER_GROUP }, (_, i) => i + 1),
        intervalMs: 700,
      },
    },
    {
      id: 'ikili',
      title: 'Kara kutuya sor ve ikiye indir',
      text: `Noktalar modelin olasılığıyla boyanır. Her örnek üç "aynı bölmede mi" işaretine iner: ${run.patterns.length} desen. Üçü de aynı bölmedeki desen ${run.patterns[7].n} örnek, ortalama p = ${f3(run.patterns[7].mean)}; hiçbiri aynı bölmede olmayan desen ${run.patterns[0].n} örnek, ortalama p = ${f3(run.patterns[0].mean)}.`,
      labText:
        'Hazır müşteriyi seçin: noktaların renkleri ve desen tablosu seçilen müşterinin çalıştırmasına göre yenilenir.',
    },
    {
      id: 'cekirdek',
      title: 'Yakınlık ağırlığı',
      term: 'çekirdek genişliği',
      text: `Uzaklık d = √(farklı bölme sayısı): 0, 1, √2, √3. Çekirdek genişliği w = ${f(FACTOR, 2)} · √${FEATURES.length} = ${f3(KERNEL_WIDTH)}; ağırlık √exp(−d² / w²) = ${WEIGHTS.map(f3).join(' / ')}. Müşteriye yakın desen daha çok sayılır.`,
      labText:
        'Hazır müşteriyi, çekirdek genişliğini ve örnek sayısını seçin: eğri, ağırlıklar ve desen tablosu seçilen çalıştırmaya göre yenilenir; örneksiz kalan desenin satırı sıfır örnek yazar.',
    },
    {
      id: 'vekil',
      title: 'Vekil model',
      term: 'vekil model',
      text: `Ağırlıklı Ridge (alpha = 1) kuralları katsayıya çevirir: ${rules.map((r, j) => `${r} ${signed(run.fit.coef[j])}`).join('; ')}; kesişim ${f3(run.fit.intercept)}. Turuncu ayrılmaya iter, mavi kalmaya çeker. Vekil = kesişim + Σ katsayı · işaret.`,
      labText:
        'Hazır müşteriyi, çekirdek genişliğini ve örnek sayısını değiştirin: vekil model yeniden uydurulur, katsayılar ve kesişim canlı yenilenir.',
    },
    {
      id: 'sadakat',
      title: 'Vekil modelin kendisi değil',
      term: 'yerel uyum (R²)',
      text: `Vekilin bu müşteri için tahmini ${sumExpr([run.fit.intercept, ...run.fit.coef])} = ${f3(run.fit.localPred)}; model ${f3(book.p)}. Ağırlıklı R² = ${f3(run.fit.score ?? 0)}. ${rules[0]} ormanın kuralı değil, vekilin bölmesidir.`,
      labText:
        'Hazır müşteriyi, çekirdek genişliğini ve örnek sayısını değiştirin: vekilin tahmini ve yerel uyum her değişiklikte yeniden hesaplanır.',
    },
    {
      id: 'kararlilik',
      title: 'Kararlılık',
      text: `${SEEDS.length} tohumda ${FEATURES[0]} katsayısı: ${BOOK_SAMPLES} örnekle ${tenureRange(BOOK_SAMPLES)}, ${SAMPLE_SIZES[0]} örnekle ${tenureRange(SAMPLE_SIZES[0])}. random_state sabitlenmezse aynı müşteri farklı açıklama alır.`,
      labText:
        'Hazır müşteriyi ve örnek sayısını seçin: seçilen örnek sayısının satırı vurgulanır, her özellik için tohumların katsayıları yeniden çizilir.',
    },
    {
      id: 'shap-lime',
      title: 'SHAP ile LIME',
      text: `Müşteri ${book.row} için iki yöntemin sırası ${sameOrder ? 'aynı' : 'farklı'}. Müşteri ${second.row}: SHAP'ta en büyük katkı ${FEATURES[shapTop]} (${signed(second.shap[shapTop])}), LIME'da ${FEATURES[limeTop]} (${signed(run2.fit.coef[limeTop])}); model p = ${f3(second.p)}, vekil tahmini ${f3(run2.fit.localPred)}. ${CUSTOMERS.length} test müşterisinin ${MODEL.topDisagree} tanesinde en etkili özellik farklı. Uyuşmazlık modeli hatalı yapmaz; veri, bağımlılık ve örnekleme incelenir.`,
      sweep: { key: 'scan', values: [1, 2], intervalMs: 4000 },
      labText:
        'Test müşterilerinden birini seçin: iki pano ve uyuşma rozeti seçilen müşteriye göre yenilenir.',
    },
    {
      id: 'hata-ayiklama',
      title: 'Hata ayıklama',
      text: `Kitabın HataAyiklama kodunda beş hata sırayla işaretlenir; düzeltilmiş kod müşteri ${book.row} için p = ${f3(BOOK.fixedCodeP)} verir. Tahmin başarımı, veri kalitesi, açıklama tutarlılığı ve insan denetimi birlikte bakılır.`,
      sweep: { key: 'scan', values: [1, 2, 3, 4, 5, 6], intervalMs: 1500 },
      labText:
        'Düzeltilmiş kodu göster anahtarıyla hatalı ve düzeltilmiş kod arasında geçin.',
    },
  ],
};
