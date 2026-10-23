import { formatNumber as f, formatPercent as pct, formatTrim as trim } from '../../core/plot/format';
import type { LineChartSpec } from '../../core/plot/line-chart';
import { BOOK_BOOT, BOOTS, CUSTOMERS, EXPERIMENT, SINGLE } from '../topluluk/data';
import { labBootstrap, majorityAccuracy, meanStd, oobChance } from '../topluluk/math';
import { leafCount, predictTree } from '../topluluk/tree';
import { majority, votes } from '../topluluk/vote';
import { baggingScenario, rootLabel, superscript, type BaggingParams } from './scenario';

/** Bag scene data (steps 1-3): the cards, the draws played so far and what they imply. */
export interface BagView {
  n: number;
  ids: number[];
  /** All n draws of this bootstrap (card ids). */
  sample: number[];
  /** How many draws the slots show. */
  shown: number;
  /** Times each card was drawn among the shown draws. */
  counts: number[];
  /** Cards with no draw among the shown draws; filled at the OOB step only (the earlier steps do not name them). */
  oob: number[];
  /** Repeat badges (count >= 2), in id order; filled at the OOB step only. */
  badges: { id: number; count: number }[];
}

/** Region scene data (steps 5-7), drawn by the region scene. */
export interface RegionsView {
  layout: 'single' | 'panels' | 'vote';
  /** Bootstrap indices (0-based) of the panels; empty for the single tree. */
  trees: number[];
  /** Panel titles: the root question of each tree. */
  titles: string[];
  /** Trees voting (vote layout). */
  m: number;
  pick: { index: number; ayrildi: number; m: number; verdict: 'Ayrıldı' | 'Kaldı' | 'berabere' } | null;
}

/** Chart scene data (steps 8-10), drawn by the chart scene. */
export interface ChartsView {
  kind: 'majority' | 'experiment' | 'limit';
  /** The closing question of the limit step. */
  question: string;
  majority: LineChartSpec;
  experiment: { id: 'tree' | 'bagging'; label: string; values: number[]; mean: number; std: number }[];
}

/** Everything the scene draws for one step and parameter set. */
export interface BaggingView {
  stepId: string;
  strip: string;
  bag: BagView | null;
  curve: LineChartSpec | null;
  regions: RegionsView | null;
  charts: ChartsView | null;
  links: { href: string; label: string }[];
}

/** The n draws of a bootstrap: the book's example for draw 0 at n = 10, else the seeded Lab draw. */
export function drawsFor(n: number, draw: number): number[] {
  return draw === 0 && n === BOOK_BOOT.ids.length ? [...BOOK_BOOT.sample] : labBootstrap(n, draw);
}

/** (1 − 1/n)ⁿ for n = 1..100 with the 1/e line, the marked n and, after the Lab's "100 kez çek", the mean OOB share. */
function curveSpec(n: number, avg: number | null): LineChartSpec {
  const at = Math.max(1, Math.min(100, Math.round(n)));
  const pts: [number, number][] = Array.from({ length: 100 }, (_, i) => [i + 1, oobChance(i + 1)]);
  return {
    x: [1, 100],
    y: [0, 0.5],
    xTitle: 'n (çekiliş sayısı)',
    yTitle: 'hiç seçilmeme olasılığı',
    series: [{ id: 'oob', cls: 'oob-curve', pts }],
    refs: [
      // the two lines sit almost on top of each other, so one label carries both numbers
      {
        y: 1 / Math.E,
        label: `1/e ≈ ${f(1 / Math.E, 3)}${avg === null ? '' : ` · 100 çekiliş ortalaması ${f(avg, 3)}`}`,
        cls: 'e-line',
      },
      ...(avg === null ? [] : [{ y: avg, label: '', cls: 'lab-avg' }]),
    ],
    marker: { x: at, y: oobChance(at), label: `n = ${at} · ${f(oobChance(at), 3)}` },
  };
}

/** Majority accuracy for M = 1, 3, ..., 51 independent models of accuracy p, the ρ = 1 line and the marked M. */
function majoritySpec(p: number, m: number): LineChartSpec {
  const ms = Array.from({ length: 26 }, (_, i) => 2 * i + 1);
  const at = Math.max(1, Math.min(51, m));
  return {
    x: [1, 51],
    y: [0.5, 1],
    xTitle: 'M (model sayısı)',
    yTitle: 'çoğunluk doğruluğu',
    series: [{ id: 'majority', cls: 'majority-curve', pts: ms.map((k) => [k, majorityAccuracy(p, k)] as [number, number]) }],
    refs: [{ y: p, label: `ρ = 1 (aynı hatalar): ${f(p, 2)}`, cls: 'rho1-line' }],
    marker: { x: at, y: majorityAccuracy(p, at), label: `M = ${at} · ${f(majorityAccuracy(p, at), 3)}` },
  };
}

/** Derives the view (bag, curve, regions, charts, strip) for step `index` with parameters `p`. */
export function deriveBaggingView(index: number, p: BaggingParams): BaggingView {
  const stepId = baggingScenario.steps[Math.max(0, Math.min(baggingScenario.steps.length - 1, index))].id;
  const n = Math.max(1, Math.round(p.n));
  const sample = drawsFor(n, p.draw);
  const shown = Math.max(0, Math.min(n, Math.round(p.shown)));
  const ids = Array.from({ length: n }, (_, i) => i);
  const counts = ids.map((id) => sample.slice(0, shown).filter((d) => d === id).length);
  const tally = stepId === 'oob';
  const oob = tally ? ids.filter((id) => counts[id] === 0) : [];
  const badges = tally ? ids.filter((id) => counts[id] >= 2).map((id) => ({ id, count: counts[id] })) : [];

  const m = Math.max(1, Math.min(BOOTS.length, Math.round(p.trees)));
  const treeAt = Math.max(0, Math.min(BOOTS.length - 3, Math.round(p.tree) - 1));
  const picked = p.pick === null ? null : CUSTOMERS[p.pick];
  const pickYes = picked ? votes([picked.t, picked.c], m) : 0;
  const verdict = pickYes * 2 === m ? 'berabere' : majority(pickYes, m) === 1 ? 'Ayrıldı' : 'Kaldı';
  const trainOk = CUSTOMERS.filter((c) => predictTree(SINGLE, [c.t, c.c]) === c.y).length;
  const titles = [0, 1, 2].map((k) => rootLabel(BOOTS[treeAt + k].tree));
  const acc = majorityAccuracy(p.p, p.m);
  const tree = meanStd(EXPERIMENT.tree);
  const bagging = meanStd(EXPERIMENT.bagging);

  let strip = '';
  switch (stepId) {
    case 'torba':
      strip = `torba: ${n} müşteri · kimlikler 0–${n - 1} · her çekilişte bir kart seçilir`;
      break;
    case 'cekilis':
      strip = `çekilen: [${sample.slice(0, shown).join(' ')}] · ${shown} / ${n} çekiliş\nrng.choice(musteriKimlikleri, size=${n}, replace=True)`;
      break;
    case 'oob':
      strip = `OOB = ${oob.length} / ${n} = ${pct(oob.length / n)}`;
      break;
    case 'yuzde':
      strip = `(1 − 1/${n})${superscript(n)} = ${f(oobChance(n), 3)} · n → ∞: 1/e = ${f(1 / Math.E, 3)} · bootstrap verinin ≈ ${pct(1 - 1 / Math.E)} kadarını görür`;
      break;
    case 'tek-agac':
      strip = `eğitimde ${trainOk} / ${CUSTOMERS.length} doğru · ${leafCount(SINGLE)} yaprak · yanlılık düşük, varyans yüksek`;
      break;
    case 'uc-agac':
      strip = `kök bölünmeleri: ${titles.join(' · ')}`;
      break;
    case 'oylama':
      strip = picked
        ? `müşteri ${p.pick} · ${m} ağaçtan Ayrıldı oyu = ${pickYes} / ${m} → ${verdict === 'berabere' ? 'berabere → Kaldı' : `çoğunluk: ${verdict}`}`
        : `${m} ağaç oy veriyor · hücre tonu = Ayrıldı oy payı · koyu çizgi = çoğunluk sınırı`;
      break;
    case 'cogunluk': {
      const q = 1 - p.p;
      const head =
        p.m === 3
          ? `3 · ${trim(q, 2)}² · ${trim(p.p, 2)} + ${trim(q, 2)}³ = ${f(1 - acc, 3)} → doğruluk ${f(acc, 3)}`
          : `p = ${f(p.p, 2)} · M = ${p.m} → çoğunluk doğruluğu = ${f(acc, 3)} (yanlış ${f(1 - acc, 3)})`;
      strip = `${head}
ρ = 1 (aynı hatalar) → doğruluk değişmez: p = ${f(p.p, 2)}`;
      break;
    }
    case 'deney':
      strip = `tek ağaç: ortalama ${f(tree.mean, 3)}, std ${f(tree.std, 3)} · bagging: ortalama ${f(bagging.mean, 3)}, std ${f(bagging.std, 3)}\nBaggingClassifier(estimator=DecisionTreeClassifier(), n_estimators=50)`;
      break;
    case 'sinir':
      strip = 'aynı güçlü öznitelikler → benzer ağaçlar → ρ yüksek → oylama az kazandırır';
      break;
  }

  const regionLayout = { 'tek-agac': 'single', 'uc-agac': 'panels', oylama: 'vote' } as const;
  const chartKind = { cogunluk: 'majority', deney: 'experiment', sinir: 'limit' } as const;
  const layout = regionLayout[stepId as keyof typeof regionLayout];
  const kind = chartKind[stepId as keyof typeof chartKind];

  return {
    stepId,
    strip,
    bag: ['torba', 'cekilis', 'oob'].includes(stepId) ? { n, ids, sample, shown, counts, oob, badges } : null,
    curve: stepId === 'yuzde' ? curveSpec(p.n, p.avg) : null,
    regions: layout
      ? {
          layout,
          trees: layout === 'panels' ? [treeAt, treeAt + 1, treeAt + 2] : [],
          titles: layout === 'panels' ? titles : [],
          m,
          pick: layout === 'vote' && picked ? { index: p.pick as number, ayrildi: pickYes, m, verdict } : null,
        }
      : null,
    charts: kind
      ? {
          kind,
          question: 'Ağaçları birbirinden nasıl uzaklaştırırız?',
          majority: majoritySpec(p.p, p.m),
          experiment: [
            { id: 'tree', label: 'tek ağaç', values: EXPERIMENT.tree, ...tree },
            { id: 'bagging', label: `bagging (${BOOTS.length} ağaç)`, values: EXPERIMENT.bagging, ...bagging },
          ],
        }
      : null,
    links:
      stepId === 'sinir'
        ? [
            { href: '../random-forest/', label: 'Random Forest, OOB ve öznitelik önemi' },
            { href: '../karar-agaci/', label: 'Karar ağacı' },
          ]
        : [],
  };
}
