import type { Scenario } from '../../core/player';
import { evaluationData } from '../degerlendirme/data';
import type { Confusion } from '../degerlendirme/metrics';

/** Counts always describe the source model; dummy is derived from that cohort. */
export interface MatrixParams extends Confusion {
  model: 'model' | 'dummy';
  fpCost: number;
  fnCost: number;
}
const defaults: MatrixParams = { ...evaluationData.matrix, model: 'model', fpCost: 1, fnCost: 5 };
const moments = [
  ['gercek-tahmin', 'Gerçek ile tahmini ayır', 'İçteki şekil gerçek sınıfı, dış çerçeve modelin tahminini gösterir. Başlangıç örneği: 100 müşteri, 90 kalan ve 10 ayrılan. Gerçek bilgi ile model kararı farklıdır.', 'gerçek / tahmin'],
  ['dort-sonuc', 'Dört sonuca ayır', 'Aynı müşteriler dört hücreye taşınır. Satır gerçek sınıf, sütun tahmindir. TN ve TP doğru; FP gereksiz teklif, FN kaçırılan ayrılan müşteridir.', 'karmaşıklık matrisi (confusion matrix)'],
  ['accuracy', 'Doğru tahminlerin payı', 'Accuracy, bütün müşteriler içinde doğru tahmin edilenlerin payıdır. Başlangıç örneği: (80 + 6) / 100 = %86. İki doğru hücre birlikte vurgulanır.', 'doğruluk (accuracy)'],
  ['precision', 'Ayrılır dediklerimizin kaçı ayrıldı?', 'Precision, pozitif tahmin sütununa bakar. Başlangıç örneği: 6 / (6 + 10) = %37,5. FP, ayrılmayacak müşteriye gereksiz teklif anlamına gelebilir.', 'kesinlik (precision)'],
  ['recall', 'Ayrılanların kaçını yakaladık?', 'Recall, gerçekten ayrılan satırına bakar. Başlangıç örneği: 6 / (6 + 4) = %60. FN, modelin gözden kaçırdığı ayrılan müşteridir.', 'duyarlılık (recall)'],
  ['f1', 'Kesinlik ve duyarlılığı dengele', 'F1, precision ve recall değerlerinin harmonik ortalamasıdır; aritmetik ortalamaları değildir. Başlangıç örneği: 12 / (12 + 10 + 4) ≈ %46,15.', 'F1 skoru'],
  ['accuracy-tuzagi', 'Daha yüksek accuracy, sıfır yakalama', 'Herkese “kalır” diyen model başlangıç örneğinde %90 accuracy alır, fakat 10 ayrılanın hiçbirini yakalayamaz. Precision tanımsız, recall ve F1 sıfırdır. Yalnız accuracy yeterli değildir.', 'accuracy tuzağı'],
  ['maliyet', 'Hataların bedeli farklı olabilir', 'FP ve FN birim maliyetlerini değiştirin. İki model aynı gerçek müşteri grubunda karşılaştırılır. İş hedefine göre tercih değişebilir; evrensel bir en iyi model yoktur.', 'FP × birim maliyet + FN × birim maliyet'],
] as const;
/** Lab step-card text for steps whose lesson text quotes the starting example's numbers; the Lab lets the student edit the four counts. */
const labTexts: Record<string, string> = {
  accuracy: 'Dört hücre sayısını değiştir. Accuracy, bütün müşteriler içindeki doğru tahmin payı olarak sahnede canlı okunur.',
  precision: 'FP ve TP sayılarını değiştir. Precision, pozitif tahmin sütunundan hesaplanıp sahnede canlı okunur.',
  recall: 'FN ve TP sayılarını değiştir. Recall, gerçekten ayrılan satırından hesaplanıp sahnede canlı okunur.',
  f1: 'Hücre sayılarını değiştir. F1, precision ve recall birlikte oynarken sahnede canlı okunur.',
  'accuracy-tuzagi': 'Matriste gösterilen modeli ve hücre sayılarını değiştir. Herkese "kalır" diyen modelin accuracy, recall ve F1 değerleri sahnede canlı karşılaştırılır.',
};
export const matrixScenario: Scenario<MatrixParams> = {
  defaults,
  steps: moments.map(([id, title, text, term], index) => ({
    id, title, text, term,
    ...(labTexts[id] ? { labText: labTexts[id] } : {}),
    params: { ...defaults, model: index === 6 ? 'dummy' : 'model' },
  })),
};
