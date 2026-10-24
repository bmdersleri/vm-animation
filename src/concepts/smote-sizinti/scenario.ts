import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { metrics } from '../degerlendirme/metrics';
import { BOOK_NUMBERS, COMPARE, CV, KOD05 } from '../dengesiz/data';
import { ALL_COUNTS, DEFAULT_SEED, leakFor, matchCaught, positiveRate } from './model';

/**
 * Parameters of the SMOTE-leakage page. `order` is the order of the split and SMOTE, `seed` the SMOTE seed,
 * `fold` the cross-validation fold (0 = all five), `show` the curve switches of step 7, `model` and
 * `threshold` the step-8 choice, `bug` how many of the five bugs step 9 has marked (6 = all marked, the
 * corrected code follows) and `fixed` the Lab's corrected-code switch.
 */
export interface LeakParams {
  order: 'yanlis' | 'dogru';
  seed: number;
  fold: number;
  show: { base: boolean; smote: boolean; weighted: boolean };
  model: 'base' | 'smote' | 'weighted';
  threshold: number;
  bug: number;
  fixed: boolean;
}

const run = leakFor(DEFAULT_SEED);
const leakyPos = run.leaky.pos;
const synth = run.leaky.synthPos;
const smoteAdded = ALL_COUNTS.neg - ALL_COUNTS.pos;
const leakyRate = positiveRate(run.leaky.scores);
const honestRate = positiveRate(run.honest.scores);
const fold1 = CV.folds[0];
const m05 = KOD05.matrix;
const prec05 = metrics(m05).precision ?? 0;
const sameCaught = matchCaught(COMPARE.base.scores, m05.tp);
const ap = (v: number): string => f(v, 3);

/** The step scenario of the SMOTE-leakage page (Ders steps 1-10). */
export const smoteSizintiScenario: Scenario<LeakParams> = {
  defaults: {
    order: 'yanlis',
    seed: DEFAULT_SEED,
    fold: 0,
    show: { base: true, smote: true, weighted: true },
    model: 'smote',
    threshold: 0.5,
    bug: 0,
    fixed: false,
  },
  steps: [
    {
      id: 'iki-sira',
      title: 'İki sıra',
      text: 'Aynı veri, iki işlem sırası. Yanlış sırada SMOTE bölmeden önce çalışır, doğru sırada yalnızca eğitim parçasında. Kitabın kuralı: "önce eğitim/test ayrımı yapılır; SMOTE yalnızca eğitim verisine uygulanır."',
      labText: 'Sırayı ve SMOTE tohumunu seçin: seçtiğiniz sıra vurgulanır; sonraki adımlarda sayımlar, örnek nokta ve eğriler bu seçime göre değişir.',
    },
    {
      id: 'once-smote',
      title: 'Önce SMOTE',
      term: 'veri sızıntısı (data leakage)',
      text: `Bütün veri ${ALL_COUNTS.neg} / ${ALL_COUNTS.pos} iken SMOTE onu ${ALL_COUNTS.neg} / ${ALL_COUNTS.neg} yapar (${smoteAdded} sentetik). Sonra katmansız 70/30 bölme: test ${run.leaky.n} satır, ${leakyPos} ayrılan, bunların ${synth} sentetik.`,
      labText: 'Sırayı ve tohumu değiştirin: doğru sırada test kümesine hiç sentetik satır girmez, sayımlar buna göre yeniden çizilir.',
    },
    {
      id: 'testte-ne-var',
      title: 'Testte ne var?',
      text: `Testteki bir sentetik nokta ve iki ebeveyni; ikisi de eğitimde. Sentetik test noktalarının ${pct(run.leaky.parentInTrain / synth, 0)} kadarının en az bir ebeveyni eğitimde: model sınavda, ezberlediği noktaların arasını görüyor.`,
      labText: 'Sırayı ve tohumu değiştirin: doğru sırada testte sentetik nokta bulunmaz, bu yüzden örnek çizilmez; başka tohumlarda yalnızca oran yazılır.',
    },
    {
      id: 'pr-taban',
      title: "PR-AUC'nin tabanı",
      term: 'PR eğrisi tabanı',
      text: `İki PR eğrisi: sızıntılı test ve sızıntısız test. Kesikli çizgiler pozitif oranı, yani tabanı gösterir: sızıntılı testte ${f(leakyRate, 3)}, sızıntısızda ${f(honestRate, 3)}. Rastgele sıralama bile ${f(leakyRate, 2)} alırdı.`,
      labText: 'Sırayı ve tohumu değiştirin: seçtiğiniz sıranın eğrisi kalınlaşır, tabanlar o testin pozitif oranını izler.',
    },
    {
      id: 'iki-skor',
      title: 'İki skor',
      text: `Sızıntılı ${ap(run.leaky.ap)}, sızıntısız ${ap(run.honest.ap)} (kitap ${ap(BOOK_NUMBERS.leaky)} / ${ap(BOOK_NUMBERS.honest)}). Fark modelin değil, deneyin.`,
      labText: 'Tohumu değiştirin: iki skor o tohumun deneyinden okunur; sıra seçimi hangi eğrinin kalın çizileceğini belirler.',
    },
    {
      id: 'pipeline',
      title: 'Pipeline ve çapraz doğrulama',
      term: 'Pipeline (imblearn)',
      text: `5 katlı katmanlı çapraz doğrulama: her katta SMOTE yalnızca eğitim parçasına uygulanır (kat 1: ${fold1.trainNeg} / ${fold1.trainPos} → ${fold1.smoteNeg} / ${fold1.smotePos}), doğrulama parçasına dokunulmaz. Kat PR-AUC değerleri sırayla belirir, ortalama ${ap(CV.mean)} (kitap ${ap(BOOK_NUMBERS.cv)}). imblearn Pipeline, örnekleyiciyi yalnız fit sırasında çalıştırır.`,
      labText: 'Katı seçin: o katın sayımları vurgulanır; hepsini birlikte görmek için seçimi kaldırın.',
      sweep: { key: 'fold', values: [1, 2, 3, 4, 5], intervalMs: 900 },
    },
    {
      id: 'smote-agirlik',
      title: 'SMOTE mı, sınıf ağırlığı mı?',
      text: `Aynı test bölmesinde üç PR eğrisi: ağırlıksız ${ap(COMPARE.base.ap)}, SMOTE ${ap(COMPARE.smote.ap)}, ağırlıklı ${ap(COMPARE.weighted.ap)}. Bu veride dengeleme PR-AUC değerini artırmadı; seçim veri miktarına ve maliyete bağlı.`,
      labText: 'Anahtarlarla eğrileri tek tek açıp kapatın: kapalı bir modelin eğrisiyle birlikte skor etiketi de ekrandan kalkar.',
    },
    {
      id: 'esik',
      title: 'Eşik',
      text: `SMOTE hattı (kod05) 0,5 eşiğinde ${m05.tp} / ${m05.tp + m05.fn} ayrılanı yakalar, kesinlik ${ap(prec05)}. Ağırlıksız model aynı duyarlılığa ${ap(sameCaught.threshold)} eşiğinde ulaşır, kesinliği ${ap(sameCaught.precision)}. Dengesiz veride eşik de bir ayardır; maliyetle seçilir.`,
      labText: 'Modeli seçip eşik kaydırıcısını oynatın: eğri üstündeki nokta ve matris canlı değişir.',
      params: { model: 'smote', threshold: 0.5 },
    },
    {
      id: 'hata-ayiklama',
      title: 'Hata ayıklama',
      text: 'Kitabın ChurnDebug kodunda beş hata var: SMOTE bölmeden önce; model test verisinde eğitiliyor; yalnız doğruluğa bakılıyor; random_state yok; stratify yok. Hatalı satırlar sırayla işaretlenir, sonra düzeltilmiş kod gelir.',
      sweep: { key: 'bug', values: [1, 2, 3, 4, 5, 6], intervalMs: 1400 },
      labText: 'Düzeltilmiş kodu göster anahtarıyla hatalı ve düzeltilmiş hâli arasında geçiş yapın.',
    },
    {
      id: 'baska-sizintilar',
      title: 'Başka sızıntılar',
      text: 'Sızıntı yalnız SMOTE kaynaklı değildir: hedef sızıntısı (iptal sonrası son fatura), zaman sızıntısı (şubat verisiyle ocağı tahmin etmek; TimeSeriesSplit) ve grup sızıntısı (aynı müşterinin ayları iki kümede; GroupKFold). Ölçekleyici, kodlayıcı, seçici ve SMOTE parametrelerini yalnızca eğitim verisinden öğrenmelidir.',
    },
  ],
};

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(smoteSizintiScenario, id));

/** Steps drawn by the flow scene (rows, counts, the example). */
export const FLOW_STEPS = indices('iki-sira', 'once-smote', 'testte-ne-var');

/** Steps drawn by the PR scene. */
export const PR_STEPS = indices('pr-taban', 'iki-skor', 'smote-agirlik', 'esik');
