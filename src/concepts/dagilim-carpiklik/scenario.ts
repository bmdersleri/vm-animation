import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { BinCount, Seri } from './data';

export type { Seri };

export interface DagilimParams {
  seri: Seri;
  /** Series 003's last value: 28 in the book, dragged up to 60 in step 7 and the Lab. */
  extreme: number;
  bins: BinCount;
  log: boolean;
}

const SERI_ORDER: readonly Seri[] = ['002', '003', 'simetrik', 'sol'];
const BIN_ORDER: readonly BinCount[] = [3, 5, 10];

/** Steps with the series selector: the first four and the three-shapes step. */
export const SERIES_STEPS: readonly number[] = [0, 1, 2, 3, 7];
/** Steps with the bin-count selector. */
export const BINS_STEPS: readonly number[] = [1, 2, 3, 4, 5];
/** Steps where the log transform can be turned on. */
export const LOG_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5];
/** The outlier step: the only one that drags series 003's last value. */
export const EXTREME_STEPS: readonly number[] = [6];

export const dagilimScenario: Scenario<DagilimParams> = {
  defaults: { seri: '002', extreme: 28, bins: 5, log: false },
  steps: [
    {
      id: 'noktalar',
      title: 'Noktalar',
      text: 'On öğrencinin haftalık çalışma saati tek sayı doğrusunda: n = 10, en düşük 8, en yüksek 30. Değerlerin çoğu 8–20 arasında; 25 ve 30 sağda ayrı duruyor. Dağılım (distribution) bütün değerlerin birlikte görünüşüdür.',
      labText: `Seri seçiciyle başka bir seriye geç ve log dönüşümünü aç. Noktaların konumu ve uç değerler sahnede canlı değişir.`,
      term: 'dağılım (distribution)',
      params: { seri: '002', extreme: 28, bins: 5, log: false },
    },
    {
      id: 'histogram',
      title: 'Histogram',
      text: 'Aynı on değer beş kovaya bölünür: [8–12,4), [12,4–16,8), … Yükseklikler sırasıyla 4, 2, 2, 1, 1. Histogram dağılımın biçimini ilk kez görünür kılar.',
      labText: `Seriyi, kova sayısını ve log dönüşümünü değiştir. Her kovanın yüksekliği sahnede canlı okunur.`,
      term: 'histogram',
      params: { seri: '002', bins: 5 },
    },
    {
      id: 'ortalama-medyan',
      title: 'Ortalama ve medyan',
      text: 'Ortalama çizgisi 16,4’te turuncu üçgenle, medyan 14,5’te lacivert baklavayla belirir. Ortalama (mean) sağdaki iki değer yüzünden medyandan (median) 1,9 saat büyüktür.',
      labText: `Seriyi, kova sayısını ve log dönüşümünü değiştir. Ortalama ile medyanın birbirine göre durumu sahnede canlı okunur.`,
      term: 'ortalama (mean) · medyan (median)',
      params: { seri: '002' },
    },
    {
      id: 'carpiklik',
      title: 'Çarpıklık',
      text: 'Sağ kuyruk vurgulanır: çarpıklık (skewness) 0,90. Ortalama–medyan farkı tek bir sayıya dönüşür; pozitif değer uzun kuyruğun sağda olduğunu söyler.',
      labText: `Seriyi, kova sayısını ve log dönüşümünü değiştir. Çarpıklık değeri ve işareti sahnede canlı güncellenir.`,
      term: 'çarpıklık (skewness)',
      params: { seri: '002' },
    },
    {
      id: 'kova',
      title: 'Kova sayısı',
      text: 'Kova sayısı 3, 5 ya da 10 seçilir; aynı on değer üç farklı resim verir. Kova (bin) sayısı veriyle birlikte yazılmalıdır.',
      term: 'kova (bin)',
      params: { seri: '002', bins: 3 },
    },
    {
      id: 'log',
      title: 'Log dönüşümü',
      text: 'log1p açılır: noktalar log eksenine kayar, kuyruk sıkışır, çarpıklık 0,90 → 0,25 olur. Logaritmik dönüşüm (log transform) kuyruğu kısaltır ama yönünü değiştirmez; her zaman sıfıra indirmez.',
      labText: `Log dönüşümünü aç ve kapat, kova sayısını değiştir. Çarpıklığın dönüşümden önceki ve sonraki değeri sahnede yan yana okunur.`,
      term: 'logaritmik dönüşüm (log transform)',
      params: { seri: '002', log: true },
    },
    {
      id: 'kuyruk',
      title: 'Kuyruk',
      text: 'Sahne 003 serisine geçer: 28 saatlik öğrenci sağda tek başına durur. Uç değer (outlier) 60’a sürüklenince ortalama 13,6’ya, çarpıklık 3,06’ya çıkar; medyan 8,5 sabit kalır.',
      labText: `Uç değeri sürükle. Ortalama ve çarpıklık sahnede uç değerle birlikte canlı değişir; medyanın ne kadar yerinde kaldığına bak.`,
      term: 'uç değer (outlier)',
      params: { seri: '003', extreme: 28, bins: 5, log: false },
    },
    {
      id: 'uc-sekil',
      title: 'Üç şekil',
      text: 'Sağ, simetrik ve sol seriler arasında geçilir; noktalar, histogram ve işaretler canlı değişir. Simetri (symmetry) ortalamayı medyanla buluşturur; çarpıklığın işareti kuyruğun yönünü, büyüklüğü uzunluğunu verir.',
      term: 'simetri (symmetry)',
      params: { seri: '002', bins: 5, log: false },
    },
    {
      id: 'kural',
      title: 'Kural',
      text: 'Eşikler: |çarpıklık| < 0,5 simetrik, 0,5–1 orta, > 1 güçlü. Çarpıklık varsa dayanıklı özet (robust summary) medyan + IQR kullanır; uç değer çarpıklık var diye silinmez, önce kaynağı incelenir.',
      term: 'dayanıklı özet (robust summary)',
      params: { seri: '002', bins: 5, log: false },
    },
  ],
};

/** Index of `v` in `list`, one step forward and wrapping around. */
function nextOf<T>(list: readonly T[], v: T): T {
  return list[(list.indexOf(v) + 1) % list.length];
}

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function dagilimShortcuts(player: StepPlayer<DagilimParams>): Shortcut[] {
  const p = (): DagilimParams => player.state.params;
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  return [
    {
      keys: ['s', 'S'], display: 'S', label: 'Seri: 002 / 003 / simetrik / sol',
      run: () => { if (inSteps(SERIES_STEPS)) player.setParam('seri', nextOf(SERI_ORDER, p().seri)); },
    },
    {
      keys: ['k', 'K'], display: 'K', label: 'Kova sayısı: 3 / 5 / 10',
      run: () => { if (inSteps(BINS_STEPS)) player.setParam('bins', nextOf(BIN_ORDER, p().bins)); },
    },
    {
      keys: ['l', 'L'], display: 'L', label: 'Log dönüşümü aç / kapat',
      run: () => { if (inSteps(LOG_STEPS)) player.setParam('log', !p().log); },
    },
    {
      keys: ['e', 'E'], display: 'E', label: 'Uç değer: 28 ↔ 60',
      run: () => { if (inSteps(EXTREME_STEPS)) player.setParam('extreme', p().extreme === 28 ? 60 : 28); },
    },
  ];
}
