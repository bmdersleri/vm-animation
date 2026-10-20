import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { gauss } from './data';

export interface NbParams {
  /** Part 1 (fractions): prior, sensitivity, false-positive rate. */
  prior: number;
  sens: number;
  fpr: number;
  /** 0 = prior only, 1 = test marked, 2 = positives only. */
  reveal: 0 | 1 | 2;
  /** Part 2: words in the e-mail, and Laplace alpha. */
  words: string[];
  alpha: 0 | 1;
  /** Part 3: the new customer, and whether decision regions are painted. */
  query: { t: number; c: number };
  regions: boolean;
}

const PRIOR_MIN = 0.001;
const PRIOR_MAX = 0.5;
const PRIOR_STEP = 0.001;

export const nbScenario: Scenario<NbParams> = {
  defaults: {
    prior: 0.01,
    sens: 0.9,
    fpr: 0.1,
    reveal: 0,
    words: [],
    alpha: 0,
    query: { ...gauss.firstTest },
    regions: false,
  },
  steps: [
    {
      id: 'oncul',
      title: '1.000 kişi',
      text: '1.000 kişiden 10’u hasta: öncül olasılık (prior) %1. Henüz kimse test edilmedi.',
      term: 'öncül olasılık (prior)',
      params: { prior: 0.01, reveal: 0 },
    },
    {
      id: 'test',
      title: 'Test sonucu',
      text: 'Test, hastaların 9’unu ve sağlıklıların 99’unu pozitif işaretler. Hasta birinin pozitif çıkma olasılığı olabilirlik (likelihood) %90.',
      term: 'olabilirlik (likelihood)',
      params: { reveal: 1 },
    },
    {
      id: 'sonsal',
      title: 'Pozitiflerin kaçı hasta?',
      text: 'Negatifler soluklaşır, 108 pozitif kalır: 9 hasta, 99 sağlıklı. Sonsal olasılık (posterior) = 9/108 ≈ %8,3.',
      term: 'sonsal olasılık (posterior)',
      params: { reveal: 2 },
    },
    {
      id: 'oncul-agirligi',
      title: 'Öncülün ağırlığı',
      text: 'Öncül %10 olunca 100 hasta ve 900 sağlıklı var: 90 hasta ile 90 sağlıklı pozitif çıkar. Sonsal 90/180 = %50. Test aynı, sonuç çok farklı.',
      params: { prior: 0.1, reveal: 2 },
    },
    {
      id: 'spam-oncul',
      title: 'Spam öncülü',
      text: 'Postaların %40’ı spam. Hiç kelime görmeden spam olasılığı bu kadar.',
      params: { words: [], alpha: 0 },
    },
    {
      id: 'bedava',
      title: '"bedava"',
      text: '"bedava" spamda sık, normal postada seyrek geçer. Öncül çarpı olabilirlik, sonra normalize: spam olasılığı %40’tan %90,9’a çıkar.',
      params: { words: ['bedava'] },
    },
    {
      id: 'kazandiniz',
      title: 'Sonsal yeni öncül olur',
      text: 'Önceki sonsal (%90,9) şimdi yeni öncüldür. "kazandınız" gelince spam olasılığı %99,5’e çıkar.',
      params: { words: ['bedava', 'kazandınız'] },
    },
    {
      id: 'toplanti',
      title: 'Kanıt ters yönde de iter',
      text: '"toplantı" normal postalarda sık geçer: olasılık %96,4’e geriler. Yine de e-posta spam olarak kalır.',
      params: { words: ['bedava', 'kazandınız', 'toplantı'] },
    },
    {
      id: 'sira',
      title: 'Sıra fark etmez',
      text: 'Kelimeler başka sırayla gelse de iz farklı yoldan aynı noktaya varır: olasılıklar çarpılır. Bu, koşullu bağımsızlık (conditional independence) varsayımıdır; "naive" adı buradan gelir.',
      term: 'koşullu bağımsızlık (conditional independence)',
      sweep: {
        key: 'words',
        values: [
          ['toplantı'],
          ['toplantı', 'kazandınız'],
          ['toplantı', 'kazandınız', 'bedava'],
        ],
        intervalMs: 900,
      },
    },
    {
      id: 'laplace',
      title: 'Görülmemiş kelime',
      text: '"rapor" spam sınıfında hiç görülmemiş: α = 0 iken spam olasılığı %0’a düşer. Laplace düzeltmesi (Laplace smoothing) ile α = 1 olunca olasılık %81,6’ya döner.',
      term: 'Laplace düzeltmesi (Laplace smoothing)',
      params: { words: ['bedava', 'kazandınız', 'toplantı', 'rapor'] },
      sweep: { key: 'alpha', values: [0, 1], intervalMs: 1500 },
    },
    {
      id: 'gauss',
      title: 'Çan eğrileri',
      text: 'Şimdi müşteriler: 154 eğitim noktası. Her sınıf ve öznitelik için ortalama ve yayılımdan bir çan eğrisi, yani Gauss dağılımı (Gaussian distribution) çizilir.',
      term: 'Gauss dağılımı (Gaussian distribution)',
      params: { regions: false },
    },
    {
      id: 'yeni-musteri',
      title: 'Yeni müşteri',
      text: 'Yeni müşteri: 18 ay sözleşme, 1 şikâyet. Eğri yükseklikleri öncülle çarpılır: Kaldı 0,815, Ayrıldı 0,185.',
      params: { query: { ...gauss.firstTest } },
    },
    {
      id: 'sinir',
      title: 'Karar sınırı',
      text: 'Bölgeler boyanır. Naive Bayes de bir karar sınırı (decision boundary) çizer, ama bunu olasılıklardan çıkarır.',
      term: 'karar sınırı (decision boundary)',
      params: { regions: true },
    },
  ],
};

/** Prior moved by one slider step, rounded to avoid float drift, clamped to the allowed range. */
function nudge(prior: number, dir: 1 | -1): number {
  const next = Math.round((prior + dir * PRIOR_STEP) / PRIOR_STEP) * PRIOR_STEP;
  return Math.min(PRIOR_MAX, Math.max(PRIOR_MIN, Math.round(next * 1000) / 1000));
}

/** Teacher shortcuts: manual overrides on top of the current step. */
export function nbShortcuts(player: StepPlayer<NbParams>): Shortcut[] {
  const p = (): NbParams => player.state.params;
  return [
    {
      keys: ['l', 'L'], display: 'L', label: 'Laplace α: 0 / 1',
      run: () => player.setParam('alpha', p().alpha === 0 ? 1 : 0),
    },
    {
      keys: ['b', 'B'], display: 'B', label: 'Karar bölgelerini göster / gizle',
      run: () => player.setParam('regions', !p().regions),
    },
    { keys: ['+', '='], display: '+', label: 'Öncülü artır', run: () => player.setParam('prior', nudge(p().prior, 1)) },
    { keys: ['-'], display: '-', label: 'Öncülü azalt', run: () => player.setParam('prior', nudge(p().prior, -1)) },
  ];
}
