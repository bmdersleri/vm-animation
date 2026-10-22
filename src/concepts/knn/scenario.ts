import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { demo, type DatasetId, type RawPoint } from './data';
import type { Metric, Weighting } from './knn';

export interface KnnParams {
  dataset: DatasetId;
  scaled: boolean;
  metric: Metric;
  weighting: Weighting;
  k: number;
  regions: boolean;
  query: RawPoint;
  instant: boolean;
}

export const K_MIN = 1;
export const K_MAX = 15;

export const knnScenario: Scenario<KnnParams> = {
  defaults: {
    dataset: 'aylik',
    scaled: true,
    metric: 'oklid',
    weighting: 'esit',
    k: 5,
    regions: false,
    query: demo.defaultQuery.aylik,
    instant: false,
  },
  steps: [
    {
      id: 'veri',
      title: 'Eğitim verisi',
      text: 'Her nokta bir müşteri. k-NN eğitimde hiçbir şey öğrenmez; veriyi yalnızca saklar: tembel öğrenme (lazy learning).',
      term: 'tembel öğrenme (lazy learning)',
      params: { regions: false },
    },
    {
      id: 'yeni',
      title: 'Yeni müşteri geldi',
      text: 'Bu müşterinin kalıp kalmayacağını bilmiyoruz. Komşularına bakarak tahmin edeceğiz.',
    },
    {
      id: 'uzaklik',
      title: 'Uzaklıkları ölç',
      text: 'Yeni müşteriden her müşteriye olan uzaklık hesaplanır.',
    },
    {
      id: 'komsu',
      title: 'En yakın k komşuyu seç',
      text: 'Uzaklıklar küçükten büyüğe sıralanır; ilk k müşteri en yakın komşudur (nearest neighbor).',
      term: 'en yakın komşu (nearest neighbor)',
    },
    {
      id: 'oylama',
      title: 'Oylama ve tahmin',
      text: 'Komşular kendi sınıflarına oy verir; çoğunluk kazanır.',
    },
    {
      id: 'k1',
      title: 'k = 1: tek komşu',
      text: "Arka plan karar bölgelerini (decision regions), yani her bölgeye verilecek tahmini gösteriyor. k = 1'de sınır tırtıklı: tek bir müşteri bile kararı değiştirir.",
      labText: `k kaydırıcısını oynat ve yeni müşteriyi sürükle. Karar bölgelerinin sınırı ve tahmin sahnede canlı değişir; küçük k'da sınırın ne kadar tırtıklı olduğuna bak.`,
      term: 'karar bölgeleri (decision regions)',
      params: {
        dataset: 'aylik', scaled: true, metric: 'oklid', weighting: 'esit',
        k: 1, regions: true, query: demo.kSwallow,
      },
    },
    {
      id: 'kbuyur',
      title: 'k büyüyor',
      text: 'k büyüdükçe sınır yumuşar; karar daha çok komşuya dayanır.',
      params: { k: 9 },
      sweep: { key: 'k', values: [1, 3, 5, 7, 9], intervalMs: 700 },
    },
    {
      id: 'kcok',
      title: 'Çok büyük k',
      text: 'Komşuluk çok genişledi: azınlıktaki Ayrıldı sınıfı yutuldu, tahmin değişti.',
      labText: `k'yı en büyük değere çıkar ve yeni müşteriyi sürükle. Komşuluğun genişlemesiyle azınlık sınıfının oyu ve tahmin sahnede canlı okunur.`,
      params: { k: 15 },
    },
    {
      id: 'oklid',
      title: 'Komşuluk: Öklid',
      text: 'Öklid (Euclidean) uzaklığında komşuluk bir dairedir (kuş uçuşu).',
      labText: `Uzaklık ölçüsünü Öklid ile Manhattan arasında değiştir. Komşuluğun biçimi ve seçilen komşular sahnede canlı görünür.`,
      term: 'Öklid uzaklığı (Euclidean distance)',
      params: { dataset: 'aylik', scaled: true, metric: 'oklid', weighting: 'esit', k: 5, query: demo.metricSplit },
    },
    {
      id: 'manhattan',
      title: 'Komşuluk: Manhattan',
      text: 'Manhattan uzaklığında komşuluk bir elmastır; seçilen komşular değişti.',
      labText: `Uzaklık ölçüsünü Öklid ile Manhattan arasında değiştir ve yeni müşteriyi sürükle. Seçilen komşuların değişip değişmediği sahnede canlı okunur.`,
      params: { metric: 'manhattan' },
    },
    {
      id: 'toplam',
      title: 'Toplam fatura, ölçekli',
      text: 'Dikey eksen artık toplam fatura (kısmen süre × aylık faturadan türer). Ölçekleme (feature scaling) açık: iki öznitelik eşit söz sahibi.',
      labText: `Ölçeklemeyi aç ve kapat. İki özniteliğin uzaklığa katkısı ve seçilen komşular sahnede canlı değişir.`,
      term: 'ölçekleme (feature scaling)',
      params: { dataset: 'toplam', scaled: true, metric: 'oklid', weighting: 'esit', k: 5, query: demo.scaleSplit },
    },
    {
      id: 'olceksiz',
      title: 'Ölçekleme kapalı',
      text: "Ham değerlerde toplam fatura uzaklığı ele geçirir, sözleşme süresi neredeyse hiç sayılmaz. k-NN'de ölçekleme zorunludur.",
      labText: `Ölçeklemeyi aç ve kapat. Komşuların ve tahminin nasıl değiştiği sahnede canlı okunur.`,
      params: { scaled: false },
    },
  ],
};

/** Switch dataset and reset the query atomically (single emission). */
export function switchDataset(p: StepPlayer<KnnParams>, d: DatasetId): void {
  p.setParams({ dataset: d, query: demo.defaultQuery[d] });
}

/** Teacher shortcuts: manual overrides on top of the current step. */
export function knnShortcuts(player: StepPlayer<KnnParams>): Shortcut[] {
  const p = (): KnnParams => player.state.params;
  const stepK = (d: number): void => {
    player.setParam('k', Math.max(K_MIN, Math.min(K_MAX, p().k + d)));
  };
  return [
    { keys: ['+', '='], display: '+', label: "k'yi artır", run: () => stepK(2) },
    { keys: ['-'], display: '-', label: "k'yi azalt", run: () => stepK(-2) },
    {
      keys: ['m', 'M'], display: 'M', label: 'Öklid / Manhattan',
      run: () => player.setParam('metric', p().metric === 'oklid' ? 'manhattan' : 'oklid'),
    },
    {
      keys: ['s', 'S'], display: 'S', label: 'Ölçekleme aç / kapat',
      run: () => player.setParam('scaled', !p().scaled),
    },
    {
      keys: ['d', 'D'], display: 'D', label: 'Veri setini değiştir',
      run: () => switchDataset(player, p().dataset === 'aylik' ? 'toplam' : 'aylik'),
    },
    {
      keys: ['b', 'B'], display: 'B', label: 'Karar bölgelerini göster / gizle',
      run: () => player.setParam('regions', !p().regions),
    },
  ];
}
