import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { BOOK_BOOT, BOOTS, CUSTOMERS, EXPERIMENT, PICKS, SINGLE, type Tree } from '../topluluk/data';
import { majorityAccuracy, meanStd, oobChance } from '../topluluk/math';
import { leafCount, predictTree, rootSplit } from '../topluluk/tree';
import { majority, votes } from '../topluluk/vote';

/**
 * Parameters of the bootstrap and bagging page.
 * `shown` is how many of the n draws the bag scene has played (the step 2 sweep drives it);
 * `draw` 0 is the book's example (Lab draws use other values); `tree` is the 1-based bootstrap tree number.
 */
export interface BaggingParams {
  n: number;
  draw: number;
  shown: number;
  tree: number;
  trees: number;
  p: number;
  m: number;
  pick: number | null;
  /** Mean OOB share of the Lab's "100 kez çek" run for the current n (step 4), or null before a run. */
  avg: number | null;
}

/** Exponent digits as Unicode superscripts: 10 -> "¹⁰". */
export function superscript(n: number): string {
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n).replace(/\d/g, (d) => sup[Number(d)]);
}

/** Unit of the root split, as the panels and texts name it. */
const FEATURE_LABEL = ['sözleşme', 'şikâyet'] as const;

/** "sözleşme ≤ 13,5 ay" / "şikâyet ≤ 3,5": the question at a tree's root. */
export function rootLabel(tree: Tree): string {
  const s = rootSplit(tree);
  if (!s) return 'tek yaprak';
  return `${FEATURE_LABEL[s.f]} ≤ ${f(s.t, 1)}${s.f === 0 ? ' ay' : ''}`;
}

const n0 = BOOK_BOOT.ids.length;
const counts = BOOK_BOOT.counts;
const idsWith = (pred: (c: number) => boolean): number[] => BOOK_BOOT.ids.filter((id) => pred(counts[id]));
const repeated = idsWith((c) => c >= 2)
  .sort((a, b) => counts[b] - counts[a] || a - b)
  .map((id) => `${id} ×${counts[id]}`);
const once = idsWith((c) => c === 1);
const never = BOOK_BOOT.oob;

/** Trees of the bagging ensemble (the book's experiment uses the same count). */
const TREES = BOOTS.length;
const pickIndex = PICKS.vote;
const pickPoint: [number, number] = [CUSTOMERS[pickIndex].t, CUSTOMERS[pickIndex].c];
const pickYes = votes(pickPoint, TREES);
const pickClass = majority(pickYes, TREES) === 1 ? 'Ayrıldı' : 'Kaldı';

const P0 = 0.8;
const M0 = 3;
const wrong = 1 - majorityAccuracy(P0, M0);
const tree = meanStd(EXPERIMENT.tree);
const bag = meanStd(EXPERIMENT.bagging);
const trainOk = CUSTOMERS.filter((c) => predictTree(SINGLE, [c.t, c.c]) === c.y).length;
const roots = [0, 1, 2].map((i) => rootLabel(BOOTS[i].tree));

/** The step scenario of the bootstrap and bagging page (Ders steps 1-10). */
export const baggingScenario: Scenario<BaggingParams> = {
  defaults: { n: n0, draw: 0, shown: 20, tree: 1, trees: TREES, p: P0, m: M0, pick: pickIndex, avg: null },
  steps: [
    {
      id: 'torba',
      labText: 'Kart sayısını kaydırıcıyla değiştir. "Yeni çekiliş" başka bir örnek çeker, "Kitabın örneği" kitabın çekilişine döner.',
      title: 'Torba',
      text: `${n0} müşteri var, kimlikleri 0–${n0 - 1}. Bagging her ağaca aynı büyüklükte ama farklı bir eğitim kümesi verir. Nasıl?`,
      params: { shown: 0 },
    },
    {
      id: 'cekilis',
      labText: '"Yeni çekiliş" başka bir örnek çeker: aynı kart yine birden çok kez gelebilir, bazı kartlar hiç gelmeyebilir.',
      title: 'Yerine koyarak çek',
      term: 'bootstrap (yerine koyarak örnekleme)',
      text: `Torbadan ${n0} kez kart çekilir; her çekilişte kart torbaya geri döner. Kitabın örneği [${BOOK_BOOT.sample.join(' ')}]: aynı kart birden çok kez gelebilir.`,
      sweep: {
        key: 'shown',
        values: Array.from({ length: 20 }, (_, i) => i + 1),
        intervalMs: 700,
        count: (p) => p.n,
      },
    },
    {
      id: 'oob',
      labText: 'Yeni çekilişlerde tekrar rozetleri ve OOB kartları değişir; hiç OOB kalmayan bir çekiliş de çıkabilir.',
      title: 'Tekrar ve dışarıda kalanlar',
      term: 'OOB (out-of-bag, torba dışı)',
      text: `${repeated.join(', ')}; ${once.join(', ')} ×1; ${never.join(', ')} hiç çekilmedi: OOB = ${never.length} / ${n0} = ${pct(never.length / n0)}. OOB müşteriler bu ağacın görmediği, bedava bir sınav kümesidir.`,
      params: { shown: 20 },
    },
    {
      id: 'yuzde',
      labText: 'Kaydırıcı çekiliş sayısını değiştirir, eğrideki nokta onunla kayar. "100 kez çek" yüz örnek çeker ve ortalama OOB oranını eğrinin yanına yazar.',
      title: `Neden ${pct(1 / Math.E)}?`,
      text: `Bir müşterinin n çekilişte hiç seçilmeme olasılığı (1 − 1/n)ⁿ: n = ${n0} için ${f(oobChance(n0), 3)}, n büyüdükçe 1/e ≈ ${f(1 / Math.E, 3)}. Bir müşteri en az bir kez ${f(1 - oobChance(n0), 3)} olasılıkla seçilir; her bootstrap verinin ≈ ${pct(1 - 1 / Math.E)} kadarını görür.`,
    },
    {
      id: 'tek-agac',
      title: 'Tek ağaç',
      text: `Bölüm 5'in ${CUSTOMERS.length} müşterisi ve tam derinlikteki ağacı: eğitimde ${trainOk} / ${CUSTOMERS.length} doğru, ${leafCount(SINGLE)} yaprak. Derin ağaç her ayrıntıyı ezberler; yanlılığı düşük, varyansı yüksek.`,
    },
    {
      id: 'uc-agac',
      labText: 'Kaydırıcı hangi bootstrap örneğinden başlayan üç panelin görüneceğini seçer; kök sorusu her örnekte değişir.',
      title: 'Üç bootstrap, üç ağaç',
      text: `Her bootstrap'ın müşterileri (büyüklük = tekrar, içi boş = OOB) ve ağacının bölgeleri yan yana. Kök bölünmeleri: ${roots.join(' · ')}. Veride küçük bir oynama, kökten farklı bir ağaç.`,
    },
    {
      id: 'oylama',
      labText:
        'Ağaç sayısı kaydırıcısı oy haritasını yeniden boyar. Bir müşteriye tıkla ya da Tab ile gelip Enter veya Boşluk tuşuna bas: oy dökümü haritanın üstüne yazılır.',
      title: 'Oylama',
      term: 'bagging (bootstrap aggregating)',
      text: `Ağaç sayısı M = 1 → ${TREES} artarken oy haritası her durakta yeniden boyanır ve çoğunluk sınırı durulur. İşaretli müşteri: ${TREES} ağaçtan ${pickYes} tanesi Ayrıldı oyu veriyor → ${pickClass}.`,
      sweep: {
        key: 'trees',
        values: Array.from({ length: TREES }, (_, i) => i + 1),
        intervalMs: 120,
      },
    },
    {
      id: 'cogunluk',
      labText: 'Model doğruluğu ve model sayısı kaydırıcılarıyla çoğunluğun doğruluğunu izle; tek sayılı model sayısı beraberliği önler.',
      title: 'Çoğunluk neden kazanır?',
      term: 'çoğunluk oyu (majority vote)',
      text: `Her biri %${f(P0 * 100, 0)} doğru, bağımsız ${M0} model: çoğunluk yanlışsa en az ikisi yanılmıştır: ${M0} · ${f(1 - P0, 1)}² · ${f(P0, 1)} + ${f(1 - P0, 1)}³ = ${f(wrong, 3)} → doğruluk ${f(1 - wrong, 3)}. Hatalar aynıysa kazanç yok: ρ = 1 çizgisi düz kalır (${f(P0, 1)}).`,
    },
    {
      id: 'deney',
      title: 'Kitabın deneyi',
      text: `${EXPERIMENT.tree.length} farklı eğitim/test bölünmesi (500 gözlem, 10 öznitelik): tek ağaç ortalama ${f(tree.mean, 3)}, std ${f(tree.std, 3)}; bagging (${TREES} ağaç) ortalama ${f(bag.mean, 3)}, std ${f(bag.std, 3)}. Bagging hem daha doğru hem daha kararlı.`,
    },
    {
      id: 'sinir',
      title: "Bagging'in sınırı",
      text: 'Ağaçlar aynı güçlü öznitelikleri seçerse hataları benzer olur, oylama az kazandırır. Sonraki soru: ağaçları birbirinden nasıl uzaklaştırırız? Random Forest sayfası bunu yanıtlar.',
    },
  ],
};

/** Resolves step ids to indices, so the groups below stay in step with the scenario. */
const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(baggingScenario, id));

/** Steps with the n slider (5-20 on the cards, 1-100 on the curve) and the draw buttons (cards only). */
export const N_STEPS = indices('torba', 'cekilis', 'oob', 'yuzde');
export const DRAW_STEPS = indices('torba', 'cekilis', 'oob');
export const SAMPLE_STEPS = indices('yuzde');
export const TREE_STEPS = indices('uc-agac');
export const TREES_STEPS = indices('oylama');
export const PM_STEPS = indices('cogunluk');

/** Steps drawn by the bag scene (cards, slots and the (1 − 1/n)ⁿ curve). */
export const BAG_STEPS = indices('torba', 'cekilis', 'oob', 'yuzde');

/** Steps drawn by the region scene (scatter and tree regions). */
export const REGION_STEPS = indices('tek-agac', 'uc-agac', 'oylama');

/** Steps drawn by the chart scene (majority curve, experiment strips, limit). */
export const CHART_STEPS = indices('cogunluk', 'deney', 'sinir');
