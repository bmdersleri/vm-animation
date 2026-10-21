import type { Scenario } from '../../core/player';
import { kmeansData, kResult } from '../kmeans/data';
import { drops } from '../kmeans/geometry';
import { dropText, inertiaText, peakK, pointText, silhouetteText } from './view';

export interface KSecimiParams {
  /** Number of clusters shown, 1..10. */
  k: number;
  /** Selected point index (silhouette steps), or null. */
  point: number | null;
}

/** The elbow of the inertia curve: the last k whose extra cluster still bought a large drop. */
export const ELBOW_K = 3;

const sizesText = (k: number): string => [...kResult(k).sizes].sort((a, b) => a - b).join(' / ');
const d = drops(kmeansData.ks);
const sp = kmeansData.silhouettePoint;
const k3 = kResult(3);
const k4 = kResult(4);
const small4 = Math.min(...k4.sizes);
const neg4 = k4.s!.filter((v) => v < 0).length;
const peak = peakK();
const sil = (k: number): string => silhouetteText(kResult(k).silhouette);
const n = kmeansData.points.length;

// A sweep's key is left out of that step's params, so the sweep ends on its last value.
export const kSecimiScenario: Scenario<KSecimiParams> = {
  defaults: { k: 3, point: null },
  steps: [
    {
      id: 'k1',
      title: 'k=1: tek küme',
      text: `Tek merkez verinin ortasındadır. Inertia ${inertiaText(kResult(1).inertia)}: ölçeklenmiş 2 özellikte toplam varyans (${n} × 2). Silhouette ${silhouetteText(null)}: karşılaştırılacak komşu küme yok.`,
      term: 'küme sayısı (k)',
      params: { k: 1, point: null },
    },
    {
      id: 'k2',
      title: 'k=2: alttaki grup kopar',
      text: `Alttaki küçük grup ayrılır; boylar ${sizesText(2)}. Inertia ${inertiaText(kResult(2).inertia)}'ye düşer.`,
      params: { k: 2, point: null },
    },
    {
      id: 'k3',
      title: 'k=3: üstteki grup bölünür',
      text: `Üstteki büyük grup ikiye bölünür; boylar ${sizesText(3)}, inertia ${inertiaText(k3.inertia)}. Kesikli halkalı noktalar k=2'ye göre küme değiştirenlerdir.`,
      params: { k: 3, point: null },
    },
    {
      id: 'hep-duser',
      title: 'Inertia hep düşer',
      text: `k=4'ten 10'a taranır; inertia her k'da düşer (k=10'da ${inertiaText(kResult(10).inertia)}). k=n olsaydı inertia 0 olurdu: en düşük inertia'yı seçmek her zaman en çok kümeyi seçmek demektir, bu yüzden tek başına k seçtirmez.`,
      term: 'inertia (küme içi kareler toplamı)',
      params: { point: null },
      sweep: { key: 'k', values: [4, 5, 6, 7, 8, 9, 10], intervalMs: 900 },
    },
    {
      id: 'dirsek',
      title: 'Dirsek: azalan getiri',
      text: `Ardışık düşüşler: ${d.slice(0, 4).map(dropText).join(' · ')} … k=${ELBOW_K}'ten sonra kazanç belirgin biçimde küçülür: dirsek k=${ELBOW_K}.`,
      term: 'dirsek yöntemi (elbow method)',
      params: { k: 3, point: null },
    },
    {
      id: 'silhouette',
      title: 'Silhouette nedir?',
      text: `Nokta ${sp + 1} için a = kendi kümesine ortalama uzaklık (${pointText(k3.a![sp])}), b = en yakın komşu kümeye ortalama uzaklık (${pointText(k3.b![sp])}). s = (b − a) / max(a, b) = ${pointText(k3.s![sp])}. s, −1 ile +1 arasındadır: +1'e yakın net ayrışmış, 0 sınırda, negatif yanlış kümede olabilir.`,
      term: 'silhouette skoru',
      params: { k: 3, point: sp },
    },
    {
      id: 'egri',
      title: 'Silhouette eğrisi',
      text: `k=2..10 için ortalama silhouette çizilir. Zirve k=${peak}'dedir (${sil(peak)}); sonrasında skor genel olarak düşer.`,
      params: { point: null },
      sweep: { key: 'k', values: [2, 3, 4, 5, 6, 7, 8, 9, 10], intervalMs: 900 },
    },
    {
      id: 'k3-k4',
      title: 'k=3 mü k=4 mü?',
      text: `k=3 (${sil(3)}) ile k=4 (${sil(4)}) neredeyse eşit. Ama k=4'te ${small4} çiçeklik küçük bir küme kopar ve ${neg4} noktanın silhouette'i negatife düşer (kırmızı halka). Neredeyse eşit skor, çok farklı bölünme.`,
      params: { k: 4, point: null },
    },
    {
      id: 'karar',
      title: 'Çelişki ve karar',
      text: `Dirsek k=${ELBOW_K} diyor, silhouette k=${peak} diyor. İkisi farklı soruları yanıtlar: "ekstra küme eklemenin faydası azalıyor mu?" ve "kümeler ne kadar net ayrışıyor?". Kararı bağlam verir; Iris'te 3 tür olduğu bilinir.`,
      params: { k: 3, point: null },
    },
  ],
};
