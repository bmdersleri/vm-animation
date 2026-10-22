import type { Scenario } from '../../core/player';
import { dendrogramData as D, type Linkage } from './data';
import { cutForK, largestGap } from './tree';
import { clusterName, cutSizes, heightText, linkageRows, mergeInfo, sizesDesc, sizesText, splitOfGroup } from './view';
import { formatNumber } from '../../core/plot/format';

export interface DendrogramParams {
  linkage: Linkage;
  /** Merges drawn so far, 0..n-1. */
  merges: number;
  /** Number of clusters of the cut (1..6), or null when no cut line is drawn. */
  k: number | null;
  /** Selected point index, or null. */
  point: number | null;
  /**
   * 0-based merge the scene singles out instead of the newest one (step 4's example), or null.
   * Ignored when the linkage is not Ward, when a cut is drawn, or when merges <= focusMerge.
   */
  focusMerge: number | null;
}

const n = D.points.length;
const last = n - 1;
const ward = D.linkages.ward;
const firstMerge = mergeInfo('ward', 1);
const example = D.wardExample;
const exampleInfo = mergeInfo('ward', example.merge + 1);
const gap = largestGap(ward);
const natural = D.naturalK;
const ex = D.linkages.ward.merges;
const sizesOf = (l: Linkage, k: number): string => sizesText(cutSizes(l, k));
const desc = (l: Linkage): number[] => sizesDesc(l, natural);
const plus = (xs: readonly number[]): string => xs.join(' + ');
const kStep = 5;
const lengthOf = (g: 'A' | 'B' | 'zincir'): number => D.meta.groups[g].length;
const chainJoined = desc('single')[0];
const rows = linkageRows();

// Step 4 stays where step 3's sweep ended, so the tree does not rewind.
const SWEEP_END = 8;
const values = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_v, i) => from + i);
const base = { linkage: 'ward' as const, point: null, focusMerge: null };

// A sweep's key is left out of that step's params, so the sweep ends on its last value.
export const dendrogramScenario: Scenario<DendrogramParams> = {
  defaults: { linkage: 'ward', merges: 0, k: null, point: null, focusMerge: null },
  steps: [
    {
      id: 'yapraklar',
      title: 'Her nokta kendi kümesi',
      text: `${n} nokta, ${n} küme. Aglomeratif kümelemede her nokta önce kendi başına bir kümedir; dendrogramda henüz yalnızca yapraklar (nokta numaraları) var. İki özellik de aynı birimde olduğu için ölçekleme yapılmadı.`,
      term: 'aglomeratif kümeleme',
      params: { ...base, merges: 0, k: null },
    },
    {
      id: 'ilk-birlesme',
      title: 'İlk birleşme',
      text: `En yakın iki küme birleşir: ${clusterName(firstMerge.left)} ile ${clusterName(firstMerge.right)}. Dendrogramda ilk dal tam bu uzaklığın, ${heightText(firstMerge.height)} yüksekliğinde çizilir. Küme sayısı ${n - 1}'e düştü.`,
      labText: `Bağlantıyı değiştir: en yakın iki küme ve ilk dalın yüksekliği bağlantıya göre değişir. Birleşme kaydırıcısıyla ağacı adım adım izle; sayılar sağdaki panelde canlı okunur.`,
      params: { ...base, merges: 1, k: null },
    },
    {
      id: 'birlesmeler',
      title: 'Birleşmeye devam',
      text: 'Her adımda en yakın iki küme birleşir ve küme sayısı bir azalır. Yeni dallar giderek daha yüksekte durur: birleşme uzaklığı hiç azalmaz.',
      params: { ...base, k: null },
      sweep: { key: 'merges', values: values(2, SWEEP_END), intervalMs: 1100 },
    },
    {
      id: 'ward',
      title: 'İki kümenin uzaklığı ne demek?',
      text: `Ward'da "en yakın" şu demektir: birleşince küme içi kareler toplamı en az artan çift birleşir. Örnek, birleşme ${example.merge + 1} (${clusterName(exampleInfo.left)} ile ${clusterName(exampleInfo.right)}): kareler toplamı yalnızca ${formatNumber(example.increase, 3)} artar; dendrogramdaki yükseklik √(2 × ${formatNumber(example.increase, 3)}) = ${heightText(ex[example.merge].height)}.`,
      labText: `Birleşme kaydırıcısıyla ağacı ilerlet ya da geri sar. Seçilen birleşmenin uzaklığı ve Ward'da kareler toplamındaki artış panelde canlı okunur.`,
      term: 'Ward bağlantısı (Ward linkage)',
      params: { ...base, merges: SWEEP_END, k: null, focusMerge: example.merge },
    },
    {
      id: 'agac',
      title: 'Ağaç tamamlanır',
      text: `Birleşmeler sürdükçe küme sayısı 1'e iner. Son iki birleşme (${heightText(ward.merges[last - 2].height)} ve ${heightText(ward.merges[last - 1].height)}) ötekilerden çok yüksektir: en son ayrı kalan kümeler birbirinden uzaktır.`,
      labText: `Birleşme kaydırıcısıyla ağacı tamamla. Son birleşmelerin yükseklikleri ve kalan küme sayısı panelde canlı okunur; bağlantıyı değiştirince ağacın biçimi de değişir.`,
      term: 'dendrogram',
      params: { ...base, k: null },
      sweep: { key: 'merges', values: values(5, last), intervalMs: 800 },
    },
    {
      id: 'kesim',
      title: 'Kesim çizgisi',
      text: `Ağacı yatay bir çizgiyle keseriz: çizginin kestiği dal sayısı küme sayısıdır. ${heightText(cutForK(ward, kStep))} yüksekliğinde ${kStep} dal kesilir, yani ${kStep} küme (boylar ${sizesOf('ward', kStep)}). Saçılım bu kümelere göre boyanır.`,
      labText: `Kesim yüksekliğini kaydır ya da küme sayısı düğmelerine bas. Kesilen dal sayısı ve kümelerin boyları panelde canlı okunur; bağlantıyı değiştirince aynı sayıdaki kesim başka kümeler verir.`,
      term: 'kesim (dendrogramı kesmek)',
      params: { ...base, merges: last, k: kStep },
    },
    {
      id: 'kesim-kayar',
      title: 'Kesimi kaydır',
      text: 'Çizgiyi yüksekten alçağa indirdikçe küme sayısı 1, 2, 3, … artar: çizgi her birleşme yüksekliğini geçtikçe bir dal daha kesilir.',
      params: { ...base, merges: last },
      sweep: { key: 'k', values: values(1, 6), intervalMs: 1300 },
    },
    {
      id: 'dogal-kesim',
      title: 'Doğal kesim',
      text: `Ardışık birleşme yükseklikleri arasındaki en uzun boşluk ${heightText(gap.low)} ile ${heightText(gap.high)} arasında. Çizgiyi buraya koyunca ${natural} küme kalır (boylar ${sizesOf('ward', natural)}); iki yığının arasındaki ${lengthOf('zincir')} noktalık ince zincir iki yana paylaşılır (${plus(splitOfGroup('ward', 'zincir'))}).`,
      labText: `Bağlantıyı değiştir ve en uzun dikey boşluğun nerede kaldığına bak. Boşluk sınırları ve kümelerin boyları panelde canlı okunur; kesimi boşluğa ya da başka yüksekliğe koyabilirsin.`,
      term: 'en uzun dikey boşluk',
      params: { ...base, merges: last, k: natural },
    },
    {
      id: 'single',
      title: 'Bağlantı değişince ağaç değişir',
      text: `Aynı veriye single bağlantı: iki kümenin uzaklığı en yakın iki noktasının uzaklığıdır. Zincirin ${lengthOf('zincir')} noktası iki yığını alçak yükseklikte birbirine bağlar; ${natural} kümeye kesince iki yığın ve zincir tek küme olur (${chainJoined} nokta), ayrı kalan ${D.meta.groups.C.length} noktalık yığın ${plus(splitOfGroup('single', 'C'))} diye bölünür. Ward'da boylar ${sizesText(desc('ward'))}, single'da ${sizesText(desc('single'))}.`,
      labText: `Bağlantıyı Ward ya da başka bir seçenekle karşılaştır, kesimi değiştir. Kümelerin boyları panelde canlı okunur; zincirleme single bağlantıda belirginleşir.`,
      term: 'zincirleme (chaining)',
      params: { linkage: 'single', merges: last, k: natural, point: null },
    },
    {
      id: 'tablo',
      title: 'Üç bağlantı, bir tablo',
      text: `Aynı ${n} nokta, üç bağlantı: ${natural} kümede boylar ${rows.map((r) => `${r.linkage === 'ward' ? 'Ward' : r.linkage} ${sizesText(r.sizes)}`).join(', ')}. Bağlantı, "iki kümenin uzaklığı"nı nasıl tanımladığınızdır; ağacı o belirler.`,
      labText: `Tablodaki satırları karşılaştır: her bağlantı için kümelerin boyları orada canlı okunur. Bağlantıyı seçince ağaç ve saçılım o bağlantıya göre çizilir.`,
      term: 'bağlantı (linkage)',
      params: { ...base, merges: last, k: natural },
    },
  ],
};
