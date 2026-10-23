import { formatNumber as f } from '../../core/plot/format';
import type { LineChartSpec } from '../../core/plot/line-chart';
import { BOOTS, CUSTOMERS, NODE_DEMO, RF } from '../topluluk/data';
import { ensembleVariance } from '../topluluk/math';
import { oobScore, oobVotes } from '../topluluk/vote';
import { predictTree } from '../topluluk/tree';
import {
  BAGGING_ROW,
  MATRIX_COLS,
  oobBreakdown,
  oobVerdict,
  randomForestScenario,
  rankDesc,
  rfRow,
  type RfParams,
} from './scenario';

/** The four view areas of the page; the last two are drawn by Task 6. */
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
  cells: { count: number; vote: 0 | 1 | null }[];
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

/** Everything the scene draws for one step and parameter set. */
export interface RfView {
  stepId: string;
  view: RfViewName;
  strip: string;
  roots: RootsView | null;
  oob: OobView | null;
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
    const cells = BOOTS.slice(0, MATRIX_COLS).map((b) => {
      const count = b.counts[i];
      return { count, vote: count === 0 ? predictTree(b.tree, [c.t, c.c]) : null };
    });
    const { ayrildi, kaldi } = oobVotes(i, m);
    const verdict = oobVerdict(ayrildi, kaldi);
    const v = verdict === null ? null : verdict === 'Ayrıldı' ? 1 : 0;
    return { index: i, y: c.y, cells, verdict: v, outcome: v === null ? 'none' : v === c.y ? 'right' : 'wrong' };
  });
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
    default:
      // steps 7-10 are drawn by the next task
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

  return { stepId, view, strip, roots, oob };
}
