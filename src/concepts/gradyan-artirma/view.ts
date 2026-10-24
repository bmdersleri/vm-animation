import { formatNumber as f } from '../../core/plot/format';
import { segmentsFrom, type StepSegment } from '../../core/plot/step-line';
import { REG } from '../boosting/data';
import { boostSegments, predictBoost, type BoostRun } from '../boosting/boost';
import { predictReg } from '../boosting/regtree';
import { gradyanArtirmaScenario, nuText, runFor, sub, thresholdsOf, type GbParams } from './scenario';

/** x axis shared by both panels. */
export const X_DOMAIN: [number, number] = [0, 10];

/** Rows of the book's error table. */
export const BOOK_ROWS = 5;

/** The book's hand example (gerçek, tahmin, düzeltme and ν are the book's own, not data of this page). */
const HAND = 'Kitabın elle örneği: [3; 5] gerçek · [2; 4] tahmin · [2; 0] düzeltme · ν = 0,1 → [2 + 0,1 · 2; 4 + 0,1 · 0] = [2,2; 4]';

/** One training or validation point. */
export interface GbPoint {
  x: number;
  y: number;
}

/** One row of the book's table: `text` is "Adım k: 0,2952" once the row is filled, else "Adım k: —". */
export interface BookRow {
  k: number;
  filled: boolean;
  text: string;
}

/** Everything the two-panel scene draws. */
export interface PanelView {
  points: GbPoint[];
  valPoints: GbPoint[];
  /** The generating curve sin x on the plotting grid (faint reference). */
  sin: GbPoint[];
  /** Total prediction F as a step function; null before F₀ is introduced. */
  f: StepSegment[] | null;
  /** The previous F (faint) when one step moved it; else null. */
  fPrev: StepSegment[] | null;
  /** Residuals at the training points (what the next tree fits); empty before they are introduced. */
  residuals: { x: number; r: number }[];
  /** The tree's correction h as a step function, or null. */
  h: StepSegment[] | null;
  /** Thresholds of h, sorted. */
  thresholds: number[];
  /** Y domains of the top and bottom panel. */
  yTop: [number, number];
  yBottom: [number, number];
  /** The book's error table (step 6 only). */
  table: BookRow[] | null;
}

/** Everything the scene draws for one step and parameter set. */
export interface GbView {
  stepId: string;
  kind: 'panels' | 'error' | 'compare';
  strip: string;
  panels: PanelView | null;
}

const SIN: GbPoint[] = Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i / 10) }));

const yTop: [number, number] = [
  Math.floor(Math.min(...REG.train.y, -1) * 2) / 2,
  Math.ceil(Math.max(...REG.train.y, 1) * 2) / 2,
];
const rBound = Math.ceil(Math.max(...REG.train.y.map((y) => Math.abs(y - REG.mean))) * 2) / 2;
const yBottom: [number, number] = [-rBound, rBound];

/** F after `m` trees as a step function over the x axis. */
function fSegments(run: BoostRun, nu: number, m: number): StepSegment[] {
  return boostSegments(run, nu, m, X_DOMAIN[0], X_DOMAIN[1]);
}

/** Residuals y − F after `m` trees at the training points. */
function residualsAfter(run: BoostRun, nu: number, m: number): { x: number; r: number }[] {
  return REG.train.x.map((x, i) => ({ x, r: REG.train.y[i] - predictBoost(run, nu, x, m) }));
}

/** Tree number `k` (0-based) as a step function, cut at its own thresholds. */
function treeSegments(run: BoostRun, k: number): StepSegment[] {
  return segmentsFrom(thresholdsOf(run, k), (x) => predictReg(run.trees[k], x), X_DOMAIN[0], X_DOMAIN[1]);
}

const pts = (d: { x: readonly number[]; y: readonly number[] }): GbPoint[] => d.x.map((x, i) => ({ x, y: d.y[i] }));

/** Mean square error of the constant F₀ on the training set. */
function meanSquare0(run: BoostRun): number {
  return REG.train.y.reduce((s, y) => s + (y - run.f0) ** 2, 0) / REG.train.y.length;
}

/** Trees in F per panel step: none until the first correction is applied. */
function treesIn(id: string, p: GbParams): number {
  if (id === 'kucuk-adim' || id === 'tekrar') return Math.max(1, Math.min(20, Math.round(p.m)));
  return 0;
}

function panelsFor(id: string, p: GbParams): { panels: PanelView; strip: string } {
  const run = runFor(p.nu, p.depth);
  const m = treesIn(id, p);
  const showResiduals = id !== 'veri' && id !== 'baslangic';
  const showH = id === 'ilk-agac' || m >= 1;
  // the tree fitted at this moment: the first one, or number m (1-based) of the loop
  const tree = Math.max(0, m - 1);
  const table: BookRow[] | null =
    id === 'tekrar'
      ? Array.from({ length: BOOK_ROWS }, (_, i) => {
          const k = i + 1;
          const filled = k <= m;
          return { k, filled, text: `Adım ${k}: ${filled ? f(run.trainMse[k - 1], 4) : '—'}` };
        })
      : null;
  const panels: PanelView = {
    points: pts(REG.train),
    valPoints: p.showVal ? pts(REG.val) : [],
    sin: SIN,
    f: id === 'veri' ? null : fSegments(run, p.nu, m),
    fPrev: id === 'kucuk-adim' ? fSegments(run, p.nu, 0) : null,
    residuals: showResiduals ? residualsAfter(run, p.nu, Math.max(0, m - 1)) : [],
    h: showH ? treeSegments(run, tree) : null,
    thresholds: showH ? thresholdsOf(run, tree) : [],
    yTop,
    yBottom,
    table,
  };
  const mse = (k: number): string => f(k === 0 ? meanSquare0(run) : run.trainMse[k - 1], 4);
  const nu = nuText(p.nu);
  let strip: string;
  switch (id) {
    case 'veri':
      strip = `y = sin x + gürültü · ${REG.train.x.length} eğitim noktası`;
      break;
    case 'baslangic':
      strip = `F${sub(0)} = ȳ = ${f(run.f0, 4)} · ortalama kare hata = ${mse(0)}`;
      break;
    case 'artik':
      strip = `r = y − F${sub(0)} · ortalama kare hata = ${mse(0)}`;
      break;
    case 'ilk-agac':
      strip = `h${sub(1)} = ağaç(r) · eşikler ${panels.thresholds.map((t) => f(t, 3)).join('; ')}\nsigAgac.fit(girisDegerleri, artikHata)`;
      break;
    case 'kucuk-adim':
      strip = `F${sub(m)} = F${sub(m - 1)} + ${nu} · h${sub(m)} · ortalama kare hata = ${mse(m)}\n${HAND}`;
      break;
    default:
      strip = `F${sub(m)} = F${sub(m - 1)} + ${nu} · h${sub(m)} · ortalama kare hata = ${mse(m)}`;
  }
  return { panels, strip };
}

/** Steps 7-10 belong to the next task's scenes; the view only names their kind and strip. */
function otherFor(id: string, p: GbParams): { kind: 'error' | 'compare'; strip: string } {
  if (id === 'bagging-karsi') {
    return { kind: 'compare', strip: 'bagging: bağımsız derin ağaçlar → varyans · boosting: sığ ağaçlar zinciri → yanlılık' };
  }
  const run = runFor(p.nu, p.depth);
  const k = Math.max(1, Math.min(run.trainMse.length, Math.round(p.trees)));
  return {
    kind: 'error',
    strip: `M = ${k} · eğitim hatası = ${f(run.trainMse[k - 1], 4)} · doğrulama hatası = ${f(run.valMse[k - 1], 4)}`,
  };
}

/** The view of step `index` for the parameters `p`. */
export function deriveGbView(index: number, p: GbParams): GbView {
  const id = gradyanArtirmaScenario.steps[index].id;
  if (id === 'durma' || id === 'ogrenme-orani' || id === 'ezber' || id === 'bagging-karsi') {
    const o = otherFor(id, p);
    return { stepId: id, kind: o.kind, strip: o.strip, panels: null };
  }
  const { panels, strip } = panelsFor(id, p);
  return { stepId: id, kind: 'panels', strip, panels };
}
