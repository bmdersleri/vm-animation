import {
  decrease, formulaText, impurity, rootFormula, weighted, type Counts, type Criterion,
} from './impurity';
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
  /** The title is a candidate question: the layer shows it with "?". */
  ask: boolean;
  /** Stable identity while the title changes (the Lab drag card); defaults to the title. */
  id?: string;
  branches: { label: string; counts: Counts }[];
  impurity: number;
  decrease: number;
  /** The book step: the same split under the other criterion. */
  alt?: { criterion: Criterion; impurity: number; decrease: number };
  filled: boolean;
  win: boolean;
}

/** The parent node above the cards: a two-colour bar and its impurity. */
export interface RootView {
  label: string;
  counts: Counts;
  /** The page's criterion first; the book step adds the other one. */
  measures: { criterion: Criterion; value: number }[];
}

export interface TreeView {
  part: TreePart;
  stepId: string;
  criterion: Criterion;
  /** Parts 1 and 3: the parent counts. */
  root: Counts;
  /** Parts 1 (from step 2 on) and 3: the root row shown above the cards. */
  rootRow: RootView | null;
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
/** Tennis root: 9 evet / 5 hayır. */
const TENNIS_ROOT: Counts = [9, 5];
/** Step index of the root's best-threshold race, and the last step a Lab drag can set userSplit. */
const ESIK_STEP = 8;
const LAST_DRAG_STEP = 8;
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

/** Accuracy as the lesson shows it: "%70" or "%83,3". */
export const pct = (x: number): string => `%${formatNumber(x * 100, 1)}`;

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

function card(title: string, branches: CardView['branches'], root: Counts, k: Criterion, win: boolean, ask = true): CardView {
  const kids = branches.map((b) => b.counts);
  return { title, ask, branches, impurity: weighted(kids, k), decrease: decrease(root, kids, k), filled: true, win };
}

/** A root split as a two-branch card: "≤ t" and "> t". */
function splitCard(title: string, s: Split, root: Counts, k: Criterion, win: boolean, ask: boolean): CardView {
  return card(title, [
    { label: `≤ ${fmt(s.threshold)}`, counts: s.left },
    { label: `> ${fmt(s.threshold)}`, counts: s.right },
  ], root, k, win, ask);
}

const other = (k: Criterion): Criterion => (k === 'gini' ? 'entropi' : 'gini');

export function deriveTreeView(index: number, p: TreeParams): TreeView {
  const part = partOf(index);
  const k = p.criterion;
  const base: TreeView = {
    part,
    stepId: treeScenario.steps[index].id,
    criterion: k,
    root: [0, 0],
    rootRow: null,
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
      ask: true,
      branches: c.branches.map((b) => ({ label: b.value, counts: b.counts })),
      impurity: c.impurity,
      decrease: c.decrease,
      filled: i < p.shown,
      win: decided && i === w,
    }));
    const focus = index <= 1 ? -1 : decided ? w : p.shown - 1;
    let strip: string | null = null;
    if (index === 1) strip = rootFormula(TENNIS_ROOT, k);
    else if (focus >= 0 && cards[focus].filled) strip = formulaText(cards[focus].branches.map((b) => b.counts), k);
    return {
      ...base,
      root: TENNIS_ROOT,
      rootRow: index >= 1
        ? { label: 'Kök: 14 gün', counts: TENNIS_ROOT, measures: [{ criterion: k, value: impurity(TENNIS_ROOT, k) }] }
        : null,
      cards,
      strip,
    };
  }

  if (part === 3) {
    const c = card('Kitabın örneği', [
      { label: 'Kısa sözleşme', counts: BOOK_KIDS[0] },
      { label: 'Uzun sözleşme', counts: BOOK_KIDS[1] },
    ], BOOK_ROOT, k, true, false);
    const k2 = other(k);
    c.alt = { criterion: k2, impurity: weighted(BOOK_KIDS, k2), decrease: decrease(BOOK_ROOT, BOOK_KIDS, k2) };
    return {
      ...base,
      root: BOOK_ROOT,
      rootRow: {
        label: 'Kök: 100 müşteri',
        counts: BOOK_ROOT,
        measures: [k, k2].map((criterion) => ({ criterion, value: impurity(BOOK_ROOT, criterion) })),
      },
      cards: [c],
      strip: formulaText(BOOK_KIDS, k),
    };
  }

  // Part 2: numeric data.
  const root: Counts = buildTree(trainSamples, 0, k, DOMAIN).counts;
  const chosen = bestSplit(trainSamples, k);
  const user = p.userSplit ? forcedSplit(trainSamples, p.userSplit.feature, p.userSplit.threshold, k) : null;
  const tree = user ? forcedTree(user) : buildTree(trainSamples, p.depth, k, DOMAIN);
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

  if (user && index <= LAST_DRAG_STEP && chosen) {
    // Lab drag: the student's split, live, beside the tree's own choice
    const own = splitCard(`Senin eşiğin: ${AXIS_NAMES[user.feature]} ≤ ${fmt(user.threshold)}`, user, root, k, false, false);
    const best = splitCard(`Ağacın seçimi: ${AXIS_NAMES[chosen.feature]} ≤ ${fmt(chosen.threshold)}`, chosen, root, k, true, false);
    view.cards = [{ ...own, id: 'user' }, { ...best, id: 'tree' }];
    view.strip = formulaText([user.left, user.right], k);
  } else if (index === ESIK_STEP && chosen) {
    view.cards = ([0, 1] as const).map((f) => {
      const s = forcedSplit(trainSamples, f, lowest(sweep(trainSamples, f, k)).threshold, k);
      return splitCard(`${AXIS_NAMES[f]} ≤ ${fmt(s.threshold)}`, s, root, k, f === chosen.feature, true);
    });
    const w = view.cards.find((c) => c.win);
    view.strip = w ? formulaText(w.branches.map((b) => b.counts), k) : null;
  }
  return view;
}
