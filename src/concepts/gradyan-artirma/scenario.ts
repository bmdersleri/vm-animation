import { stepIndex, type Scenario } from '../../core/player';
import { formatNonZero, formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { BOOK, REG } from '../boosting/data';
import { bestIndex, boost, type BoostRun } from '../boosting/boost';

/**
 * Parameters of the gradient boosting page.
 * `m` is how many trees the top panel's F contains (steps 1-6); `trees` is the tree count M of
 * the error chart and of step 9's long run; `showVal` draws the validation points.
 */
export interface GbParams {
  nu: number;
  depth: number;
  m: number;
  trees: number;
  showVal: boolean;
}

/** Longest run any step or Lab slider uses. */
export const MAX_TREES = 200;

/** The three learning rates of the learning-rate step, in the order the spec lists them. */
export const STEP8_NUS: readonly number[] = [1, BOOK.nu, 0.05];

/** The Lab's learning rates; the ν slider runs over the indices of this list. */
export const NU_VALUES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 1] as const;

// at most NU_VALUES.length x 3 depths = 24 runs of 200 trees, so the cache is left uncapped
const runs = new Map<string, BoostRun>();

/** The boosting run for (nu, depth), MAX_TREES trees long; computed once per pair. */
export function runFor(nu: number, depth: number): BoostRun {
  const key = `${nu}|${depth}`;
  let run = runs.get(key);
  if (!run) {
    run = boost(REG.train, REG.val, nu, depth, MAX_TREES);
    runs.set(key, run);
  }
  return run;
}

/** Subscript digits: 12 -> "₁₂". */
export function sub(n: number): string {
  const digits = '₀₁₂₃₄₅₆₇₈₉';
  return String(n).replace(/\d/g, (d) => digits[Number(d)]);
}

/** Learning rate as the texts write it: 1,0 / 0,3 / 0,05. */
export function nuText(nu: number): string {
  return f(nu, nu < 0.1 ? 2 : 1);
}

/** Thresholds of one tree (its splits), sorted. */
export function thresholdsOf(run: BoostRun, k: number): number[] {
  return run.trees[k].nodes.filter((n) => n.l !== -1).map((n) => n.t).sort((a, b) => a - b);
}

const WORDS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz'];
const word = (n: number): string => WORDS[n] ?? String(n);

const NU0 = BOOK.nu;
const DEPTH0 = BOOK.depth;
const base = runFor(NU0, DEPTH0);
const n = REG.train.x.length;
const mse0 = REG.train.y.reduce((s, v) => s + (v - base.f0) ** 2, 0) / n;
const thr = thresholdsOf(base, 0).map((t) => f(t, 3));
const first = BOOK.mse[0];
const last = BOOK.mse[BOOK.mse.length - 1];
const ratio = last / first;
const ratioText = f(ratio, 1) === f(1 / 3, 1) ? 'yaklaşık üçte biri' : `${f(ratio, 2)} katı`;
const bestM = bestIndex(base.valMse);
const bestVal = base.valMse[bestM - 1];
const dips = STEP8_NUS.map((nu) => {
  const run = runFor(nu, DEPTH0);
  const at = bestIndex(run.valMse);
  return { nu, at, val: run.valMse[at - 1] };
});
const lastTrain = base.trainMse[MAX_TREES - 1];
const lastVal = base.valMse[MAX_TREES - 1];

/** The step scenario of the gradient boosting page (Ders steps 1-10). */
export const gradyanArtirmaScenario: Scenario<GbParams> = {
  defaults: { nu: NU0, depth: DEPTH0, m: 0, trees: MAX_TREES, showVal: false },
  steps: [
    {
      id: 'veri',
      title: 'Veri',
      text: `${n} nokta: x ∈ [${f(0, 0)}; ${f(10, 0)}], y = sin x + gürültü. Tek bir sığ ağaç bu dalgayı ancak ${word(2 ** DEPTH0)} basamakla kabaca çizer. Boosting basamakları üst üste koyar.`,
      labText: 'Doğrulama noktalarını açıp kapatın: içi boş daireler, modelin eğitimde görmediği ikinci bir veri kümesidir. Ezberi sonraki adımlarda bunlarla yoklayacağız.',
      params: { m: 0 },
    },
    {
      id: 'baslangic',
      title: 'Başlangıç: ortalama',
      term: 'gradyan artırma (gradient boosting)',
      text: `F${sub(0)} = ȳ = ${f(base.f0, 4)} (yatay çizgi); ortalama kare hata ${f(mse0, 4)}. İlk model hiçbir şey bilmez: herkese ortalamayı söyler.`,
      labText: 'Doğrulama noktalarını açıp kapatın. Başlangıç tahmini yalnız eğitim noktalarının ortalamasıdır; doğrulama noktalarına da aynı yatay çizgiyi söyler.',
      params: { m: 0 },
    },
    {
      id: 'artik',
      title: 'Artık',
      term: 'artık (residual)',
      text: `r = y − F${sub(0)}; alt panelde ${n} artık. Artık, modelin her noktada ne kadar yanıldığıdır; bir sonraki ağaç bunu öğrenecek.`,
      labText: 'Doğrulama noktalarını açıp kapatın. Artıklar yalnız eğitim noktalarında hesaplanır; doğrulama noktaları ezber adımında işe yarar.',
      params: { m: 0 },
    },
    {
      id: 'ilk-agac',
      title: 'Artığa ağaç',
      text: `Derinlik ${DEPTH0} ağacı artıklara uyar: ${word(2 ** DEPTH0)} basamak, eşikler ${thr.join('; ')}. Ağaç y değerini değil artığı tahmin eder.`,
      labText: 'Ağaç derinliğini değiştirin: derinlik arttıkça ağaç artığa daha çok basamakla uyar; eşikler ve basamaklar canlı değişir.',
      params: { m: 0 },
    },
    {
      id: 'kucuk-adim',
      title: 'Küçük adım',
      term: 'öğrenme oranı (learning rate)',
      text: `F${sub(1)} = F${sub(0)} + ${f(NU0, 1)} · h${sub(1)}: üst paneldeki çizgi düzeltmenin yalnız ${pct(NU0, 0)} kadarı oynar; hata ${f(first, 4)}.`,
      labText: 'Öğrenme oranını ve adım sayısını değiştirin: oran küçüldükçe her ağaç toplam tahmini daha az oynatır. Şeritteki formül ve hata canlı güncellenir.',
      params: { m: 1 },
    },
    {
      id: 'tekrar',
      title: 'Tekrar',
      text: `Her adımda yeni artıklar, yeni ağaç, yeni ekleme. Yanda kitabın tablosu satır satır dolar (${BOOK.mse.slice(1).map((v) => f(v, 4)).join('; ')}). Beşinci adımda hata birincinin ${ratioText}: ${f(last, 4)} / ${f(first, 4)}.`,
      labText: 'Öğrenme oranı ile adım sayısını birlikte değiştirin: küçük oranla aynı hataya varmak için daha çok adım gerekir. Şerit seçtiğiniz orana göre hatayı gösterir.',
      sweep: { key: 'm', values: [2, 3, 4, 5], intervalMs: 1200 },
    },
    {
      id: 'durma',
      title: 'Ne zaman durmalı?',
      text: `Ağaç sayısı M = 1 → ${MAX_TREES}: eğitim hatası sıfıra iner (${MAX_TREES} ağaçta ${formatNonZero(lastTrain, 4)}), doğrulama hatası ${bestM}. ağaçta en düşük (${f(bestVal, 4)}), sonra yükselir.`,
      labText: 'Öğrenme oranını, derinliği ve ağaç sayısını değiştirin: işaret eğri üzerinde gezer; eğitim hatası düşmeyi sürdürürken doğrulama dibi oranla ve derinlikle yer değiştirir.',
      sweep: { key: 'trees', values: Array.from({ length: MAX_TREES }, (_, i) => i + 1), intervalMs: 40 },
    },
    {
      id: 'ogrenme-orani',
      title: 'Öğrenme oranı',
      text: `Üç doğrulama eğrisi: ν = ${dips.map((d) => nuText(d.nu)).join(' / ')}; dipleri ${dips.map((d) => `${d.at}.`).join(' / ')} ağaçta (${dips.map((d) => f(d.val, 4)).join(' / ')}). Küçük adım daha çok ağaç ister ama daha iyi bir dibe iner. ν ile ağaç sayısı birlikte ayarlanır.`,
      labText: 'Öğrenme oranını seçin: seçtiğiniz oranın eğrisi kalın görünür, ötekiler soluklaşır. Derinlik ve ağaç sayısı da eğrileri değiştirir.',
      params: { trees: MAX_TREES },
    },
    {
      id: 'ezber',
      title: 'Ezber',
      text: `Üst panelde iki F: ${bestM} ağaç (yumuşak) ve ${MAX_TREES} ağaç (her gürültü noktasından geçen zikzak); doğrulama noktaları görünür. Eğitim hatası ${formatNonZero(lastTrain, 4)}, ama yeni noktada daha kötü: doğrulama hatası ${f(bestVal, 4)} iken ${f(lastVal, 4)} olur.`,
      labText: 'Ağaç sayısını, öğrenme oranını ve derinliği değiştirin: yumuşak çizgi doğrulama dibindeki ağaç sayısını, zikzak çizgi seçtiğiniz ağaç sayısını gösterir.',
      params: { showVal: true, trees: MAX_TREES },
    },
    {
      id: 'bagging-karsi',
      title: 'Bagging ile karşılaştır',
      text: 'Bagging bağımsız, derin ağaçlar kurar ve oylar ya da ortalama alır; varyansı azaltır. Boosting sığ ağaçlardan bir zincir kurar, her biri öncekinin artığına uyar; yanlılığı azaltır ve sırayla kurulur.',
      params: { showVal: false },
    },
  ],
};

/** Resolves step ids to indices, so the groups below stay in step with the scenario. */
const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(gradyanArtirmaScenario, id));

/** Steps drawn by the two-panel scene (data, F, residuals, h, the book table). */
export const PANEL_STEPS = indices('veri', 'baslangic', 'artik', 'ilk-agac', 'kucuk-adim', 'tekrar');

/** Steps drawn by the error chart. */
export const ERROR_STEPS = indices('durma', 'ogrenme-orani', 'ezber');

/** Steps drawn by the comparison scheme. */
export const COMPARE_STEPS = indices('bagging-karsi');

/** Steps whose Lab shows the validation-points switch. */
export const SHOW_VAL_STEPS = indices('veri', 'baslangic', 'artik');

/** Steps whose Lab shows the depth slider. */
export const DEPTH_STEPS = indices('ilk-agac', 'durma', 'ogrenme-orani', 'ezber');

/** Steps whose Lab shows the ν slider. */
export const NU_STEPS = indices('kucuk-adim', 'tekrar', 'durma', 'ogrenme-orani', 'ezber');

/** Steps whose Lab shows the step-count slider m (1-20). */
export const M_STEPS = indices('kucuk-adim', 'tekrar');

/** Steps whose Lab shows the tree-count slider M (1-200). */
export const TREES_STEPS = indices('durma', 'ogrenme-orani', 'ezber');
