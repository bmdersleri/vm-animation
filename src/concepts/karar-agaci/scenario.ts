import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { Criterion } from './impurity';
import { childSweeps, sweep, toSamples } from './cart';
import { DOMAIN, train } from './data';

export interface TreeParams {
  criterion: Criterion;
  /** Part 1: number of filled candidate cards, 0..4. */
  shown: number;
  /** Part 2 scan progress: -1 = no line; 0..SCAN_N-1. */
  scan: number;
  /** Step 10 sub-branch search progress: -1 = none; 0..SUB_N-1. */
  subScan: number;
  /** 0 = root only, Infinity = unlimited. */
  depth: number;
  showTest: boolean;
  userSplit: { feature: 0 | 1; threshold: number } | null;
}

const trainSamples = toSamples(train);
/** Candidate thresholds scanned across both axes of the root split. */
export const SCAN_N: number =
  sweep(trainSamples, 0, 'gini').length + sweep(trainSamples, 1, 'gini').length;
/** Candidate thresholds the depth-2 tree scans below its root (the step-10 replay). */
export const SUB_N: number =
  childSweeps(trainSamples, 'gini', DOMAIN).reduce((s, c) => s + c.points.length, 0);
/** Largest finite depth; the slider's 7 means unlimited. */
export const DEPTH_MAX = 6;

const scanValues = Array.from({ length: SCAN_N }, (_, i) => i);
const subValues = Array.from({ length: SUB_N }, (_, i) => i);

export const treeScenario: Scenario<TreeParams> = {
  defaults: {
    criterion: 'gini',
    shown: 0,
    scan: -1,
    subScan: -1,
    depth: 0,
    showTest: false,
    userSplit: null,
  },
  steps: [
    {
      id: 'tablo',
      title: 'Bugün oynanır mı?',
      text: '14 günün kaydı var. Bir karar ağacı (decision tree), evet/hayır sorularıyla bugünün cevabını bulur. Kartlar henüz boş.',
      term: 'karar ağacı (decision tree)',
      params: { shown: 0, criterion: 'gini' },
    },
    {
      id: 'kok',
      title: 'Kökün karışıklığı',
      text: '9 evet, 5 hayır: Gini safsızlığı (Gini impurity) = 1 − (9/14)² − (5/14)² = 0,459. Sıfır, tam saf demektir.',
      labText: `Ölçütü Gini ile Entropi arasında değiştir. Kökün karışıklık değeri seçili ölçüte göre sahnede canlı okunur.`,
      term: 'Gini safsızlığı (Gini impurity)',
      params: { shown: 0 },
    },
    {
      id: 'hava',
      title: 'Aday soru: Hava',
      text: 'Hava sorusu günleri üç dala ayırır. Her dalın Gini değeri, dal büyüklüğüyle ağırlıklı ortalama (weighted average) alınır.',
      term: 'ağırlıklı ortalama (weighted average)',
      params: { shown: 1 },
    },
    {
      id: 'adaylar',
      title: 'Diğer adaylar',
      text: 'Sıcaklık, Nem ve Rüzgâr da birer aday bölünme (candidate split): aynı hesapla sırayla denenir.',
      term: 'aday bölünme (candidate split)',
      params: { shown: 4 },
      sweep: { key: 'shown', values: [2, 3, 4], intervalMs: 700 },
    },
    {
      id: 'kazanan',
      title: 'En iyi soru: Hava',
      text: 'En büyük Gini azalması (Gini decrease) Hava sorusunda. Bulutlu dalı saf bir yaprak.',
      labText: `Ölçütü değiştir. Her adayın azalma ya da kazanç değeri ve kazanan soru sahnede canlı okunur.`,
      term: 'Gini azalması (Gini decrease)',
      params: { shown: 4 },
    },
    {
      id: 'entropi',
      title: 'Entropiyle de Hava',
      text: 'Ölçüt entropi olunca kazanç bilgi kazancı (information gain) olur: 0,247 bit. Kazanan yine Hava; iki ölçüt çoğu zaman aynı soruyu seçer.',
      labText: `Ölçütü Gini ile Entropi arasında değiştir. Bilgi kazancı ya da Gini azalması ve kazanan soru sahnede canlı okunur.`,
      term: 'bilgi kazancı (information gain)',
      params: { criterion: 'entropi', shown: 4 },
    },
    {
      id: 'dagilim',
      title: 'Sayısal veri',
      text: 'Şimdi müşteriler: sözleşme süresi ve şikâyet sayısı, iki sayısal öznitelik (numerical feature). Ağaçta yalnızca kök var.',
      labText: `En fazla derinlik kaydırıcısını oynat. Ağacın biçimi ve bölgelerin sahnedeki hali canlı değişir.`,
      term: 'sayısal öznitelik (numerical feature)',
      params: { criterion: 'gini', depth: 0, scan: -1, showTest: false, userSplit: null },
    },
    {
      id: 'tarama',
      title: 'Eşik taraması',
      text: 'Bir eşik (threshold) çizgisi eksende kayar; her konumun Gini değeri eğriye çizilir. Önce sözleşme, sonra şikâyet ekseni.',
      term: 'eşik (threshold)',
      params: { userSplit: null },
      sweep: { key: 'scan', values: scanValues, intervalMs: 70 },
    },
    {
      id: 'esik',
      title: 'En iyi eşik',
      text: 'İki eksenin en iyisi yarışır; kazanan eşik grafiği ikiye böler. Bu, ağacın kök düğümü (root node) olur.',
      term: 'kök düğüm (root node)',
      params: { scan: -1, depth: 1, userSplit: null },
    },
    {
      id: 'alt-dallar',
      title: 'Alt dallarda tekrar',
      text: 'Her dalda aynı arama yinelenir. Derinlik 2: ağaç iki özniteliğin etkileşimini (interaction) kendisi buldu.',
      labText: `En fazla derinlik kaydırıcısını ve ölçütü değiştir. Ağacın biçimi ve alt dalların bölünmeleri sahnede canlı okunur.`,
      term: 'etkileşim (interaction)',
      // the search below the root replays quickly; subScan returns to -1 when it ends
      params: { depth: 2, subScan: -1, userSplit: null },
      sweep: { key: 'subScan', values: subValues, intervalMs: 80 },
    },
    {
      id: 'ezber',
      title: 'Daha derin = ezber',
      text: 'Eğitim doğruluğu %100 olur ama test noktalarında düşer: aşırı öğrenme (overfitting). Çare budama (pruning), yani ağacı sınırlamak.',
      labText: `Derinliği artır ve test noktalarını aç. Eğitim ve test doğruluğu sahnede canlı okunur; aradaki açıklığın ne zaman büyüdüğüne bak.`,
      term: 'aşırı öğrenme (overfitting), budama (pruning)',
      params: { showTest: true, userSplit: null },
      sweep: { key: 'depth', values: [3, 4, 5, 6, Infinity], intervalMs: 900 },
    },
    {
      id: 'kitap',
      title: 'Kitabın örneği',
      text: '100 müşteri: 40 ayrılan, 60 kalan. Kısa sözleşme dalında 35 ayrılan ve 15 kalan, uzun sözleşme dalında 5 ayrılan ve 45 kalan var. Gini 0,480 değerinden 0,300 değerine, entropi 0,971 değerinden 0,675 değerine iner; bilgi kazancı (information gain) 0,296 bit.',
      term: 'bilgi kazancı (information gain)',
      params: { userSplit: null },
    },
  ],
};

/** Next depth on the 0..DEPTH_MAX..Infinity ladder. */
function deeper(d: number): number {
  if (d === Infinity) return Infinity;
  return d >= DEPTH_MAX ? Infinity : d + 1;
}
function shallower(d: number): number {
  if (d === Infinity) return DEPTH_MAX;
  return Math.max(0, d - 1);
}

/** Teacher shortcuts: manual overrides on top of the current step. */
export function treeShortcuts(player: StepPlayer<TreeParams>): Shortcut[] {
  const p = (): TreeParams => player.state.params;
  return [
    {
      keys: ['g', 'G'], display: 'G', label: 'Ölçüt: Gini / Entropi',
      run: () => player.setParam('criterion', p().criterion === 'gini' ? 'entropi' : 'gini'),
    },
    { keys: ['+', '='], display: '+', label: 'Derinliği artır', run: () => player.setParam('depth', deeper(p().depth)) },
    { keys: ['-'], display: '-', label: 'Derinliği azalt', run: () => player.setParam('depth', shallower(p().depth)) },
    {
      keys: ['t', 'T'], display: 'T', label: 'Test noktalarını göster / gizle',
      run: () => player.setParam('showTest', !p().showTest),
    },
  ];
}
