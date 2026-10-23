import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { BOOTS, CUSTOMERS, NODE_DEMO, OOB_CURVE, OOB_CV, PICKS, RF, type RfRow } from '../topluluk/data';
import { majority, oobScore, oobVotes } from '../topluluk/vote';

/**
 * Parameters of the Random Forest page.
 * `maxFeatures` is the features a node may look at (1-8), `rho` the Random Forest correlation of step 3,
 * `trees` the trees voting in the OOB matrix (or the M of the variance curve), `pick` the marked customer
 * of the OOB matrix, `nEstimators` the tree count of the OOB curve (step 8), `method`/`withId` the importance view.
 */
export interface RfParams {
  maxFeatures: number;
  rho: number;
  trees: number;
  pick: number | null;
  nEstimators: number;
  method: 'mdi' | 'perm';
  withId: boolean;
}

/** The forest row for `max_features` = mf (1-8, clamped). */
export function rfRow(mf: number): RfRow {
  return RF.byMf[Math.max(1, Math.min(RF.byMf.length, Math.round(mf))) - 1];
}

/** Bagging is the forest whose nodes may look at all 8 features. */
export const BAGGING_ROW: RfRow = rfRow(RF.names.length);

/** Trees the OOB matrix shows as columns. */
export const MATRIX_COLS = 12;

/** Feature indices of `counts`, the largest first (ties keep the data order). */
export function rankDesc(counts: readonly number[]): number[] {
  return counts.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
}

/** Verdict of an OOB tally: the majority class; a tie goes to Kaldı as everywhere on the Chapter 9 pages. */
export function oobVerdict(ayrildi: number, kaldi: number): 'Ayrıldı' | 'Kaldı' | null {
  const n = ayrildi + kaldi;
  if (n === 0) return null;
  return majority(ayrildi, n) === 1 ? 'Ayrıldı' : 'Kaldı';
}

/**
 * The OOB vote of customer `i` among the first `m` trees: how many did not see it and what they said.
 * `text` is the step 5 line; the count is written "k tanesi" because the Turkish suffix after a computed number varies.
 */
export function oobBreakdown(
  i: number,
  m: number,
): { k: number; ayrildi: number; kaldi: number; verdict: 'Ayrıldı' | 'Kaldı' | null; text: string } {
  const { ayrildi, kaldi } = oobVotes(i, m);
  const k = ayrildi + kaldi;
  const verdict = oobVerdict(ayrildi, kaldi);
  const tie = k > 0 && ayrildi * 2 === k;
  const tail = verdict === null ? 'oy veren ağaç yok' : `${ayrildi} Ayrıldı, ${kaldi} Kaldı → ${tie ? 'berabere → ' : ''}${verdict}`;
  return { k, ayrildi, kaldi, verdict, text: `${m} ağaçtan ${k} tanesi onu görmedi: ${tail}` };
}

const NAMES = RF.names;
const TREES = BOOTS.length;
const FEATURES = NAMES.length;
const DEFAULT_MF = 2;
const forest = rfRow(DEFAULT_MF);
const topBagging = rankDesc(BAGGING_ROW.roots).slice(0, 2);
const topForest = rankDesc(forest.roots).slice(0, 2);
const sumOf = (xs: readonly number[], idx: number[]): number => idx.reduce((s, i) => s + xs[i], 0);
const rootsTotal = BAGGING_ROW.roots.reduce((s, x) => s + x, 0);
const bestTest = Math.max(...RF.byMf.map((r) => r.test));
const first = RF.byMf[0];
const last = RF.byMf[RF.byMf.length - 1];

const pickOob = PICKS.oob;
const pickBreak = oobBreakdown(pickOob, Math.min(MATRIX_COLS, TREES));
const score = oobScore(TREES);

const cvMean = OOB_CV.cv.reduce((s, x) => s + x, 0) / OOB_CV.cv.length;
const curveFirst = OOB_CURVE[0];
const curveLast = OOB_CURVE[OOB_CURVE.length - 1];
/** The first tree count whose OOB score is within 0.002 of the last one (where the curve has levelled off). */
const curveSat = OOB_CURVE.find((p) => p.oob >= curveLast.oob - 0.002)!;

const mdiOrder = rankDesc(RF.mdi);
const mdiSum = RF.mdi.reduce((s, x) => s + x, 0);
const idAt = RF.withId.names.length - 1;
const sozlesme = RF.withId.names.indexOf('sozlesmeTipi');
const permTop = rankDesc(RF.withId.perm)[0];

/** The closing sentence of step 10, shared by the lesson text and the scene. */
export const CAUSAL =
  "Önem, modelin neye dayandığını söyler; nedeni değil: destek çağrısı churn'e yol açmaz, churn'e yatkın müşteri daha çok arar.";

/** The step scenario of the Random Forest page (Ders steps 1-10). */
export const randomForestScenario: Scenario<RfParams> = {
  defaults: {
    maxFeatures: DEFAULT_MF,
    rho: forest.rho,
    trees: TREES,
    pick: pickOob,
    nEstimators: 300,
    method: 'mdi',
    withId: false,
  },
  steps: [
    {
      id: 'kokler',
      title: "Bagging'de kökler",
      text: `${FEATURES} öznitelikli veri, ${rootsTotal} ağaç, her düğümde ${FEATURES} özniteliğin hepsi aday: köklerin ${sumOf(BAGGING_ROW.roots, topBagging)} tanesi iki özniteliğe düşer (${topBagging.map((i) => `${NAMES[i]} ${BAGGING_ROW.roots[i]}`).join(', ')}). Ağaçlar birbirinin kopyasına döner.`,
    },
    {
      id: 'alt-kume',
      labText: 'Kaydırıcı düğümün kaç öznitelik arasından seçeceğini değiştirir; Random Forest çubukları yeni değere göre yeniden boyanır.',
      term: 'max_features (düğümdeki aday öznitelik sayısı)',
      title: 'Her düğümde rastgele alt küme',
      text: `Düğüm kartında ${FEATURES} çipten ${NODE_DEMO.drawn.length} tanesi çekilir, en iyi bölünme yalnız bunlar arasında aranır (çekilen çift üreticinin seçtiği sabit bir örnektir; gerçekte her düğümde yeniden çekilir). Kökler dağılır: en sık iki öznitelik köklerin ${sumOf(forest.roots, topForest)} tanesini alır, bagging'de ${sumOf(BAGGING_ROW.roots, topBagging)} tanesini alıyordu.`,
    },
    {
      id: 'varyans',
      labText: 'İki kaydırıcı korelasyonu ve ağaç sayısını değiştirir; formül şeridi ve işaretli nokta onlarla birlikte güncellenir.',
      term: 'topluluk varyansı',
      title: 'Neden işe yarar?',
      text: `Topluluk varyansı = ρσ² + (1 − ρ)σ²/M. Ağaç sayısı M yalnız ikinci terimi küçültür; ilk terim ρ ile kalır. Ölçülen ρ: bagging ${f(BAGGING_ROW.rho, 3)}, Random Forest ${f(forest.rho, 3)}. İki eğri M = 1–${rootsTotal}, σ² = 1.`,
    },
    {
      id: 'max-features',
      labText: 'Kaydırıcı düğümde bakılan öznitelik sayısını seçer; kök çubukları, ρ ve doğruluklar o değere göre okunur.',
      title: 'Ne kadar rastgele?',
      text: `Tarama: max_features 1 → ${FEATURES}. ρ ${f(first.rho, 3)} → ${f(last.rho, 3)} yükselir, tek ağacın doğruluğu da yükselir (${f(first.treeAcc, 3)} → ${f(last.treeAcc, 3)}); topluluğun test doğruluğu ortada en iyi (en yüksek ${f(bestTest, 3)}). Sınıflandırmada öneri √p, regresyonda p/3.`,
      sweep: {
        key: 'maxFeatures',
        values: RF.byMf.map((r) => r.mf),
        intervalMs: 700,
      },
    },
    {
      id: 'oob-matris',
      params: { trees: MATRIX_COLS },
      labText: 'Ağaç sayısı kaydırıcısı oy veren ağaçları değiştirir. Bir satıra tıkla ya da Tab ile gelip Enter veya Boşluk tuşuna bas: müşteri seçilir.',
      title: 'OOB matrisi',
      term: 'OOB oylaması',
      text: `Bölüm 5'in ${CUSTOMERS.length} müşterisi × ilk ${MATRIX_COLS} bootstrap ağacı. Dolu hücre: ağaç müşteriyi gördü (sayı = tekrar); kesikli boş hücre: ağaç görmedi ve oy verir. Müşteri ${pickOob}: ${pickBreak.text}.`,
    },
    {
      id: 'oob-skor',
      params: { trees: TREES },
      labText: 'Ağaç sayısı kaydırıcısı oy veren ağaçları değiştirir; OOB skoru ve doğru / yanlış işaretleri yeniden hesaplanır.',
      title: 'OOB skoru',
      text: `${TREES} ağaçla her müşteri yalnız onu görmeyen ağaçların çoğunluğuyla tahmin edilir; doğru olanlar ✓: OOB skoru = ${score.correct} / ${score.total} = ${f(score.correct / score.total, 3)}. Ayrı bir test kümesi ayırmadan.`,
    },
    {
      id: 'oob-cv',
      title: 'OOB ≈ çapraz doğrulama',
      text: `Kitabın verisi (1000 gözlem, 15 öznitelik, 300 ağaç): OOB skoru ${f(OOB_CV.oob, 3)}, ${OOB_CV.cv.length} katlı CV ortalaması ${f(cvMean, 3)}. OOB modeli bir kez eğitir, CV ${OOB_CV.cv.length} kez: kitabın ölçtüğü süre ${f(OOB_CV.seconds.oob, 2)} s ve ${f(OOB_CV.seconds.cv, 2)} s.`,
    },
    {
      id: 'agac-sayisi',
      labText: 'Ağaç sayısı kaydırıcısı eğrideki noktayı ve değerini taşır.',
      title: 'Kaç ağaç?',
      text: `OOB skoru ağaç sayısıyla yükselir ve doyar: ${curveFirst.n} ağaçta ${f(curveFirst.oob, 3)}, ${curveSat.n} ağaçta ${f(curveSat.oob, 3)}, ${curveLast.n} ağaçta ${f(curveLast.oob, 3)}. Bir noktadan sonra ağaç eklemek yalnız süre ekler.`,
      sweep: {
        key: 'nEstimators',
        values: OOB_CURVE.map((p) => p.n),
        intervalMs: 250,
      },
    },
    {
      id: 'onem',
      labText: 'Anahtar veriye anlamsız bir kimlik sütunu ekler: çizim, bu sütunun da bulunduğu ayrı bir modelin MDI değerlerine geçer.',
      title: 'Öznitelik önemi',
      term: 'MDI (ortalama Gini azalımı)',
      text: `Kitabın ${FEATURES} özniteliği, MDI: ${NAMES[mdiOrder[0]]} ${f(RF.mdi[mdiOrder[0]], 3)} … ${NAMES[mdiOrder[FEATURES - 1]]} ${f(RF.mdi[mdiOrder[FEATURES - 1]], 3)}; toplam ${f(mdiSum, 3)}. Bir özniteliğin bölünmelerle sağladığı Gini azalımı her ağaçta toplanır, ağaçlar üzerinde ortalaması alınır.`,
    },
    {
      id: 'tuzak',
      labText: 'Anahtar iki sütundan hangisinin öne çıkacağını seçer: MDI ağaçların Gini azalımından, permütasyon test kümesinden okunur.',
      title: 'Önem tuzakları',
      text: `Veriye anlamsız ${RF.withId.names[idAt]} eklenir: MDI ona ${f(RF.withId.mdi[idAt], 3)} verir (${RF.withId.names[sozlesme]} ${f(RF.withId.mdi[sozlesme], 3)} ile neredeyse eşit), test kümesinde permütasyon önemi ${f(RF.withId.perm[idAt], 3)}. Sıralama da değişebilir: permütasyonda ${RF.withId.names[permTop]} birinci. ${CAUSAL}`,
    },
  ],
};

/** Resolves step ids to indices, so the groups below stay in step with the scenario. */
const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(randomForestScenario, id));

/** Steps drawn by the roots scene (bars, variance curves, max_features sweep). */
export const ROOT_STEPS = indices('kokler', 'alt-kume', 'varyans', 'max-features');

/** Steps drawn by the OOB matrix scene. */
export const OOB_STEPS = indices('oob-matris', 'oob-skor');

/** Steps drawn by the curve scene (OOB vs CV, OOB vs tree count). */
export const CURVE_STEPS = indices('oob-cv', 'agac-sayisi');

/** Steps drawn by the importance scene. */
export const IMPORTANCE_STEPS = indices('onem', 'tuzak');

/** Steps with the max_features slider, the rho / M sliders, the tree count and the n_estimators slider. */
export const MF_STEPS = indices('alt-kume', 'max-features');
export const RHO_M_STEPS = indices('varyans');
export const TREES_STEPS = indices('oob-matris', 'oob-skor');
export const NEST_STEPS = indices('agac-sayisi');
/** Step 9 has the "musteriNo ekle" toggle; step 10 always shows the split model and has the method toggle. */
export const ID_STEPS = indices('onem');
export const METHOD_STEPS = indices('tuzak');
