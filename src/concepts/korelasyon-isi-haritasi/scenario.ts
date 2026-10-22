import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';

export interface KorelParams {
  /** The enlarged Anscombe panel / the panel set selection: I–IV. */
  set: 1 | 2 | 3 | 4;
  /** Set IV's leverage point y; the drag table walks 6 → 20. */
  noktaY: number;
  /** 006's numeric-coded category column: off on step 4, on on step 8. */
  churn: boolean;
}

const SET_ORDER: readonly KorelParams['set'][] = [1, 2, 3, 4];
/** The drag table's y values; the K shortcut walks the same list (make_eda_data.py). */
const LEVERAGE_YS: readonly number[] = [6, 8, 10, 12.5, 15, 18, 20];

/** Steps with the set selector: 5–7. */
export const SET_STEPS: readonly number[] = [4, 5, 6];
/** Steps with the `churn` switch: 4 and 8. */
export const CHURN_STEPS: readonly number[] = [3, 7];
/** Steps where the leverage point can be moved: 6. */
export const LEVERAGE_STEPS: readonly number[] = [5];

export const korelasyonScenario: Scenario<KorelParams> = {
  defaults: { set: 1, noktaY: 12.5, churn: false },
  steps: [
    {
      id: 'iki-degisken',
      title: 'İki değişken',
      text: 'Yedi öğrenci tek düzlemde: yatay eksen haftalık çalışma saati, dikey eksen sınav notu. Noktalar sol alttan sağ üste diziliyor; iki değişken birlikte hareket ediyor gibi görünüyor.',
      term: 'saçılım grafiği (scatter plot)',
      params: { set: 1, noktaY: 12.5, churn: false },
    },
    {
      id: 'korelasyon',
      title: 'Korelasyon',
      text: 'Noktaların arasından en küçük kareler eğilim çizgisi geçer; r = 0,995. Pearson korelasyonu −1 ile 1 arasındadır: işareti ilişkinin yönünü, büyüklüğü gücünü verir.',
      term: 'Pearson korelasyonu (Pearson correlation)',
    },
    {
      id: 'nedensellik',
      title: 'Nedensellik',
      text: 'Yatay eksen artık not, dikey eksen devamsızlık: not yükseldikçe devamsızlık düşer, r = −0,993. İlişki güçlü ama nedensellik (causation) kanıtı değildir: üçüncü değişken (motivasyon), ters nedensellik ya da rastlantı olabilir.',
      term: 'nedensellik (causation)',
    },
    {
      id: 'isi-haritasi',
      title: 'Isı haritası',
      text: '006 verisinin dört değişkeni 4 × 4 matrise girer: köşegen 1,000, hücreler üç basamak, renk −1 … +1. Isı haritası çok değişkeni tek bakışta tarar; köşegen bulgu değildir.',
      term: 'ısı haritası (heatmap)',
      params: { churn: false },
    },
    {
      id: 'anscombe',
      title: 'Dört panel',
      text: 'Dört saçılım aynı eksenlerde: her birinin ortalaması x 9, y 7,5009; varyansı x 11, y 4,127; r 0,816. Anscombe Dörtlüsü aynı özetin dört farklı örüntüyü gizleyebildiğini gösterir.',
      term: 'Anscombe Dörtlüsü (Anscombe’s quartet)',
    },
    {
      id: 'kaldirac',
      title: 'Kaldıraç',
      text: 'Set IV büyütülür: on nokta x = 8’de, tek kaldıraç noktası (19; 12,50). Noktanın y’si sürüklenince r −0,249 ile 0,958 arasında değişir; nokta çıkarılınca x sabit kalır, r tanımsız olur.',
      term: 'kaldıraç (leverage)',
      params: { set: 4 },
    },
    {
      id: 'dogrusal-degil',
      title: 'Doğrusal değil',
      text: 'Set II büyütülür: r 0,816 ama ilişki eğri; Spearman 0,691 daha düşüktür. Pearson yalnız doğrusal ilişkiyi ölçer; grafiğe bakmadan katsayı yorumlanmaz.',
      term: 'doğrusal ilişki (linear relationship)',
      params: { set: 2 },
    },
    {
      id: 'kategori',
      title: 'Kategori tuzağı',
      text: '006 matrisine churn = [1, 0, 0, 1, 0, 0] sütunu eklenir; korelasyonlar −0,387 … 0,401 olur. Renkler “ilişki” gibi görünür ama 0/1 kodlaması ölçüm değildir.',
      term: 'sayısal kodlanmış kategori (numeric-coded category)',
      params: { churn: true },
    },
    {
      id: 'sizinti',
      title: 'Sızıntı',
      text: 'İki kutu: “tüm veri üzerinde EDA” ve “yalnız eğitim kümesinde EDA”. Test kümesinin dağılımını görmek bilgi sızıntısıdır (data leakage); keşif eğitimde yapılır, doğrulama ayrı kümede.',
      term: 'bilgi sızıntısı (data leakage)',
    },
    {
      id: 'kural',
      title: 'Kural',
      text: 'Tek cümle: “Özet istatistik yeterli değildir, grafik şart.” Üç bağlantı: kutu-grafigi (aykırı gözlem), iqr-aykiri (eşik ve aykırı kararı), pca (ilişkili sütunlar ve boyut).',
      term: 'keşifçi veri analizi (EDA)',
    },
  ],
};

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function korelasyonShortcuts(player: StepPlayer<KorelParams>): Shortcut[] {
  const p = (): KorelParams => player.state.params;
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  const nextSet = (): KorelParams['set'] =>
    SET_ORDER[(SET_ORDER.indexOf(p().set) + 1) % SET_ORDER.length];
  const nextY = (): number =>
    LEVERAGE_YS[(LEVERAGE_YS.indexOf(p().noktaY) + 1) % LEVERAGE_YS.length];
  return [
    {
      keys: ['s', 'S'], display: 'S', label: 'Set: I / II / III / IV',
      run: () => { if (inSteps(SET_STEPS)) player.setParam('set', nextSet()); },
    },
    {
      keys: ['c', 'C'], display: 'C', label: 'churn sütunu: kapalı / açık',
      run: () => { if (inSteps(CHURN_STEPS)) player.setParam('churn', !p().churn); },
    },
    {
      keys: ['k', 'K'], display: 'K', label: 'Kaldıraç noktası y: 6 → 20',
      run: () => { if (inSteps(LEVERAGE_STEPS)) player.setParam('noktaY', nextY()); },
    },
  ];
}
