import type { Scenario } from '../../core/player';
import { dbscanData } from './data';
import { dbscan } from './dbscan';
import { clusterSizes, countsText, epsText, kindCounts, verdictFor } from './view';

export interface DbscanParams {
  eps: number;
  /** Counts the point itself (sklearn). */
  minSamples: number;
  /** Selected point index, or null. */
  point: number | null;
  /** Step 8: share (0..1) of the expansion order that is coloured. */
  spread: number;
}

const { meta, examples, epsSweep, kmeansLabels, points } = dbscanData;
const base = dbscan(points, meta.eps, meta.minSamples);
const verdict = (i: number) => verdictFor(base, i, meta.minSamples);
const a = verdict(examples.core);
const b = verdict(examples.border);
const c = verdict(examples.noise);
const counts = kindCounts(base);
const sizes = clusterSizes(base).join(' ve ');
const km = [0, 1].map((k) => kmeansLabels.filter((l) => l === k).length).join(' / ');
const stop = (e: number): string => {
  const r = dbscan(points, e, meta.minSamples);
  return `eps ${epsText(e)}: ${r.clusters} küme, ${kindCounts(r).noise} gürültü`;
};
const eps = epsText(meta.eps);
const spreadValues = Array.from({ length: 21 }, (_v, i) => i / 20);
const fixed = { eps: meta.eps, minSamples: meta.minSamples };

// A sweep's key is left out of that step's params, so the sweep ends on its last value.
export const dbscanScenario: Scenario<DbscanParams> = {
  defaults: { ...fixed, point: null, spread: 1 },
  steps: [
    {
      id: 'hilaller',
      title: 'İki hilal ve birkaç dağınık nokta',
      text: `${points.length} nokta, henüz etiket yok. Gözle iki hilal ve aralarda birkaç dağınık nokta görünür. Kaç grup var? Küme sayısını önceden söylemeden gruplamak istiyoruz.`,
      params: { ...fixed, point: null },
    },
    {
      id: 'kmeans',
      title: 'K-Means burada yanılır',
      text: `KMeans(n_clusters=2) hilalleri ortadan düz bir çizgiyle böler (boylar ${km}); dağınık noktaları da bir kümeye zorla atar. K-Means küresel küme varsayar; hilal küresel değildir.`,
      params: { ...fixed, point: null },
    },
    {
      id: 'eps',
      title: 'eps dairesi',
      text: `Her noktaya aynı soru sorulur: "eps yarıçapında kaç komşun var?" Seçili noktanın (Nokta ${examples.core + 1}) eps = ${eps} yarıçaplı dairesinde ${a.neighbours} nokta var; noktanın kendisi de sayılır.`,
      term: 'eps (komşuluk yarıçapı)',
      labText: `Bir nokta seç (kutudan ya da saçılımda tıklayarak) ve eps kaydırıcısını oynat. Dairenin içindeki nokta sayısı sağdaki panelde canlı değişir.`,
      params: { ...fixed, point: examples.core },
    },
    {
      id: 'cekirdek',
      title: 'Çekirdek nokta',
      text: `min_samples = ${meta.minSamples}: bir noktanın çekirdek olması için dairesinde (kendisi dahil) en az ${meta.minSamples} nokta gerekir. Nokta ${examples.core + 1}: ${a.text}. Çekirdek, kümenin içindeki noktadır ve dolu daire olarak çizilir.`,
      term: 'çekirdek nokta (core point)',
      labText: `min_samples ve eps kaydırıcılarını oynat. Seçili noktanın çekirdek olup olmadığı, panelde komşu sayısıyla yan yana canlı okunur.`,
      params: { ...fixed, point: examples.core },
    },
    {
      id: 'sinir',
      title: 'Sınır nokta',
      text: `Nokta ${examples.border + 1}: ${b.text}. Kendisi çekirdek değildir ama bir çekirdeğin komşusudur; o kümeye katılır ve içi boş halka olarak çizilir.`,
      term: 'sınır nokta (border point)',
      labText: `Noktayı ve kaydırıcıları değiştir. Noktanın sınır olması için gereken koşul (komşu sayısı eşikten az, dairede çekirdek var) paneldeki karar satırında canlı görünür.`,
      params: { ...fixed, point: examples.border },
    },
    {
      id: 'gurultu',
      title: 'Gürültü',
      text: `Nokta ${examples.noise + 1}: ${c.text}. Hiçbir kümeye ait değildir; gri çarpı olarak çizilir.`,
      term: 'gürültü (noise)',
      labText: `Kaydırıcıları oynat ve noktanın türünün ne zaman değiştiğini izle. Karar satırı, noktanın gürültü olup olmadığını canlı söyler.`,
      params: { ...fixed, point: examples.noise },
    },
    {
      id: 'turler',
      title: 'Bütün noktalar',
      text: `Her nokta türüne göre çizilir: ${counts.core} çekirdek (dolu daire), ${counts.border} sınır (halka), ${counts.noise} gürültü (gri çarpı). Toplam ${points.length} nokta.`,
      labText: `eps ve min_samples değerlerini değiştir. Çekirdek, sınır ve gürültü sayıları panelde canlı güncellenir.`,
      params: { ...fixed, point: null },
    },
    {
      id: 'yayilma',
      title: 'Kümeler yayılır',
      text: `Bir çekirdekten başlanır; eps içindeki çekirdeklere dalga dalga geçilir, sınırlar ulaşıldıkları kümenin rengini alır. Sonunda ${base.clusters} küme (boylar ${sizes}) ve ${counts.noise} gürültü kalır.`,
      term: 'yoğunluk erişilebilirliği',
      labText: `eps ve min_samples değerlerini değiştir. Kümelerin sayısı, boyları ve gürültü sayısı panelde canlı okunur.`,
      params: { ...fixed, point: null },
      sweep: { key: 'spread', values: spreadValues, intervalMs: 150 },
    },
    {
      id: 'eps-degisir',
      title: "eps'i değiştir",
      text: `${epsSweep.map(stop).join(' · ')}. Küçük eps her şeyi parçalar ve gürültü çoğalır; büyük eps iki hilali tek kümede birleştirir.`,
      labText: `eps kaydırıcısını elle sürükle. Küme sayısı ve gürültü sayısı panelde canlı değişir; küçük eps her şeyi parçalar, büyük eps hilalleri birleştirir.`,
      params: { minSamples: meta.minSamples, point: null },
      sweep: { key: 'eps', values: [...epsSweep], intervalMs: 1800 },
    },
    {
      id: 'k-uzaklik',
      title: 'eps nasıl seçilir: k-uzaklık grafiği',
      text: `Her noktanın ${meta.minSamples}. en yakın komşusuna uzaklığı (kendisi dahil sayılarak) küçükten büyüğe sıralanır. Grafiğin büküldüğü yer (≈ ${epsText(Math.round(dbscanData.knee * 100) / 100)}) eps için iyi bir adaydır; seçtiğimiz eps = ${eps} çizgisi bu bükülmenin yakınındadır. ${countsText(base)}.`,
      term: 'k-uzaklık grafiği',
      labText: `min_samples kaydırıcısını oynat. Grafikteki eğri seçilen min_samples değerine göre değişir; eps çizgisinin bükülmeye yakınlığına bak.`,
      params: { ...fixed, point: null },
    },
  ],
};
