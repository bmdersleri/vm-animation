import { formatNumber as f } from '../../core/plot/format';
import type { LineChartSpec } from '../../core/plot/line-chart';
import { BOOTS, CUSTOMERS, NODE_DEMO, OOB_CURVE, OOB_CV, RF } from '../topluluk/data';
import { ensembleVariance } from '../topluluk/math';
import { oobScore, oobVotes } from '../topluluk/vote';
import { predictTree } from '../topluluk/tree';
import {
  BAGGING_ROW,
  CAUSAL,
  MATRIX_COLS,
  oobBreakdown,
  oobVerdict,
  randomForestScenario,
  rankDesc,
  rfRow,
  type RfParams,
} from './scenario';

/** The four view areas of the page. */
export type RfViewName = 'roots' | 'oob' | 'curves' | 'importance';

/** Roots scene data (steps 1-4): bars, the node card, and the chart of steps 3-4. */
export interface RootsView {
  kind: 'bars' | 'variance' | 'sweep';
  names: string[];
  /** Root counts of bagging (max_features 8); null where the scene does not show them. */
  bagging: number[] | null;
  /** Root counts of the forest at the chosen max_features; null in step 1. */
  forest: number[] | null;
  /** Legend / bar-group labels. */
  baggingLabel: string;
  forestLabel: string;
  /** Common bar-length domain (largest root count over every max_features). */
  maxCount: number;
  /** Step 2 node card: 8 chips, the drawn pair and the winner (feature indices). */
  card: { names: string[]; drawn: number[]; winner: number; note: string; title: string } | null;
  chart: LineChartSpec | null;
  legend: { cls: string; label: string }[];
}

/** One row of the OOB matrix: a customer and the cells of its first tree columns. */
export interface OobRow {
  index: number;
  /** True class (1 = Ayrıldı). */
  y: 0 | 1;
  /** Per tree column: times drawn (0 = OOB) and, for an OOB cell, that tree's vote. */
  cells: { count: number; vote: 0 | 1 | null; voting: boolean }[];
  /** OOB majority over all `m` voting trees, or null when none of them left the customer out. */
  verdict: 0 | 1 | null;
  /** Correct (✓), wrong (✗) or no OOB vote at all. */
  outcome: 'right' | 'wrong' | 'none';
}

/** OOB matrix data (steps 5-6). */
export interface OobView {
  /** Voting trees (the columns show the first MATRIX_COLS of them). */
  m: number;
  cols: number;
  rows: OobRow[];
  pick: number | null;
  /** Step 5: how many trees left the picked customer out and what they said. */
  breakdown: { k: number; ayrildi: number; kaldi: number; verdict: 'Ayrıldı' | 'Kaldı' | null } | null;
  /** Step 6: the OOB score over the customers that have an OOB vote. */
  score: { correct: number; total: number } | null;
}

/** Curve scene data (steps 7-8): OOB beside CV, or the OOB - tree count line chart. */
export interface CurvesView {
  kind: 'compare' | 'curve';
  /** Step 7: the two bars (value in 0..1), the CV folds and the time sentence. */
  compare: {
    bars: { id: 'oob' | 'cv'; label: string; value: number; text: string }[];
    folds: number[];
    sentence: string;
  } | null;
  /** Step 8: the line chart. */
  chart: LineChartSpec | null;
}

/** One bar of the importance scene. */
export interface ImportanceRow {
  name: string;
  value: number;
  /** The meaningless id column. */
  isId: boolean;
}

/** One column of importance bars, sorted largest first. */
export interface ImportanceColumn {
  id: 'mdi' | 'perm';
  title: string;
  rows: ImportanceRow[];
  /** The method the toggle picked (step 10); the other column is muted. */
  active: boolean;
  /** Step 9: the sum line, e.g. "toplam 1,000". */
  total: string | null;
}

/** Importance scene data (steps 9-10). */
export interface ImportanceView {
  kind: 'single' | 'double';
  columns: ImportanceColumn[];
  /** Step 10: the causality sentence and the links. */
  causal: string | null;
  links: { href: string; label: string }[];
  /** Largest value of every column, so both columns share one bar scale. */
  max: number;
}

/** Everything the scene draws for one step and parameter set. */
export interface RfView {
  stepId: string;
  view: RfViewName;
  strip: string;
  roots: RootsView | null;
  oob: OobView | null;
  curves: CurvesView | null;
  importance: ImportanceView | null;
}

/** Trees of the variance curves: M = 1..250. */
const M_MAX = BAGGING_ROW.roots.reduce((s, x) => s + x, 0);
const MAX_COUNT = Math.max(...RF.byMf.flatMap((r) => r.roots));
const mfLabel = (mf: number): string => `max_features = ${mf}`;

/** Variance of the mean of M trees for correlation rho and sigma² = 1, M = 1..250. */
function varianceSeries(rho: number): [number, number][] {
  return Array.from({ length: M_MAX }, (_, i) => [i + 1, ensembleVariance(rho, 1, i + 1)] as [number, number]);
}

/** Step 3: bagging and Random Forest variance curves with their ρσ² floors and the marked M. */
function varianceSpec(rho: number, m: number): LineChartSpec {
  const at = Math.max(1, Math.min(M_MAX, Math.round(m)));
  return {
    x: [1, M_MAX],
    y: [0, 1],
    xTitle: 'M (ağaç sayısı)',
    yTitle: 'topluluk varyansı (σ² = 1)',
    series: [
      { id: 'bagging', cls: 'var-bagging', pts: varianceSeries(BAGGING_ROW.rho) },
      { id: 'forest', cls: 'var-forest', pts: varianceSeries(rho) },
    ],
    refs: [
      { y: BAGGING_ROW.rho, label: `bagging ρσ² = ${f(BAGGING_ROW.rho, 3)}`, cls: 'floor-bagging' },
      { y: rho, label: `Random Forest ρσ² = ${f(rho, 3)}`, cls: 'floor-forest' },
    ],
    marker: { x: at, y: ensembleVariance(rho, 1, at), label: `M = ${at} · ${f(ensembleVariance(rho, 1, at), 3)}` },
  };
}

/** Step 4: ρ, a single tree's accuracy and the forest's test accuracy for max_features 1-8, the marked value on ρ. */
function sweepSpec(mf: number): LineChartSpec {
  const row = rfRow(mf);
  const pts = (pick: (r: (typeof RF.byMf)[number]) => number): [number, number][] =>
    RF.byMf.map((r) => [r.mf, pick(r)] as [number, number]);
  return {
    x: [1, RF.byMf.length],
    y: [0.3, 1],
    xTicks: RF.byMf.map((r) => r.mf),
    xTitle: 'max_features',
    yTitle: 'ρ ve doğruluk',
    series: [
      { id: 'rho', cls: 'sweep-rho', pts: pts((r) => r.rho) },
      { id: 'tree', cls: 'sweep-tree', pts: pts((r) => r.treeAcc), dash: '7 5' },
      { id: 'test', cls: 'sweep-test', pts: pts((r) => r.test) },
    ],
    marker: { x: row.mf, y: row.rho, label: `${mfLabel(row.mf)} · ρ ${f(row.rho, 3)}` },
  };
}

/** Rows of the OOB matrix for the first `m` trees. */
function oobRows(m: number): OobRow[] {
  return CUSTOMERS.map((c, i) => {
    // columns beyond the `m` voting trees stay in place (stable layout) but cast no vote
    const cells = BOOTS.slice(0, MATRIX_COLS).map((b, k) => {
      const count = b.counts[i];
      const voting = k < m;
      return { count, vote: voting && count === 0 ? predictTree(b.tree, [c.t, c.c]) : null, voting };
    });
    const { ayrildi, kaldi } = oobVotes(i, m);
    const verdict = oobVerdict(ayrildi, kaldi);
    const v = verdict === null ? null : verdict === 'Ayrıldı' ? 1 : 0;
    return { index: i, y: c.y, cells, verdict: v, outcome: v === null ? 'none' : v === c.y ? 'right' : 'wrong' };
  });
}

/** The OOB - tree count curve point nearest to `n` trees. */
function curveAt(n: number): { n: number; oob: number } {
  return OOB_CURVE.reduce((a, b) => (Math.abs(b.n - n) < Math.abs(a.n - n) ? b : a));
}

/** Step 8: OOB score against tree count, the first value pinned and the chosen tree count marked. */
function curveSpec(n: number): LineChartSpec {
  const first = OOB_CURVE[0];
  const last = OOB_CURVE[OOB_CURVE.length - 1];
  const at = curveAt(n);
  const lo = Math.floor((Math.min(...OOB_CURVE.map((p) => p.oob)) - 0.01) * 20) / 20;
  const hi = Math.ceil((Math.max(...OOB_CURVE.map((p) => p.oob)) + 0.005) * 20) / 20;
  const label = (p: { n: number; oob: number }): string => `${p.n} ağaç · ${f(p.oob, 3)}`;
  return {
    x: [first.n, last.n],
    y: [lo, hi],
    xTitle: 'ağaç sayısı',
    yTitle: 'OOB skoru',
    series: [{ id: 'oob', cls: 'oob-curve', pts: OOB_CURVE.map((p) => [p.n, p.oob] as [number, number]) }],
    pins: at.n === first.n ? [] : [{ x: first.n, y: first.oob, label: label(first) }],
    marker: { x: at.n, y: at.oob, label: label(at) },
  };
}

/** Sorted importance rows of a (names, values) pair; the id column is flagged. */
function importanceRows(names: readonly string[], values: readonly number[]): ImportanceRow[] {
  return rankDesc(values).map((i) => ({ name: names[i], value: values[i], isId: names[i] === ID_NAME }));
}

const ID_NAME = RF.withId.names[RF.withId.names.length - 1];
const cvMean = OOB_CV.cv.reduce((a, x) => a + x, 0) / OOB_CV.cv.length;

/** Importance scene data: step 9 one MDI column (the book's model, or the split model with the id column), step 10 both columns. */
function importanceView(stepId: string, p: RfParams): ImportanceView | null {
  if (stepId === 'onem') {
    const names = p.withId ? RF.withId.names : RF.names;
    const mdi = p.withId ? RF.withId.mdi : RF.mdi;
    return {
      kind: 'single',
      columns: [
        {
          id: 'mdi',
          title: p.withId ? 'MDI (musteriNo eklenmiş model)' : 'MDI (ortalama Gini azalımı)',
          rows: importanceRows(names, mdi),
          active: true,
          total: `toplam ${f(mdi.reduce((a, x) => a + x, 0), 3)}`,
        },
      ],
      causal: null,
      links: [],
      max: Math.max(...mdi),
    };
  }
  if (stepId !== 'tuzak') return null;
  const names = RF.withId.names;
  return {
    kind: 'double',
    columns: [
      { id: 'mdi', title: 'MDI', rows: importanceRows(names, RF.withId.mdi), active: p.method === 'mdi', total: null },
      { id: 'perm', title: 'permütasyon (test kümesi)', rows: importanceRows(names, RF.withId.perm), active: p.method === 'perm', total: null },
    ],
    causal: CAUSAL,
    links: [
      { href: '../bagging/', label: 'Bootstrap ve bagging' },
      { href: '../ozellik-secimi/', label: 'Bölüm 4 · Özellik seçimi' },
    ],
    max: Math.max(...RF.withId.mdi, ...RF.withId.perm),
  };
}

/** Derives the view (roots scene, OOB matrix, strip) for step `index` with parameters `p`. */
export function deriveRfView(index: number, p: RfParams): RfView {
  const steps = randomForestScenario.steps;
  const stepId = steps[Math.max(0, Math.min(steps.length - 1, index))].id;
  const mf = Math.max(1, Math.min(RF.byMf.length, Math.round(p.maxFeatures)));
  const row = rfRow(mf);
  const bag = BAGGING_ROW;
  const trees = Math.max(1, Math.min(BOOTS.length, Math.round(p.trees)));
  const m = stepId === 'oob-matris' ? Math.min(MATRIX_COLS, trees) : trees;
  const top2 = (xs: readonly number[]): string => {
    const [a, b] = rankDesc(xs);
    return `${RF.names[a]} ${xs[a]} · ${RF.names[b]} ${xs[b]} → ikisi ${xs[a] + xs[b]} / ${M_MAX}`;
  };
  const variance = (rho: number): number => ensembleVariance(rho, 1, Math.max(1, Math.min(M_MAX, Math.round(p.trees))));

  let strip = '';
  switch (stepId) {
    case 'kokler':
      strip = `${M_MAX} ağaç · ${mfLabel(RF.names.length)} (hepsi aday) · kökler: ${top2(bag.roots)}`;
      break;
    case 'alt-kume':
      strip = `RandomForestClassifier(max_features=${mf === 2 ? '"sqrt"' : mf}) · ${mfLabel(mf)} · kökler: ${top2(row.roots)}`;
      break;
    case 'varyans':
      strip = `topluluk varyansı = ρσ² + (1 − ρ)σ²/M\nM = ${Math.round(p.trees)} · bagging ρ = ${f(bag.rho, 3)} → ${f(variance(bag.rho), 3)} · Random Forest ρ = ${f(p.rho, 3)} → ${f(variance(p.rho), 3)}`;
      break;
    case 'max-features':
      strip = `${mfLabel(mf)} · ρ = ${f(row.rho, 3)} · tek ağaç ${f(row.treeAcc, 3)} · topluluk test ${f(row.test, 3)} · OOB ${f(row.oob, 3)}`;
      break;
    case 'oob-matris': {
      const b = p.pick === null ? null : oobBreakdown(p.pick, m);
      strip = b ? `müşteri ${p.pick} · ${b.text}` : `${m} ağaç oy veriyor · dolu hücre = ağaç müşteriyi gördü · kesikli = OOB (ağacın oyu)`;
      break;
    }
    case 'oob-skor': {
      const s = oobScore(m);
      strip = `OOB skoru = ${s.correct} / ${s.total} = ${f(s.correct / s.total, 3)}\nRandomForestClassifier(oob_score=True) · ${m} ağaç · ayrı test kümesi yok`;
      break;
    }
    case 'oob-cv':
      strip = `RandomForestClassifier(oob_score=True) → rf.oob_score_
OOB ${f(OOB_CV.oob, 3)} · ${OOB_CV.cv.length} katlı CV ortalaması ${f(cvMean, 3)}`;
      break;
    case 'agac-sayisi': {
      const at = curveAt(p.nEstimators);
      strip = `RandomForestClassifier(n_estimators=${at.n}, oob_score=True)
${at.n} ağaçta OOB skoru ${f(at.oob, 3)}`;
      break;
    }
    case 'onem': {
      const names = p.withId ? RF.withId.names : RF.names;
      const mdi = p.withId ? RF.withId.mdi : RF.mdi;
      const top = rankDesc(mdi)[0];
      strip = `rf.feature_importances_ (MDI)
${names.length} öznitelik · en önemlisi ${names[top]} ${f(mdi[top], 3)} · toplam ${f(mdi.reduce((a, x) => a + x, 0), 3)}`;
      break;
    }
    case 'tuzak': {
      const idAt = RF.withId.names.indexOf(ID_NAME);
      const rank = (vals: readonly number[]): string => `sıra ${rankDesc(vals).indexOf(idAt) + 1} / ${vals.length}`;
      const permTopName = RF.withId.names[rankDesc(RF.withId.perm)[0]];
      strip = `rf.feature_importances_ (MDI) · permutation_importance (test kümesi)
${ID_NAME}: MDI ${f(RF.withId.mdi[idAt], 3)} (${rank(RF.withId.mdi)}) · permütasyon ${f(RF.withId.perm[idAt], 3)} (${rank(RF.withId.perm)}) · permütasyonda birinci ${permTopName}`;
      break;
    }
    default:
      strip = '';
  }

  const oobStep = stepId === 'oob-matris' || stepId === 'oob-skor';
  const rootsStep = ['kokler', 'alt-kume', 'varyans', 'max-features'].includes(stepId);
  const view: RfViewName = rootsStep
    ? 'roots'
    : oobStep
      ? 'oob'
      : stepId === 'oob-cv' || stepId === 'agac-sayisi'
        ? 'curves'
        : 'importance';

  const roots: RootsView | null = rootsStep
    ? {
        kind: stepId === 'varyans' ? 'variance' : stepId === 'max-features' ? 'sweep' : 'bars',
        names: [...RF.names],
        bagging: stepId === 'kokler' || stepId === 'alt-kume' ? [...bag.roots] : null,
        forest: stepId === 'alt-kume' ? [...row.roots] : null,
        baggingLabel: `bagging (${mfLabel(RF.names.length)})`,
        forestLabel: `Random Forest (${mfLabel(mf)})`,
        maxCount: MAX_COUNT,
        card:
          stepId === 'alt-kume'
            ? {
                names: [...RF.names],
                drawn: [...NODE_DEMO.drawn],
                winner: NODE_DEMO.winner,
                title: `bir düğüm: ${RF.names.length} öznitelikten ${NODE_DEMO.drawn.length} tanesi aday`,
                note: 'Çekilen çift sabit bir örnek (üretici seçti); gerçekte her düğümde yeniden çekilir.',
              }
            : null,
        chart: stepId === 'varyans' ? varianceSpec(p.rho, p.trees) : stepId === 'max-features' ? sweepSpec(mf) : null,
        legend:
          stepId === 'kokler'
            ? [{ cls: 'bagging', label: `bagging (${mfLabel(RF.names.length)})` }]
            : stepId === 'alt-kume'
            ? [
                { cls: 'bagging', label: `bagging (${mfLabel(RF.names.length)})` },
                { cls: 'forest', label: `Random Forest (${mfLabel(mf)})` },
              ]
            : stepId === 'varyans'
              ? [
                  { cls: 'bagging', label: 'bagging' },
                  { cls: 'forest', label: 'Random Forest' },
                ]
              : stepId === 'max-features'
                ? [
                    { cls: 'rho', label: 'ρ (ağaçlar arası korelasyon)' },
                    { cls: 'tree', label: 'tek ağacın doğruluğu' },
                    { cls: 'test', label: 'topluluğun test doğruluğu' },
                  ]
                : [],
      }
    : null;

  const oob: OobView | null = oobStep
    ? {
        m,
        cols: MATRIX_COLS,
        rows: oobRows(m),
        pick: p.pick,
        breakdown: p.pick === null ? null : oobBreakdown(p.pick, m),
        score: stepId === 'oob-skor' ? oobScore(m) : null,
      }
    : null;

  const curves: CurvesView | null =
    stepId === 'oob-cv'
      ? {
          kind: 'compare',
          compare: {
            bars: [
              { id: 'oob', label: 'OOB skoru', value: OOB_CV.oob, text: f(OOB_CV.oob, 3) },
              { id: 'cv', label: `${OOB_CV.cv.length} katlı CV`, value: cvMean, text: f(cvMean, 3) },
            ],
            folds: [...OOB_CV.cv],
            sentence: `OOB modeli 1 kez eğitir: ${f(OOB_CV.seconds.oob, 2)} s · CV ${OOB_CV.cv.length} kez eğitir: ${f(OOB_CV.seconds.cv, 2)} s`,
          },
          chart: null,
        }
      : stepId === 'agac-sayisi'
        ? { kind: 'curve', compare: null, chart: curveSpec(p.nEstimators) }
        : null;

  const importance: ImportanceView | null = importanceView(stepId, p);

  return { stepId, view, strip, roots, oob, curves, importance };
}
