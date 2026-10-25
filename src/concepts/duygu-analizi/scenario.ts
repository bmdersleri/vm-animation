import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { metrics } from '../degerlendirme/metrics';
import { BOOK, DRIFT, MODELS } from '../metin/data';
import { score } from '../metin/score';
import { tokenize } from '../metin/tokenize';
import { asNegative, corpusCounts, degilBigram, DRIFT_COMMENT, HATALAR, NEGATION, NEW_COMMENT } from './calc';

/**
 * Parameters of the sentiment page. The three model settings are `null` while the learner has not chosen:
 * the step then shows its own model (see `settingsOf` in calc.ts); a boolean is a Lab choice and holds on
 * every step. `topN` is the term count of the coefficient bars (step 3), `text` the comment of the score
 * steps (`null` = the step's own comment, "" = an empty comment), `fixed` the debug code switch (step 10).
 */
export interface SentimentParams {
  bigram: boolean | null;
  degilStop: boolean | null;
  leaky: boolean | null;
  topN: number;
  text: string | null;
  fixed: boolean;
}

const f3 = (v: number): string => f(v, 3);
const f2 = (v: number): string => f(v, 2);
const signed = (v: number, d: number): string => `${v < 0 ? '−' : '+'}${f(Math.abs(v), d)}`;
const lean = (p: number): string => (p > 0.5 ? 'olumlu' : p < 0.5 ? 'olumsuz' : 'tam ortada');
const pc = (v: number): string => pct(v, 1);

const counts = corpusCounts();
const uni = MODELS['uni-keep-train'];
const uniLeaky = MODELS['uni-keep-all'];
const bi = MODELS['bi-keep-train'];
const biDrop = MODELS['bi-drop-train'];
const k4 = BOOK.kod04;

const top = (() => {
  const idx = uni.coef.map((c, j) => [c, j] as const);
  const hi = idx.reduce((a, b) => (b[0] > a[0] ? b : a));
  const lo = idx.reduce((a, b) => (b[0] < a[0] ? b : a));
  return { pos: { term: uni.vocab[hi[1]], coef: hi[0] }, neg: { term: uni.vocab[lo[1]], coef: lo[0] } };
})();

const newScore = score(uni, NEW_COMMENT);
const negUni = score(uni, NEGATION.text);
const negBi = score(bi, NEGATION.text);
const negDrop = score(biDrop, NEGATION.text);
const degilTerm = degilBigram(NEGATION.text);
const stopFree = tokenize(NEGATION.text, new Set(['değil'])).tokens;
const bookSentence = 'Hizmet kötü değil';
const bookKept = tokenize(bookSentence, new Set(['değil'])).tokens;
const driftScore = score(uni, DRIFT_COMMENT.text);
const noveltyExamples = DRIFT.novelTerms.filter((t) => t === 'fiber' || t === 'esim');
const novel = (noveltyExamples.length >= 2 ? noveltyExamples : DRIFT.novelTerms.slice(0, 2)).map((t) => `"${t}"`);
const gap = uniLeaky.accuracy - uni.accuracy;
const gapText =
  Math.abs(gap) <= 0.02
    ? 'Fark küçük; ama test artık görülmemiş veri değil.'
    : `Fark ${f(Math.abs(gap) * 100, 1)} puan; test artık görülmemiş veri değil.`;
const mNeg = metrics(asNegative(uni.matrix));
const nTest = uni.matrix.tn + uni.matrix.fp + uni.matrix.fn + uni.matrix.tp;

/** The step scenario of the sentiment page (Ders steps 1-10). */
export const duyguAnaliziScenario: Scenario<SentimentParams> = {
  defaults: { bigram: null, degilStop: null, leaky: null, topN: 10, text: null, fixed: false },
  steps: [
    {
      id: 'gorev',
      title: 'Görev: yorumdan duyguya',
      term: 'duygu analizi',
      text: `Telekom müşteri yorumlarından (örnek, yapay veri) oluşan külliyat: ${counts.all} yorum, ${counts.pos} olumlu ve ${counts.neg} olumsuz. Görev: yorumun duygusunu tahmin etmek. Kitabın uyarısı: "Duygu etiketi, müşteri kaybı etiketi değildir."`,
    },
    {
      id: 'boru-hatti',
      title: 'Boru hattı',
      term: 'Pipeline',
      text: `Yorum temizlenir, TF-IDF vektörüne çevrilir, lojistik regresyon olumlu olasılığını verir. Katmanlı bölme: ${counts.train[0] + counts.train[1]} eğitim (${counts.train[0]} olumlu, ${counts.train[1]} olumsuz) ve ${counts.test[0] + counts.test[1]} test (${counts.test[0]} olumlu, ${counts.test[1]} olumsuz) yorumu. fit yalnız eğitimde: sözlük (${uni.vocabSize} terim) ve IDF eğitimden öğrenilir.`,
    },
    {
      id: 'kelime-agirlik',
      title: 'Kelimelerin ağırlığı',
      text: `Model her kelimeye bir ağırlık (katsayı) verir. Unigram modelde en olumlu terim "${top.pos.term}" (${signed(top.pos.coef, 2)}), en olumsuz terim "${top.neg.term}" (${signed(top.neg.coef, 2)}). Yorumun skoru, bu ağırlıkların TF-IDF'le tartılmış toplamıdır.`,
    },
    {
      id: 'yorum-skor',
      title: 'Bir yorumu skorlamak',
      term: 'sigmoid',
      text: `Kitabın yeni yorumu "${NEW_COMMENT}": ${newScore.terms.length} terim sözlükte. Her terimin katkısı = TF-IDF ağırlığı × katsayı. z = Σ katkı + b = ${f3(newScore.z)}; p = 1 / (1 + e^−z) = ${f3(newScore.p)}: model ${lean(newScore.p)} yönde eğilimli. Kitabın ${k4.docs.length} yorumluk modeli aynı yorum için p = ${f3(k4.pNew)}.`,
    },
    {
      id: 'test-sonuc',
      title: 'Test sonucu',
      term: 'karışıklık matrisi',
      text: `Unigram model ${nTest} test yorumunda: doğruluk ${pc(uni.accuracy)}; olumsuz sınıf için kesinlik ${pc(mNeg.precision ?? 0)}, duyarlılık ${pc(mNeg.recall ?? 0)}. Kitabın ${k4.docs.length} yorumluk örneğinde test ${k4.testIdx.length} yorum, doğruluk ${f2(k4.accuracy)}: ${k4.testIdx.length} yorumla ölçülen başarı ölçüm değildir. Dengesiz sınıflarda doğruluk yanıltır (Bölüm 11).`,
    },
    {
      id: 'bigram',
      title: 'Bigram ve olumsuzlama',
      term: 'bigram',
      text: `"${NEGATION.text}" (olumsuzlama): unigram modelde p = ${f3(negUni.p)} (${lean(negUni.p)} yönde eğilimli), unigram+bigram modelde p = ${f3(negBi.p)} (${lean(negBi.p)} yönde eğilimli)${degilTerm ? `; "${degilTerm.term}" bigram'ının katsayısı ${signed(degilTerm.coef, 2)}` : ''}. Olumsuzlama içeren ${uni.negN} test yorumunda doğruluk ${pc(uni.negAccuracy)} iken bigram modelde ${pc(bi.negAccuracy)}.`,
    },
    {
      id: 'degil-tuzagi',
      title: '"değil" stop-word olursa',
      text: `Aynı yorum, "değil" süzülmüş bigram modelde: [${stopFree.join(', ')}] kalır, p = ${f3(negDrop.p)}, model ${lean(negDrop.p)} yönde eğilimli (süzülmeden ${f3(negBi.p)}). Olumsuzlama içeren ${biDrop.negN} test yorumunda doğruluk ${pc(bi.negAccuracy)} iken ${pc(biDrop.negAccuracy)} olur. Kitabın "${bookSentence}" cümlesi de [${bookKept.join(', ')}] kalır.`,
    },
    {
      id: 'sizinti',
      title: 'Sızıntı: vektörleştirici tüm veride',
      term: 'veri sızıntısı',
      text: `Vektörleştirici tüm veride öğrenilirse sözlüğe yalnız testte geçen ${uniLeaky.testOnly.length} terim girer (${uniLeaky.testOnly.join(', ')}) ve IDF değerleri test yorumlarını da sayar; sızıntısız modelde bu terimler sözlük dışıdır. Test doğruluğu: sızıntılı ${pc(uniLeaky.accuracy)}, sızıntısız ${pc(uni.accuracy)}. ${gapText}`,
    },
    {
      id: 'sozluk-kaymasi',
      title: 'Sözlük kayması',
      term: 'sözlük dışı oranı',
      text: `Yeni dönem yorumları (${novel.join(', ')} gibi terimler): sözlük dışı token oranı eğitim modelinin test yorumlarında ${pc(DRIFT.oovRateTest)}, yeni dönemde ${pc(DRIFT.oovRateNew)}; doğruluk ${pc(DRIFT.accuracyTest)} iken ${pc(DRIFT.accuracyNew)}. "${DRIFT_COMMENT.text}" yorumunun her token'ı sözlük dışı: vektör sıfır, p = ${f3(driftScore.p)} yalnız kesişimden gelir. Kitabın önerisi: sözlük dışı oranını izleyip eşikte yeniden eğitmek.`,
    },
    {
      id: 'hata-ayiklama',
      title: 'Hata ayıklama',
      text: `Kitabın DuyguHata kodunda ${HATALAR.length} hata var: ${HATALAR.join(', ')}. Hatalar sırayla işaretlenir, sonra düzeltilmiş kod gelir. Kitabın sınav notu: "'Model çalıştı' ifadesi, modelin güvenilir olduğu anlamına gelmez."`,
    },
  ],
};

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(duyguAnaliziScenario, id));

/** Steps drawn by the flow strip. */
export const FLOW_STEPS = indices('gorev', 'boru-hatti');

/** Steps drawn by the score panel (step 6 draws two). */
export const SCORE_STEPS = indices('yorum-skor', 'bigram', 'degil-tuzagi', 'sozluk-kaymasi');
