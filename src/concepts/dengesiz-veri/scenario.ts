import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { metrics } from '../degerlendirme/metrics';
import { BOOK01, MODELS2D } from '../dengesiz/data';
import { BALANCED, COUNTS, copiesFor, exampleFor, MAX_SYNTHETIC, SWEEP_RATIOS } from './model';

/**
 * Parameters of the imbalanced-data page.
 * `showTest` draws the test points; `k`, `seed` and `ratio` drive SMOTE (ratio = minority /
 * majority target); `weight` and `manualWeight` the class weights; `method` and `threshold`
 * the decision-boundary steps (Ders shows all three methods at 0,5).
 */
export interface ImbParams {
  showTest: boolean;
  k: number;
  seed: number;
  ratio: number;
  weight: 'yok' | 'dengeli' | 'elle';
  manualWeight: number;
  method: 'yok' | 'smote' | 'agirlik';
  threshold: number;
}

const K0 = 5;
const SEED0 = 42;

const ALL = COUNTS.all;
const TRAIN = COUNTS.train;
const TEST = COUNTS.test;
const TOTAL = ALL.neg + ALL.pos;
const TRAIN_TOTAL = TRAIN.neg + TRAIN.pos;
const TEST_TOTAL = TEST.neg + TEST.pos;

const bookM = metrics(BOOK01.matrix);
const ex = exampleFor(K0, SEED0);
const maxCopies = Math.max(...copiesFor(SEED0, 1));
const share = Math.round(TRAIN.neg / TRAIN.pos);

const aps = [MODELS2D.base.ap, MODELS2D.smote.ap, MODELS2D.weighted.ap];
const apTexts = aps.map((ap) => f(ap, 3));
const apText = apTexts.every((t) => t === apTexts[0])
  ? `üçünde de aynı (${apTexts[0]})`
  : `neredeyse aynı (${f(Math.min(...aps), 3)}–${f(Math.max(...aps), 3)})`;
const caught = (m: { tp: number; fn: number }): string => `${m.tp} / ${m.tp + m.fn}`;

/** The step scenario of the imbalanced-data page (Ders steps 1-10). */
export const dengesizVeriScenario: Scenario<ImbParams> = {
  defaults: {
    showTest: true,
    k: K0,
    seed: SEED0,
    ratio: 1,
    weight: 'yok',
    manualWeight: 15,
    method: 'yok',
    threshold: 0.5,
  },
  steps: [
    {
      id: 'veri',
      title: 'Veri',
      text: `${TOTAL} müşteri, ${ALL.pos} ayrılan (${pct(ALL.pos / TOTAL, 1)}). Ayrılanlar kısa kıdemli ve yüksek ücretli köşede biraz daha sık, ama kalanların arasına karışmış.`,
      labText: 'Test noktalarını gösterip gizleyin: noktaların hangi müşterilere ait olduğu değişmez, yalnız kümenin bir bölümü ekrandan kalkar.',
    },
    {
      id: 'dogruluk',
      title: 'Doğruluk tuzağı',
      term: 'doğruluk tuzağı (accuracy paradox)',
      text: `Test ${TEST_TOTAL} müşteri; kitabın modeli kimseye "ayrılır" demiyor: matris [[${BOOK01.matrix.tn}, ${BOOK01.matrix.fp}], [${BOOK01.matrix.fn}, ${BOOK01.matrix.tp}]], doğruluk ${pct(bookM.accuracy!, 1)}. Herkese "kalır" demek de ${pct(TEST.neg / TEST_TOTAL, 1)} verir.`,
      labText: 'Test noktalarını gösterip gizleyin. Matris kitabın modelinindir; noktaların görünmesi matrisi değiştirmez.',
    },
    {
      id: 'azinlik',
      title: 'Azınlığın gözüyle',
      text: `Ayrılan sınıfı için duyarlılık ${BOOK01.matrix.tp} / ${BOOK01.matrix.tp + BOOK01.matrix.fn} = ${f(bookM.recall!, 0)}, kesinlik tanımsız (${BOOK01.matrix.tp} / ${BOOK01.matrix.tp + BOOK01.matrix.fp}), F1 ${f(bookM.f1!, 0)}. Doğruluk azınlığı gizler; ayrılanların metriği ayrıca okunur.`,
      labText: 'Test noktalarını gösterip gizleyin. Azınlık satırındaki metrikler kitabın modelinden gelir, ekrandaki noktalardan değil.',
    },
    {
      id: 'egitim',
      title: 'Eğitim kümesi',
      text: `Katmanlı 70/30 bölme: eğitim ${TRAIN.neg} kalan / ${TRAIN.pos} ayrılan (yaklaşık ${share}:1); test noktaları soluklaşıp kenara çekilir. Dengeleme yalnız eğitimde yapılacak.`,
      labText: 'Test noktalarını geri açın: soluk noktalar eğitimde kullanılmaz, dengeleme onlara dokunmaz.',
      params: { showTest: false },
    },
    {
      id: 'sentetik',
      title: 'Bir sentetik nokta',
      term: 'SMOTE',
      text: `Bir ayrılan x_i seçilir (kıdem ${f(ex.xi.tenure, 0)} ay, ücret ${f(ex.xi.charge, 2)}); ${K0} en yakın ayrılan komşusuna ince çizgiler çekilir ve biri seçilir (x_zi). λ = ${f(ex.lambda, 2)} ile x_new = (${f(ex.xnew.tenure, 1)} ay; ${f(ex.xnew.charge, 2)}) aradaki doğru parçasının üstüne konur.`,
      labText: 'Komşu sayısı k ile başka nokta düğmesini deneyin: komşu çizgileri, λ ve şeritteki sayılar birlikte değişir.',
    },
    {
      id: 'smote-doldur',
      title: 'SMOTE eğitimi doldurur',
      text: `Tarama 0 → ${MAX_SYNTHETIC} sentetik nokta; ayrılan sayısı ${TRAIN.pos} → ${TRAIN.pos + MAX_SYNTHETIC}, sayım ${TRAIN.neg} | ${TRAIN.neg}. Hiçbir satır kopyalanmadı; noktalar ayrılanların arasına serpildi.`,
      labText: 'k, hedef oran ve tohumu değiştirin: sentetik nokta sayısı ve konumları canlı güncellenir.',
      sweep: { key: 'ratio', values: [...SWEEP_RATIOS], intervalMs: 150 },
    },
    {
      id: 'kopyalama',
      title: 'Kopyalamadan farkı',
      text: `Rastgele kopyalama aynı ${TRAIN.pos} noktayı çoğaltır; en çok kopyalanan nokta ×${maxCopies + 1} olur. SMOTE aradaki bölgeyi doldurur. Kopya modeli aynı noktaları ezberlemeye iter; ama sentetik nokta yeni bir müşteri değildir.`,
      labText: 'Komşu sayısını, hedef oranı ve tohumu değiştirin: iki panelde de eklenen nokta sayısı aynıdır, yalnız eklenme biçimi ayrılır.',
      params: { ratio: 1 },
    },
    {
      id: 'agirlik',
      title: 'Sınıf ağırlığı',
      term: 'sınıf ağırlığı (class weight)',
      text: `Satır eklenmez; ayrılan noktalar ağırlıklarıyla büyür: ${f(BALANCED.pos, 2)} = ${TRAIN_TOTAL} / (2 · ${TRAIN.pos}), kalan ${f(BALANCED.neg, 2)} = ${TRAIN_TOTAL} / (2 · ${TRAIN.neg}). Bir ayrılanı kaçırmak, ${share} kalanı yanlış alarmlamak kadar pahalı.`,
      labText: 'Ağırlığı yok, dengeli ya da elle seçin: elle seçtiğinizde ayrılanın ağırlığını kendiniz belirlersiniz ve noktaların boyu buna göre değişir.',
      params: { weight: 'dengeli' },
    },
    {
      id: 'sinir',
      title: 'Karar sınırı',
      text: `İki özellikli üç model, p = 0,5 sınırı: ağırlıksız model testte ${caught(MODELS2D.base.matrix)} ayrılanı yakalar (sınır alanın dışında), SMOTE ${caught(MODELS2D.smote.matrix)} (${MODELS2D.smote.matrix.fp} yanlış alarm), ağırlıklı ${caught(MODELS2D.weighted.matrix)} (${MODELS2D.weighted.matrix.fp} yanlış alarm).`,
      labText: 'Yöntemi, eşiği ve dengeleme ayarlarını değiştirin: model tarayıcıda yeniden kurulur; sınır çizgisi ve test matrisi canlı güncellenir.',
    },
    {
      id: 'karsilastirma',
      title: 'Ne değişti?',
      text: `Üç yöntem karşılaştırılır; PR-AUC ${apText}. Dengeleme sıralamayı değil eşiği kaydırdı: aynı şeyi eşiği düşürerek de elde edebilirdik.`,
      labText: 'Yöntemi, eşiği ve ayarları değiştirin: seçtiğiniz yapılandırma tabloya dördüncü satır olarak eklenir.',
    },
  ],
};

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(dengesizVeriScenario, id));

/** Steps drawn by the scatter and side panel. */
export const SCATTER_STEPS = indices('veri', 'dogruluk', 'azinlik', 'egitim', 'sentetik');

/** Steps drawn by the SMOTE scenes. */
export const SMOTE_STEPS = indices('smote-doldur', 'kopyalama');

/** Steps drawn by the class-weight scene. */
export const WEIGHT_STEPS = indices('agirlik');

/** Steps drawn by the decision-boundary scenes. */
export const BOUNDARY_STEPS = indices('sinir', 'karsilastirma');

/** Steps whose Lab shows the test-points switch. */
export const SHOW_TEST_STEPS = indices('veri', 'dogruluk', 'azinlik', 'egitim');
