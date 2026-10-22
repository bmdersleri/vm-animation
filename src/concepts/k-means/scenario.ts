import type { Scenario } from '../../core/player';
import { kmeansData, type Run } from '../kmeans/data';
import { formatNumber } from '../../core/plot/format';

export interface KMeansParams {
  /** Index into kmeansData.runs. */
  start: number;
  /** 0 = start centres; 2t-1 = turn t assignment; 2t = turn t move. */
  frame: number;
  /** Step 8: which of the ten n_init starts is shown. */
  pick: number;
}

export const frameCount = (run: Run): number => 2 * run.turns.length + 1;

const GOOD = 0;
const BAD = 1;
const good = kmeansData.runs[GOOD];
const bad = kmeansData.runs[BAD];
const lastGood = frameCount(good) - 1;
const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const goodSizes = ((): string => {
  const n = new Array<number>(good.start.length).fill(0);
  good.turns.at(-1)!.labels.forEach((l) => { n[l] += 1; });
  return n.sort((a, b) => a - b).join(' / ');
})();
const one = (v: number): string => formatNumber(v, 1);

const defaults: KMeansParams = { start: GOOD, frame: 0, pick: kmeansData.nInitBest };

// A sweep's key is left out of that step's params, so the sweep ends on its last value.
export const kMeansScenario: Scenario<KMeansParams> = {
  defaults,
  steps: [
    {
      id: 'etiketsiz',
      title: 'Etiketsiz noktalar',
      text: `${kmeansData.points.length} çiçek, iki ölçülmüş özellik: sepal length ve petal length (ölçeklenmiş). Gerçek grup bilinmiyor. K-Means grupları kendisi bulacak, ama kaç grup olacağını (k) biz söyleriz: k = ${good.start.length}.`,
      term: 'etiketsiz veri (unlabeled data)',
      params: { start: GOOD, frame: 0 },
    },
    {
      id: 'baslangic',
      title: 'Başlangıç: üç merkez',
      text: 'k-means++ üç merkezi birbirinden uzak seçer. Artı işaretleri başlangıç merkezleridir; henüz hiçbir nokta bir kümeye ait değil.',
      term: 'küme merkezi (centroid) · başlangıç (initialization)',
      params: { start: GOOD, frame: 0 },
    },
    {
      id: 'ata',
      title: 'Ata: en yakın merkeze',
      text: 'Her nokta en yakın merkezin rengini alır. Atama karesinde seçili üç noktadan üç merkeze çizgi çizilir; en kısası kalındır. Atamanın küme boyları yanda.',
      term: 'atama (assignment)',
      params: { start: GOOD, frame: 1 },
    },
    {
      id: 'tasi',
      title: 'Taşı: merkez ortalamaya',
      text: `Her merkez kendi kümesinin ortalamasına kayar; eski konum soluk iz olarak kalır. Tur 1 sonunda inertia (küme içi kareler toplamı) ${one(good.turns[0].inertia)}.`,
      term: 'güncelleme (update) · inertia',
      params: { start: GOOD, frame: 2 },
    },
    {
      id: 'tekrar',
      title: 'Tekrar: ata, taşı, ata, taşı',
      text: 'Kalan turlar aynı iki adımla oynar. Her turda tur numarası, renk değiştiren nokta sayısı ve inertia görünür; inertia her turda düşer, hiç artmaz.',
      term: 'yineleme (iteration)',
      params: { start: GOOD },
      sweep: { key: 'frame', values: range(3, lastGood - 1), intervalMs: 900 },
    },
    {
      id: 'dur',
      title: 'Dur: kimse değişmedi',
      text: `Son turda hiçbir nokta renk değiştirmedi, merkezler kıpırdamadı: döngü durur. Durma koşulu, bir atama turunda hiçbir noktanın küme değiştirmemesidir. Sonuç: boylar ${goodSizes}, inertia ${one(good.inertia)}.`,
      term: 'durma koşulu (convergence)',
      params: { start: GOOD, frame: lastGood },
    },
    {
      id: 'kotu',
      title: 'Kötü başlangıç',
      text: `Rastgele başlangıçta iki merkez aynı gruba düşer. Döngü kurallara uyarak çalışır ama inertia ${one(bad.inertia)}'de takılır; iyi sonuç ${one(good.inertia)} idi.`,
      term: 'yerel optimum (local optimum)',
      params: { start: BAD },
      sweep: { key: 'frame', values: range(0, frameCount(bad) - 1), intervalMs: 900 },
    },
    {
      id: 'ninit',
      title: 'n_init=10: on başlangıç, en iyisi',
      text: `On ayrı başlangıçla K-Means çalıştırılır, inertia'sı en düşük olan seçilir (${one(Math.min(...kmeansData.nInit.map((r) => r.inertia)))}). Kitaptaki KMeans(n_clusters=3, n_init=10, random_state=42) satırı bunu yapar.`,
      term: 'çoklu başlangıç (n_init)',
      params: { start: GOOD, frame: lastGood },
    },
  ],
};
