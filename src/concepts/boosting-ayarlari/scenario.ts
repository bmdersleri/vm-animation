import { stepIndex, type Scenario } from '../../core/player';
import { formatNonZero, formatNumber as f, formatTrim } from '../../core/plot/format';
import { bestIndex, earlyStop } from '../boosting/boost';
import { BOOK_LRS, CURVES, REG, SURFACE, type LrCurve } from '../boosting/data';
import { fitRegTree, leafCount, predictReg, treeDepth, type RegTree } from '../boosting/regtree';
import { gridTrials, sequentialSearch } from '../boosting/search';

/**
 * Parameters of the boosting settings page.
 * `lr` is the learning rate ν and `trees` the tree count of the curve scene (steps 1-5); `patience`
 * is the early-stopping patience (step 5); `depth` and `leaves` size the single tree of steps 6-8;
 * `budget` (trials the search may spend), `trial` (how many of them the Ders sweep has shown), `seed` and `showSurface` belong to the search of steps 9-10.
 */
export interface TuneParams {
  lr: number;
  trees: number;
  patience: number;
  depth: number;
  leaves: number;
  budget: number;
  trial: number;
  seed: number;
  showSurface: boolean;
}

/** Trees of the book's experiment (`n_estimators=150`). */
export const BOOK_TREES = 150;

/** Longest curve: the data holds 500 trees per learning rate. */
export const MAX_TREES = CURVES.byLr[0].valLoss.length;

/** The curves of one learning rate (all six rates of the data are valid). */
export function curveOf(lr: number): LrCurve {
  const c = CURVES.byLr.find((x) => Math.abs(x.lr - lr) < 1e-9);
  if (!c) {
    throw new Error(`no curve for learning rate ${lr}`);
  }
  return c;
}

/** Learning rate as the texts write it: 1,0 / 0,3 / 0,05. */
export function lrText(lr: number): string {
  return f(lr, lr < 0.1 ? 2 : 1);
}

/** A search-surface learning rate with its significant digits: 0,01 / 0,032 / 0,1 / 0,316 / 1,0. */
export function surfaceLrText(lr: number): string {
  return lr >= 1 ? lrText(lr) : formatTrim(lr, 3);
}

/** Residuals of the mean model on the training and validation sets (what the single trees of steps 6-8 fit). */
const trainR = REG.train.y.map((y) => y - REG.mean);
const valR = REG.val.y.map((y) => y - REG.mean);

/** Mean squared error of `tree` against the residuals `r` at the points `x`. */
export function treeError(tree: RegTree, x: readonly number[], r: readonly number[]): number {
  return x.reduce((s, xv, i) => s + (r[i] - predictReg(tree, xv)) ** 2, 0) / x.length;
}

/** The level-wise tree of `depth` and the leaf-wise tree of `leaves` on the first residuals. */
export function levelTree(depth: number): RegTree {
  return fitRegTree(REG.train.x, trainR, { maxDepth: depth });
}
export function leafTree(leaves: number): RegTree {
  return fitRegTree(REG.train.x, trainR, { maxLeaves: leaves });
}

/** Training / validation error of a first-residual tree. */
export function trainError(tree: RegTree): number {
  return treeError(tree, REG.train.x, trainR);
}
export function valError(tree: RegTree): number {
  return treeError(tree, REG.val.x, valR);
}

const sortedThresholds = (tree: RegTree): number[] =>
  tree.nodes.filter((n) => n.l !== -1).map((n) => n.t).sort((a, b) => a - b);

// ---- step 1-5 numbers
const aucAt = (lr: number, trees: number): number => curveOf(lr).valAuc[trees - 1];
const bookAucs = BOOK_LRS.map((lr) => f(aucAt(lr, BOOK_TREES), 3));
const slow = curveOf(BOOK_LRS[0]);
const fast = curveOf(BOOK_LRS[BOOK_LRS.length - 1]);
const slowDip = bestIndex(slow.valLoss);
const fastDip = bestIndex(fast.valLoss);
const big = curveOf(1);
const bigDip = bestIndex(big.valLoss);
const bigTrain = big.trainLoss[MAX_TREES - 1];
/** Patience of the Ders step 5 (the Lab slider changes it). */
const PATIENCE = 50;
const stop = earlyStop(curveOf(0.3).valLoss, PATIENCE);

// ---- steps 6-8 numbers
const level = levelTree(2);
const leaf = leafTree(4);
const levelT = sortedThresholds(level);
const leafSplits = leaf.splits.map((s) => s.t);
const leafGains = leaf.splits.map((s) => s.gain);
const rows = Array.from({ length: 61 }, (_, i) => {
  const t = leafTree(i + 4);
  return { leaves: i + 4, depth: treeDepth(t), train: trainError(t), val: valError(t) };
});
const bestRow = rows.reduce((a, r) => (r.val < a.val ? r : a));
const lastRow = rows[rows.length - 1];

// ---- steps 9-10 numbers
const surf = SURFACE.auc.flat();
const depthOf = (cell: number): number => SURFACE.depths[Math.floor(cell / SURFACE.lrs.length)];
const lrOf = (cell: number): number => SURFACE.lrs[cell % SURFACE.lrs.length];
const gridCells = gridTrials(8);
const gridDepths = [...new Set(gridCells.map(depthOf))];
const gridLrs = [...new Set(gridCells.map(lrOf))];
const bestOf = (cells: readonly number[]): number => cells.reduce((a, c) => (surf[c] > surf[a] ? c : a));
const gridBest = bestOf(gridCells);
const seqBest = bestOf(sequentialSearch(SURFACE.auc, 8, 0));
const cellText = (c: number): string => `derinlik ${depthOf(c)}, ν = ${surfaceLrText(lrOf(c))}, AUC ${f(surf[c], 3)}`;
/** Word for the sequential best against the grid best, from the data. */
const seqWord = surf[seqBest] > surf[gridBest] ? 'daha yüksek' : surf[seqBest] < surf[gridBest] ? 'daha düşük' : 'eşit';

// Book constants in the texts below (not in the data files): 3000 observations and depth 4 for the
// step 1 experiment (make_classification(3000), max_depth=4), 800 observations for the search surface,
// "first 3 random" = the first 3 trials of sequentialSearch, max_depth=5 / num_leaves=24 = the book's rule.
const trialSweep = Array.from({ length: 8 }, (_, i) => i + 1);

/** The step scenario of the boosting settings page (Ders steps 1-10). */
export const boostingAyarlariScenario: Scenario<TuneParams> = {
  defaults: { lr: 0.3, trees: BOOK_TREES, patience: PATIENCE, depth: 2, leaves: 4, budget: 8, trial: 8, seed: 0, showSurface: false },
  steps: [
    {
      id: 'lr-deney',
      title: 'Kitabın deneyi',
      text: `3000 gözlem, ${BOOK_TREES} ağaç, derinlik 4; ν = ${lrText(BOOK_LRS[0])} → ${lrText(BOOK_LRS[BOOK_LRS.length - 1])}: doğrulama AUC ${bookAucs.join(' → ')} (veriden). Ters U: ortada en iyi. Neden?`,
      labText: 'Öğrenme oranını ve ağaç sayısını değiştirin: seçilen oran vurgulanır, noktalar o ağaç sayısındaki doğrulama AUC değerini gösterir. Ters U biçiminin tepesi ağaç sayısına göre nerede duruyor?',
    },
    {
      id: 'egriler',
      title: 'Eğrilerin içi',
      text: `Beş öğrenme oranının doğrulama log-kaybı ağaç sayısına göre. ν = ${lrText(slow.lr)} eğrisi ${BOOK_TREES}. ağaçta hâlâ iniyor (${f(slow.valLoss[BOOK_TREES - 1], 3)}; dibi ${slowDip}. ağaçta): yakınsamadı. ν = ${lrText(fast.lr)} eğrisinin dibi ${fastDip}. ağaçta; ${BOOK_TREES}. ağaçta dibi çoktan geçmiş.`,
      labText: 'Öğrenme oranını ve ağaç sayısını değiştirin: seçilen oranın eğrisi kalınlaşır, işaretçi o eğrinin seçtiğiniz ağaç sayısındaki değerinde durur.',
      sweep: { key: 'trees', values: Array.from({ length: BOOK_TREES }, (_, i) => i + 1), intervalMs: 30 },
    },
    {
      id: 'agac-ekle',
      title: 'Öğrenme oranı düşünce ağaç ekle',
      text: `ν = ${lrText(slow.lr)} eğrisi ${MAX_TREES} ağaca uzar: doğrulama AUC ${BOOK_TREES} ağaçta ${f(aucAt(slow.lr, BOOK_TREES), 3)}, ${MAX_TREES} ağaçta ${f(aucAt(slow.lr, MAX_TREES), 3)}. Kitabın uyarısı: öğrenme oranını düşürüp ağaç sayısını sabit bırakmak yetersiz öğrenmeye yol açar.`,
      labText: 'Öğrenme oranını ve ağaç sayısını değiştirin: eğri seçtiğiniz ağaç sayısına kadar çizilir, işaretçi eğrinin ucunda durur. Hangi oranlar için eğri hâlâ iniyor?',
      params: { lr: slow.lr, trees: MAX_TREES },
    },
    {
      id: 'ezber',
      title: 'Ezber açığı',
      text: `Büyük ν = ${lrText(big.lr)}: eğitim log-kaybı ${/* exactly 0 in the data; formatNonZero(0) would print "0,000" */ bigTrain < 5e-7 ? 'sıfıra iner' : `${formatNonZero(bigTrain, 3)} değerine iner`}, doğrulama kaybı ${bigDip}. ağaçta en düşük (${f(big.valLoss[bigDip - 1], 3)}), sonra ${f(big.valLoss[MAX_TREES - 1], 3)} değerine yükselir. Aradaki açık (taralı) aşırı öğrenme işaretidir; kitabın birinci hatası: eğitimde neredeyse mükemmel, doğrulamada düşüş.`,
      labText: 'Öğrenme oranını değiştirin: eğitim ve doğrulama eğrileri, aradaki açık ve doğrulama kaybının dibi seçilen orana göre yeniden çizilir.',
      params: { lr: big.lr },
    },
    {
      id: 'erken-durdurma',
      title: 'Erken durdurma',
      term: 'erken durdurma (early stopping)',
      text: `ν = ${lrText(0.3)}, sabır ${PATIENCE}: doğrulama kaybı ${stop.best}. ağaçta en düşük; ${PATIENCE} ağaç iyileşme yok → ${stop.stop}. ağaçta dur. Durmaya doğrulama kümesi karar verir; test kümesi en sona saklanır.`,
      labText: 'Öğrenme oranını ve sabırı değiştirin: en düşük ağaç ve durma ağacı yeniden hesaplanır. Sabır eğrinin sonunu aştığında durma çizgisi kaybolur.',
      params: { lr: 0.3 },
    },
    {
      id: 'seviye',
      title: 'Seviye-öncelikli büyüme',
      term: 'seviye-öncelikli büyüme (level-wise, XGBoost)',
      text: `Gradyan artırma sayfasının ilk artıklarına derinlik 2 ağacı: önce kök (${f(level.nodes[0].t, 3)}), sonra ikinci seviyenin iki düğümü birlikte (${f(levelT[0], 3)} ve ${f(levelT[2], 3)}); ${leafCount(level)} yaprak, dengeli; hata ${f(trainError(level), 3)}.`,
      labText: 'Ağaç derinliğini değiştirin: seviye-öncelikli ağaç her seviyesini tamamen açar. Şema, bölünme çizgileri ve hata birlikte güncellenir.',
    },
    {
      id: 'yaprak',
      title: 'Yaprak-öncelikli büyüme',
      term: 'yaprak-öncelikli büyüme (leaf-wise, LightGBM)',
      text: `Aynı ${leafCount(leaf)} yaprak: her adımda en çok kazandıran yaprak açılır (${leafSplits.map((t) => f(t, 3)).join(' → ')}; kayıp azalışı ${leafGains.map((g) => f(g, 3)).join(' / ')}); ağaç dengesiz, derinlik ${treeDepth(leaf)}; hata ${f(trainError(leaf), 3)}. Aynı yaprak sayısında daha düşük kayıp, ama daha derin.`,
      labText: 'Ağaç derinliğini değiştirin: yaprak-öncelikli ağaç, aynı derinlikteki seviye-öncelikli ağacın yaprak sayısı kadar yaprak açar. Şema, bölünme çizgileri ve hata birlikte güncellenir.',
    },
    {
      id: 'yaprak-siniri',
      title: 'Yaprak sınırı',
      text: `Yaprak-öncelikli tek ağaç, yaprak sayısı ${rows[0].leaves} → ${lastRow.leaves}: derinlik ${rows[0].depth} → ${lastRow.depth}; eğitim hatası ${formatNonZero(rows[0].train, 3)} → ${formatNonZero(lastRow.train, 3)}, doğrulama hatası ${bestRow.leaves} yaprakta en düşük (${f(bestRow.val, 3)}), sonra ${f(lastRow.val, 3)} değerine yükselir. Kitabın kuralı: num_leaves < 2^max_depth (max_depth=5 iken num_leaves=24).`,
      labText: 'Yaprak sayısını değiştirin: çizgi seçtiğiniz yaprak sayısına gelir; şerit o ağacın derinliğini, eğitim ve doğrulama hatasını gösterir.',
      sweep: { key: 'leaves', values: rows.map((r) => r.leaves), intervalMs: 100 },
    },
    {
      id: 'izgara',
      title: 'Izgara araması',
      term: 'ızgara araması (grid search)',
      text: `Kitabın 800 gözlemlik verisi; derinlik × ν uzayı, ${SURFACE.nTrees} ağaç, ${SURFACE.cv} katlı çapraz doğrulama AUC. Izgara ${gridCells.length} deneme: derinlik {${gridDepths.join(', ')}} × ν {${gridLrs.map(surfaceLrText).join('; ')}}; en iyisi ${cellText(gridBest)}. Izgara nereye bakacağını önceden sabitler.`,
      labText: 'Deneme bütçesini değiştirin: ızgara yeniden kurulur ve bütün denemeler birden görünür. "Bütün yüzeyi göster" ile denenmeyen hücrelerin AUC değerleri de açılır.',
      sweep: { key: 'trial', values: trialSweep, intervalMs: 700 },
    },
    {
      id: 'sirali-arama',
      title: 'Sıralı arama',
      text: `Aynı bütçe, ${gridCells.length} deneme: ilk 3 rastgele, sonra her deneme o ana kadarki iyi sonuçların yakınına. Izgara en iyisi: ${cellText(gridBest)} · Sıralı en iyisi: ${cellText(seqBest)} → sıralı arama ${seqWord} AUC buldu. Bunu gerçek bir aramada bilemezdiniz; burada sonradan ${surf.length} hücrenin hepsini ölçtük.`,
      labText: 'Deneme bütçesini değiştirin ve "Yeni başlangıç" ile sıralı aramanın rastgele başlangıcını yenileyin. Şerit iki aramanın en iyisini aynı bütçeyle yan yana verir.',
      sweep: { key: 'trial', values: trialSweep, intervalMs: 700 },
    },
  ],
};

/** Resolves step ids to indices, so the groups below stay in step with the scenario. */
const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(boostingAyarlariScenario, id));

/** Step drawn as the AUC dot plot. */
export const POINT_STEPS = indices('lr-deney');

/** Steps drawn by the curve scene. */
export const CURVE_STEPS = indices('egriler', 'agac-ekle', 'ezber', 'erken-durdurma');

/** Steps drawn by the growth scene (Task 5). */
export const GROW_STEPS = indices('seviye', 'yaprak', 'yaprak-siniri');

/** Steps drawn by the search scene (Task 5). */
export const SEARCH_STEPS = indices('izgara', 'sirali-arama');
