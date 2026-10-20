import { decrease, formulaText, weighted, type Counts, type Criterion } from './impurity';
import { ATTRS, candidates, winner } from './tennis';
import {
  accuracy, bestSplit, buildTree, forcedSplit, sweep, toSamples,
  type Split, type SweepPoint, type TreeNode,
} from './cart';
import { DOMAIN, test, train } from './data';
import { treeScenario, SCAN_N, type TreeParams } from './scenario';
import { formatNumber } from '../../core/plot/format';

/** 1 tennis (steps 0-5), 2 numeric (6-10), 3 book example (11). */
export type TreePart = 1 | 2 | 3;

export interface CardView {
  title: string;
  branches: { label: string; counts: Counts }[];
  impurity: number;
  decrease: number;
  filled: boolean;
  win: boolean;
}

export interface TreeView {
  part: TreePart;
  stepId: string;
  criterion: Criterion;
  /** Parts 1 and 3: the parent counts. */
  root: Counts;
  /** Part 1: 4 cards; part 2 step 8: 2 cards (best threshold per axis); part 3: 1 card. */
  cards: CardView[];
  /** Formula strip of the focused card, or null. */
  strip: string | null;
  gainLabel: 'Gini azalması' | 'bilgi kazancı (bit)';
  scanLine: { feature: 0 | 1; threshold: number } | null;
  curve: {
    feature: 0 | 1;
    points: SweepPoint[];
    upTo: number;
    best: SweepPoint;
    otherBest: SweepPoint | null;
  } | null;
  /** Part 2: the tree at the shown depth (a forced root with two leaves when userSplit is set). */
  tree: TreeNode | null;
  /** The tree's own root split (the faint line in Lab). */
  chosen: Split | null;
  acc: { train: number; test: number | null } | null;
  showTest: boolean;
}

const trainSamples = toSamples(train);
const testSamples = toSamples(test);
const AXIS_NAMES = ['Sözleşme', 'Şikâyet'] as const;
/** Book example in codebase order: index 0 = kaldı, index 1 = ayrıldı. */
const BOOK_ROOT: Counts = [60, 40];
const BOOK_KIDS: readonly [Counts, Counts] = [[15, 35], [45, 5]];

function partOf(index: number): TreePart {
  return index <= 5 ? 1 : index <= 10 ? 2 : 3;
}

/** First point with the lowest impurity (ties keep the earlier one). */
function lowest(points: SweepPoint[]): SweepPoint {
  return points.reduce((m, q) => (q.impurity < m.impurity - 1e-12 ? q : m));
}

const fmt = (x: number): string => formatNumber(x, Number.isInteger(x) ? 0 : 1);

function forcedTree(split: Split): TreeNode {
  const root = buildTree(trainSamples, 0, 'gini', DOMAIN);
  const axis = split.feature === 0 ? 'x' : 'y';
  const lbox = { x: [...root.box.x] as [number, number], y: [...root.box.y] as [number, number] };
  const rbox = { x: [...root.box.x] as [number, number], y: [...root.box.y] as [number, number] };
  lbox[axis][1] = split.threshold;
  rbox[axis][0] = split.threshold;
  const leaf = (counts: Counts, box: TreeNode['box']): TreeNode => ({
    counts, split: null, left: null, right: null, depth: 1, box,
  });
  return {
    counts: [split.left[0] + split.right[0], split.left[1] + split.right[1]],
    split, left: leaf(split.left, lbox), right: leaf(split.right, rbox), depth: 0, box: root.box,
  };
}

function card(title: string, branches: CardView['branches'], root: Counts, k: Criterion, win: boolean): CardView {
  const kids = branches.map((b) => b.counts);
  return { title, branches, impurity: weighted(kids, k), decrease: decrease(root, kids, k), filled: true, win };
}

export function deriveTreeView(index: number, p: TreeParams): TreeView {
  const part = partOf(index);
  const k = p.criterion;
  const base: TreeView = {
    part,
    stepId: treeScenario.steps[index].id,
    criterion: k,
    root: [0, 0],
    cards: [],
    strip: null,
    gainLabel: k === 'gini' ? 'Gini azalması' : 'bilgi kazancı (bit)',
    scanLine: null,
    curve: null,
    tree: null,
    chosen: null,
    acc: null,
    showTest: p.showTest,
  };

  if (part === 1) {
    const cs = candidates(k);
    const w = winner(cs);
    const decided = index >= 4;
    const cards: CardView[] = cs.map((c, i) => ({
      title: ATTRS[c.attr],
      branches: c.branches.map((b) => ({ label: b.value, counts: b.counts })),
      impurity: c.impurity,
      decrease: c.decrease,
      filled: i < p.shown,
      win: decided && i === w,
    }));
    const focus = index <= 1 ? -1 : decided ? w : p.shown - 1;
    return {
      ...base,
      root: [9, 5],
      cards,
      strip: focus >= 0 && cards[focus].filled
        ? formulaText(cards[focus].branches.map((b) => b.counts), k)
        : null,
    };
  }

  if (part === 3) {
    const c = card('Kitabın örneği', [
      { label: 'Kısa sözleşme', counts: BOOK_KIDS[0] },
      { label: 'Uzun sözleşme', counts: BOOK_KIDS[1] },
    ], BOOK_ROOT, k, true);
    return { ...base, root: BOOK_ROOT, cards: [c], strip: formulaText(BOOK_KIDS, k) };
  }

  // Part 2: numeric data.
  const root: Counts = buildTree(trainSamples, 0, k, DOMAIN).counts;
  const chosen = bestSplit(trainSamples, k);
  const tree = p.userSplit
    ? forcedTree(forcedSplit(trainSamples, p.userSplit.feature, p.userSplit.threshold, k))
    : buildTree(trainSamples, p.depth, k, DOMAIN);
  const view: TreeView = {
    ...base,
    root,
    chosen,
    tree,
    acc: {
      train: accuracy(tree, trainSamples),
      test: p.showTest ? accuracy(tree, testSamples) : null,
    },
  };

  if (p.scan >= 0) {
    const scan = Math.min(p.scan, SCAN_N - 1);
    const pts0 = sweep(trainSamples, 0, k);
    const feature: 0 | 1 = scan < pts0.length ? 0 : 1;
    const points = feature === 0 ? pts0 : sweep(trainSamples, 1, k);
    const upTo = feature === 0 ? scan : scan - pts0.length;
    view.scanLine = { feature, threshold: points[upTo].threshold };
    view.curve = { feature, points, upTo, best: lowest(points), otherBest: feature === 1 ? lowest(pts0) : null };
  }

  if (index === 8 && chosen) {
    view.cards = ([0, 1] as const).map((f) => {
      const t = lowest(sweep(trainSamples, f, k)).threshold;
      const s = forcedSplit(trainSamples, f, t, k);
      const c = card(`${AXIS_NAMES[f]} ≤ ${fmt(t)}`, [
        { label: `≤ ${fmt(t)}`, counts: s.left },
        { label: `> ${fmt(t)}`, counts: s.right },
      ], root, k, f === chosen.feature);
      return c;
    });
    const w = view.cards.find((c) => c.win);
    view.strip = w ? formulaText(w.branches.map((b) => b.counts), k) : null;
  }
  return view;
}
