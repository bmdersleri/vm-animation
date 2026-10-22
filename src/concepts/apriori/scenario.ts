import type { Scenario } from '../../core/player';
import { sepetData } from '../birliktelik/data';
import { fpGrowth } from '../birliktelik/fptree';
import { itemName, setAbbr } from '../birliktelik/format';
import { count } from '../birliktelik/metrics';
import { formatNumber } from '../../core/plot/format';
import {
  LATTICE, LEVELS, SUPPORT_STOPS, TOTAL, analyse, conditionalSummary, itemCountText, pathsText, setCountText, th, thresholdText,
} from './view';

export interface AprioriParams {
  /** Smallest basket count that is frequent (min_support × baskets, rounded up). */
  minCount: number;
  /** Lattice levels 1..level are drawn with their real state. */
  level: number;
  /** FP-tree: baskets inserted so far, 0..n. */
  inserted: number;
  /** Item whose conditional pattern base is shown (step 10); null = none. */
  baseItem: string | null;
  /** Lattice node picked in the Lab, as a set key; null = none. */
  node: string | null;
}

/** The lesson's threshold: min_support 0,2 = at least 4 baskets. */
export const LESSON_MIN_COUNT = 4;

const tx = sepetData.transactions;
const n = tx.length;
const MIN = LESSON_MIN_COUNT;
const trace = analyse(MIN).trace;
const levelOf = (k: number) => trace.levels[k - 1].candidates;
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (v: number): string => [...String(v)].map((d) => SUPERSCRIPT[Number(d)]).join('');

type Cand = (typeof trace.levels)[number]['candidates'][number];
const L1 = levelOf(1);
const L2 = levelOf(2);
const L3 = levelOf(3);
const rare = L1.filter((c) => c.status === 'infrequent');
const rareItem = rare[0].set[0];
const rareName = itemName(rareItem);
const rareSupersets = LATTICE.filter((node) => node.k >= 2 && node.set.includes(rareItem)).length;
const withCount = (c: Cand): string => `${setAbbr(c.set)} ${c.count}`;
const ofStatus = (cs: readonly Cand[], status: Cand['status']): Cand[] => cs.filter((c) => c.status === status);
const pruned3 = ofStatus(L3, 'pruned');
const counted3 = L3.filter((c) => c.count !== null);

const sweepSizes = SUPPORT_STOPS.map((s) => analyse(s.minCount).trace.frequent.size);
const chain = (xs: readonly (string | number)[]): string => xs.join(' → ');

const cond = conditionalSummary(MIN, 'peynir');
const fp = cond.tree;
const treeNodes = ((): number => {
  const walk = (node: (typeof fp.snapshots)[number]): number => node.children.reduce((s, c) => s + 1 + walk(c), 0);
  return walk(fp.snapshots[fp.snapshots.length - 1]);
})();
const dropped = sepetData.items.filter((i) => !fp.order.includes(i));
const fpSets = fpGrowth(tx, MIN);
const sameSets = fpSets.size === trace.frequent.size && [...fpSets].every(([k, v]) => trace.frequent.get(k) === v);

export const aprioriScenario: Scenario<AprioriParams> = {
  defaults: { minCount: MIN, level: 0, inserted: 0, baseItem: null, node: null },
  steps: [
    {
      id: 'uzay',
      title: 'Arama uzayı',
      text: `${LEVELS} ürün, 2${sup(LEVELS)} − 1 = ${TOTAL} olası öğe kümesi verir: her ürün bir sepette ya vardır ya yoktur. Kaba kuvvet bu ${TOTAL} kümenin hepsini sayar. Kafes kümeleri büyüklüğüne göre satırlara dizer; henüz hiçbirine bakılmadı.`,
      term: 'öğe kümesi (itemset)',
      params: { level: 0 },
    },
    {
      id: 'seviye1',
      title: 'Seviye 1: tek ürünler sayılır',
      text: `${L1.length} aday, yani her ürün tek başına, fişler taranarak sayılır (${thresholdText(MIN)}). ${rare.map((c) => `${itemName(c.set[0])} ${c.count} < ${MIN}`).join(', ')} → sık değil; diğer ${ofStatus(L1, 'frequent').length} ürün sık.`,
      labText: 'Eşiği değiştir ve taramanın hangi ürünleri sık, hangilerini sık değil bıraktığına bak. Seviye düğmeleriyle kafesin kaçıncı seviyeye kadar boyandığını seç.',
      term: 'sık öğe kümesi',
      params: { level: 1 },
    },
    {
      id: 'ozellik',
      title: 'Apriori özelliği',
      text: `${rareName} sık değil. ${rareName} içeren bütün üst kümeler (${rareSupersets} düğüm) de sık olamaz; bu yüzden hiç sayılmadan budanır. Sık olmayan bir kümenin üst kümesi de sık olamaz.`,
      labText: 'Eşiği değiştir: sık olmayan ürünler, dolayısıyla budanan üst kümeler değişir. Seviye düğmeleriyle taramayı ilerlet.',
      term: 'Apriori özelliği (aşağı doğru kapanış)',
      params: { level: 1 },
    },
    {
      id: 'seviye2',
      title: 'Seviye 2 adayları',
      text: `Sık ${ofStatus(L1, 'frequent').length} üründen ${L2.length} çift aday üretilir ve tek tek sayılır: ${ofStatus(L2, 'frequent').length} tanesi sık (${ofStatus(L2, 'frequent').map(withCount).join(', ')}), ${ofStatus(L2, 'infrequent').length} tanesi değil (${ofStatus(L2, 'infrequent').map(withCount).join(', ')}).`,
      labText: 'Eşiği değiştir: çift adayların sayısı ve hangilerinin sık kaldığı değişir. Seviye düğmeleriyle önceki ve sonraki seviyeye geç.',
      params: { level: 2 },
    },
    {
      id: 'budama',
      title: 'Seviye 3: budama',
      text: `Sık çiftlerin birleştirilmesinden ${L3.length} aday çıkar. Alt kümelerinden biri sık değilse aday sayılmadan budanır: ${pruned3.map((c) => `${setAbbr(c.set)} (${setAbbr(c.prunedBy ?? [])} sık değil)`).join(', ')}. Kalan ${counted3.length} aday sayılır: ${counted3.map((c) => `${withCount(c)} (${c.status === 'frequent' ? 'sık' : 'değil'})`).join(', ')}.`,
      labText: 'Eşiği değiştir: hangi adayların budandığı ve hangilerinin sayıldığı değişir. Bir düğüme tıklayınca gerekçesini oku.',
      term: 'budama (pruning)',
      params: { level: 3 },
    },
    {
      id: 'dur',
      title: 'Dur',
      text: `Seviye ${trace.levels.length + 1} için aday kalmaz, Apriori durur. Toplam ${trace.frequent.size} sık küme bulundu; ${trace.counted} aday sayıldı, kaba kuvvet ${TOTAL} küme sayardı.`,
      labText: 'Eşiği değiştir ve sayılan aday ile sık küme sayılarının nasıl değiştiğini izle. Sona git düğmesi kafesi tamamen boyar.',
      params: { level: LEVELS },
    },
    {
      id: 'esik',
      title: 'Eşiği değiştir',
      text: `min_support ${chain(SUPPORT_STOPS.map((s) => th(s.support)))} taranır (en az ${chain(SUPPORT_STOPS.map((s) => s.minCount))} fiş; ${th(0.15)} × ${n} = ${formatNumber(0.15 * n, 1)} → en az ${SUPPORT_STOPS[3].minCount}). Sık küme sayısı ${chain(sweepSizes)}. Kafes her durakta yeniden boyanır: eşik düştükçe daha çok küme sık olur.`,
      labText: 'Eşik kaydırıcısını elle sürükle: kafes ve sayaçlar anında yeniden boyanır. Eşik düştükçe sık küme çoğalır.',
      params: { level: LEVELS },
      sweep: { key: 'minCount', values: SUPPORT_STOPS.map((s) => s.minCount), intervalMs: 1800 },
    },
    {
      id: 'fp-sira',
      title: 'FP-Growth 1. tarama: sıklık sırası',
      text: `Ürünler sayılır ve sıklığa göre dizilir (${fp.header.map((h) => `${itemName(h.item)} ${h.total}`).join(', ')}). ${dropped.map((i) => `${itemName(i)} ${count(tx, [i])} < ${MIN}`).join(', ')}: eşiğin altında, atılır. Her fiş bu sıraya göre dizilir.`,
      labText: 'Eşiği değiştir: hangi ürünlerin atıldığı ve sıklık sırası değişir. Fiş ekleme kaydırıcısıyla ağacın kuruluşuna şimdiden bakabilirsin.',
      term: 'FP-Growth',
      params: { minCount: MIN, level: LEVELS, inserted: 0, baseItem: null },
    },
    {
      id: 'fp-agac',
      title: 'FP-ağacı kurulur',
      text: `Fişler sıralanmış hâliyle tek tek eklenir. Ortak önek paylaşılırsa sayaç artar, yoksa yeni dal açılır. Sonunda ${n} fiş, ${treeNodes} düğüm.`,
      labText: 'Fiş ekleme kaydırıcısını elle sürükle: ağaç fiş fiş büyür ya da küçülür. Eşiği değiştirince sıralama ve ağaç yeniden kurulur.',
      term: 'FP-ağacı',
      params: { baseItem: null },
      sweep: { key: 'inserted', values: Array.from({ length: n }, (_, i) => i + 1), intervalMs: 350 },
    },
    {
      id: 'kosullu',
      title: 'Koşullu örüntü tabanı',
      text: `${itemName('peynir')} için ağaçtaki yollar (önek: sayaç): ${pathsText(cond.paths)}. Bu yollarda ${cond.local.map(itemCountText).join(', ')} kez geçer; eşik ${MIN} olduğundan ${cond.kept.map(itemName).join(' ve ')} sık. ${cond.sets.map((s) => setCountText(s, MIN)).join('; ')}. Aday üretmeden, yalnız ilgili dallara bakarak.`,
      labText: 'Ürün seçiciyle başka bir ürünün koşullu tabanına bak. Eşiği değiştirince hangi ürünlerin sık kaldığı değişir.',
      term: 'koşullu örüntü tabanı',
      params: { inserted: n, baseItem: 'peynir' },
    },
    {
      id: 'karsilastir',
      title: 'Aynı sonuç, farklı yol',
      text: `Apriori ve FP-Growth ${sameSets ? 'aynı' : 'farklı'} ${trace.frequent.size} sık kümeyi bulur. Veri tarama sayısı: Apriori seviye başına bir, burada ${trace.levels.length}; FP-Growth iki. Aday üretimi: Apriori yapar, FP-Growth yapmaz. Kitabın ölçtüğü süreler 0,75 ms ve 0,49 ms; küçük veride fark küçüktür, büyük ve yoğun veride açılır.`,
      labText: 'Eşiği değiştir: iki algoritmanın sık küme listeleri her eşikte aynı kalır. Tarama sayıları ve aday üretimi farkı eşiğe göre değişebilir.',
      params: { inserted: n, baseItem: null },
    },
  ],
};
