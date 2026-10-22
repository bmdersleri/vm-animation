import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';

export interface KutuParams {
  /** IQR coefficient: 1.5 is the book rule, 3.0 the wide comparison of the last step. */
  k: 1.5 | 3;
  /** The sixth student (Bilgisayar 66, Elektrik 62): steps 2–8. */
  sixth: boolean;
  /** The third group (Makine): steps 7–8. */
  third: boolean;
  /** The raw dots; turning them off hides the dots only, never the outlier information. */
  dots: boolean;
}

/** Steps with the IQR coefficient: 5–8. */
export const K_STEPS: readonly number[] = [4, 5, 6, 7];
/** Steps with the sixth-student switch: 2–8. */
export const SIXTH_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
/** Steps where the third group exists: 7–8. */
export const THIRD_STEPS: readonly number[] = [6, 7];
/** Steps with the dots switch: all of them. */
export const DOTS_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

export const kutuScenario: Scenario<KutuParams> = {
  defaults: { k: 1.5, sixth: false, third: false, dots: true },
  steps: [
    {
      id: 'iki-grup',
      title: 'İki grup',
      text: 'İki şerit: Bilgisayar beş not, Elektrik beş not; eksen 40–100. İki sınıfın notlarını yan yana görmek, dağılımları tek bakışta karşılaştırmayı sağlar.',
      term: 'grup karşılaştırması (group comparison)',
      params: { k: 1.5, sixth: false, third: false, dots: true },
    },
    {
      id: 'medyan',
      title: 'Medyan',
      text: 'Her grup sıralanır; beş notta ortadaki değer işaretlenir: Bilgisayar 78, Elektrik 72. Medyan (median) tek bir uç değerden etkilenmez.',
      labText: `Altıncı öğrenciyi ekleyip çıkar. Her grubun medyanı sahnede canlı okunur; tek bir not bu değeri nasıl değiştirir, izle.`,
      term: 'medyan (median)',
      params: { sixth: false },
    },
    {
      id: 'ceyrekler',
      title: 'Çeyrekler',
      text: 'n = 5’te Q1 ve Q3 tam gözleme düşer: 0,25 × (5 − 1) = 1 ve 0,75 × 4 = 3. konumlar. Bilgisayar Q1 74 / Q3 82, Elektrik Q1 68 / Q3 76; iki grupta da IQR 8. Çeyrek (quartile) ve çeyrekler arası açıklık (IQR) verinin ortadaki yarısını çerçeveler.',
      labText: `Altıncı öğrenciyi ekleyip çıkar. Q1, Q3 ve IQR değerleri grup başına sahnede canlı okunur.`,
      term: 'çeyrek (quartile) · çeyrekler arası açıklık (IQR)',
    },
    {
      id: 'kutu',
      title: 'Kutu',
      text: 'Q1–Q3 arası kutu, içinde medyan çizgisi. Kutu grafiği (box plot) beş sayıyı tek simgeye sıkıştırır: kutunun yarısı verinin ortadaki %50’sidir.',
      term: 'kutu grafiği (box plot)',
    },
    {
      id: 'biyik',
      title: 'Bıyıklar',
      text: '1,5 × 8 = 12; sınırlar Bilgisayar’da 62 / 94, Elektrik’te 56 / 88 olur. Bıyık (whisker) sınırın kendisinde değil, sınırın içindeki en uç gözlemde biter: 70 / 82 ve 68 / 80.',
      labText: `IQR katsayısını ve altıncı öğrenciyi değiştir. Bıyık sınırları ile bıyığın bittiği gözlem sahnede canlı okunur.`,
      term: 'bıyık (whisker)',
      params: { k: 1.5 },
    },
    {
      id: 'aykiri',
      title: 'Aykırılar',
      text: '98 ve 55 sınırların dışında kalır: içi boş baklava. Aykırı değer (outlier) “hatalı veri” demek değildir; noktanın kaynağı incelenir.',
      labText: `IQR katsayısını ve altıncı öğrenciyi değiştir. Hangi notların sınırın dışında kalıp aykırı olduğu sahnede canlı görünür.`,
      term: 'aykırı değer (outlier)',
      params: { k: 1.5 },
    },
    {
      id: 'ucuncu-grup',
      title: 'Üçüncü grup',
      text: 'Makine eklenir: medyan 72, Elektrik ile aynı; IQR 12, iki gruptaki 8’den geniş; aykırı yok. Yalnız medyana bakan, yayılımı (spread) kaçırır.',
      labText: `Altıncı öğrenciyi ve IQR katsayısını değiştir. Üç grubun medyanı, IQR değeri ve aykırıları sahnede yan yana okunur.`,
      term: 'yayılım (spread)',
      params: { k: 1.5, third: true },
    },
    {
      id: 'sinir',
      title: 'Sınır',
      text: 'Kutu, yoğunluğu ve n’i gizler: her grubun beş noktası şematik bir yoğunluk eğrisiyle (Silverman bandı) gösterilir ve “n = 5: yoğunluk tahmini zayıf” yazar. k = 1,5 ile 3,0 karşılaştırılır; ayrıntısı iqr-aykiri sayfasında.',
      labText: `IQR katsayısını değiştir, noktaları aç ya da kapat, altıncı öğrenciyi ekle. Kutu, yoğunluk eğrisi ve n sahnede canlı karşılaştırılır; ayrıntısı iqr-aykiri sayfasında.`,
      term: 'yoğunluk (density)',
      params: { k: 1.5, third: true },
    },
  ],
};

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function kutuShortcuts(player: StepPlayer<KutuParams>): Shortcut[] {
  const p = (): KutuParams => player.state.params;
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  return [
    {
      keys: ['k', 'K'], display: 'K', label: 'IQR katsayısı: 1,5 ↔ 3,0',
      run: () => { if (inSteps(K_STEPS)) player.setParam('k', p().k === 1.5 ? 3 : 1.5); },
    },
    {
      keys: ['a', 'A'], display: 'A', label: '6. öğrenci: kapalı / açık',
      run: () => { if (inSteps(SIXTH_STEPS)) player.setParam('sixth', !p().sixth); },
    },
    {
      keys: ['n', 'N'], display: 'N', label: 'Noktalar: görünür / gizli',
      run: () => { if (inSteps(DOTS_STEPS)) player.setParam('dots', !p().dots); },
    },
  ];
}
