import { select } from 'd3-selection';
import 'd3-transition';
import { tr } from '../../core/plot/transition';
import { formatNumber } from '../../core/plot/format';
import type { Criterion } from './impurity';
import type { CardView, RootView, TreeView } from './view';

/** Transition name of the bar fills (interrupted on every update). */
const T = 'cards';

type Score = { measure: string; gain: string; unit: string };
/** Card score wording per criterion: "Gini 0,343 · azalma 0,116". */
const SCORE: Record<Criterion, Score> = {
  gini: { measure: 'Gini', gain: 'azalma', unit: '' },
  entropi: { measure: 'Entropi', gain: 'bilgi kazancı', unit: ' bit' },
};

/** Class names in index order (0 = teal ●, 1 = orange ▲): tennis in part 1, churn otherwise. */
const CLASSES: Record<'tennis' | 'churn', readonly [string, string]> = {
  tennis: ['evet', 'hayır'],
  churn: ['Kaldı', 'Ayrıldı'],
};

/** The Lab drag cards ("user", "tree"): two cards of two branches, keyed as view.ts keys them. */
const DRAG_SHAPE: readonly number[] = [2, 2];
const DRAG_KEY = 'user||tree';

const pct = (x: number): string => `${Math.round(x * 1e6) / 1e4}%`;
const total = (c: readonly number[]): number => c[0] + c[1];
/** Writes text only when it changed: a drag frame leaves most of it as it was. */
const setText = (el: HTMLElement, t: string): void => {
  if (el.textContent !== t) el.textContent = t;
};
/** Branch counts as "kaldı/ayrıldı"; an empty branch says so. */
const countText = (c: readonly number[]): string => (total(c) === 0 ? '0 müşteri' : `${c[0]}/${c[1]}`);

interface BranchEls { row: HTMLElement; label: HTMLElement; fill: HTMLElement; segs: [HTMLElement, HTMLElement]; count: HTMLElement }
interface ScoreEls { line: HTMLElement; measure: HTMLElement; sep: HTMLElement; gain: HTMLElement }
interface CardEls { card: HTMLElement; title: HTMLElement; branches: BranchEls[]; score: ScoreEls; alt: ScoreEls }
interface RootEls { row: HTMLElement; label: HTMLElement; fill: HTMLElement; segs: [HTMLElement, HTMLElement]; count: HTMLElement; score: HTMLElement }

/**
 * Candidate cards and the formula strip: an absolutely positioned HTML layer
 * inside the decision-tree scene. A root row above the cards shows the parent
 * node (its two-colour bar and impurity). Each card shows one candidate
 * question with a two-colour bar per branch (width = the branch's share of the
 * card's samples) and its weighted impurity and gain. The layer is hidden when
 * the view has no cards (part 2 outside step 8 and the Lab drag).
 */
export class CardsLayer {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly legend: [HTMLElement, HTMLElement];
  private readonly rootEls: RootEls;
  private readonly cardsEl: HTMLElement;
  private readonly strip: HTMLElement;
  private cards: CardEls[] = [];
  /** Identities and branch labels of the built cards; a change rebuilds them empty. */
  private key = '';
  /** Text the strip shows (undefined: never filled). */
  private stripText: string | null | undefined;

  constructor(host: HTMLElement) {
    this.doc = host.ownerDocument;
    this.root = this.el('div', 'cards-layer');
    this.root.hidden = true;
    const legendEl = this.el('p', 'cards-legend');
    this.legend = [this.el('span', 'key c0'), this.el('span', 'key c1')];
    legendEl.append(...this.legend);
    this.rootEls = this.buildRoot();
    this.cardsEl = this.el('div', 'cards');
    this.strip = this.el('p', 'formula');
    this.strip.hidden = true;
    this.root.append(legendEl, this.rootEls.row, this.cardsEl, this.strip);
    host.append(this.root);
  }

  /**
   * Renders `v`; `ms` (already scaled) animates the bar fills, 0 jumps. With
   * `reserveDrag` and no cards in the view (Lab, before the first press) the two
   * drag cards are still built, hidden, so the first drag frame only fills them.
   */
  update(v: TreeView, ms: number, reserveDrag = false): void {
    // cancel running fills first so rapid step changes end in the final state
    select(this.root).selectAll('.fill').interrupt(T);
    if (v.cards.length === 0) {
      this.root.hidden = true;
      if (reserveDrag && this.key !== DRAG_KEY) {
        this.build(DRAG_SHAPE);
        this.key = DRAG_KEY;
      } else if (!reserveDrag) {
        this.key = ''; // shown again later: the cards fill afresh
      }
      this.fillRoot(null, 0);
      return;
    }
    this.root.hidden = false;

    // in the drag steps the candidate cards (step 9) and the drag cards share one set of nodes: the press reuses them
    const dragShaped = reserveDrag && v.cards.length === 2 && v.cards.every((c) => c.branches.length === 2);
    const key = dragShaped
      ? DRAG_KEY
      : v.cards.map((c) => [c.id ?? c.title, ...(c.id ? [] : c.branches.map((b) => b.label))].join('|')).join('||');
    if (key !== this.key) {
      this.build(v.cards.map((c) => c.branches.length));
      this.key = key;
    }

    const names = CLASSES[v.part === 1 ? 'tennis' : 'churn'];
    this.legend[0].textContent = `● ${names[0]}`;
    this.legend[1].textContent = `▲ ${names[1]}`;

    this.fillRoot(v.rootRow, ms);
    v.cards.forEach((c, i) => this.fillCard(this.cards[i], c, v.criterion, ms));

    this.strip.hidden = v.strip === null;
    // a drag frame usually leaves the counts, and so the strip, unchanged
    if (v.strip === this.stripText) return;
    this.stripText = v.strip;
    // one item per term so a long strip wraps between terms (flex-wrap), never inside one
    const terms = v.strip === null ? [] : v.strip.split(/(?= [+=] )/);
    this.strip.replaceChildren(...terms.map((t) => {
      const s = this.el('span', 'term');
      s.textContent = t;
      return s;
    }));
  }

  destroy(): void {
    select(this.root).selectAll('.fill').interrupt(T);
    this.root.remove();
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
    const e = this.doc.createElement(tag);
    e.className = cls;
    return e;
  }

  /** A bar whose fill holds the two class segments. */
  private bar(): { bar: HTMLElement; fill: HTMLElement; segs: [HTMLElement, HTMLElement] } {
    const bar = this.el('div', 'bar');
    const fill = this.el('div', 'fill');
    fill.style.width = '0%';
    const segs: [HTMLElement, HTMLElement] = [this.el('div', 'seg c0'), this.el('div', 'seg c1')];
    fill.append(...segs);
    bar.append(fill);
    return { bar, fill, segs };
  }

  private buildRoot(): RootEls {
    const row = this.el('div', 'root-row');
    row.hidden = true;
    const label = this.el('span', 'root-label');
    const { bar, fill, segs } = this.bar();
    const count = this.el('span', 'root-count');
    const score = this.el('span', 'root-score');
    row.append(label, bar, count, score);
    return { row, label, fill, segs, count, score };
  }

  private scoreLine(cls: string): ScoreEls {
    const line = this.el('p', cls);
    const measure = this.el('span', 'measure');
    const sep = this.el('span', 'sep');
    const gain = this.el('span', 'gain');
    line.append(measure, sep, gain);
    return { line, measure, sep, gain };
  }

  /** One card per entry, with that many branch rows. */
  private build(shapes: readonly number[]): void {
    this.cards = shapes.map((branchCount) => {
      const card = this.el('div', 'card');
      const title = this.el('h3', 'card-title');
      const branches = Array.from({ length: branchCount }, (): BranchEls => {
        const row = this.el('div', 'branch');
        const label = this.el('span', 'branch-label');
        const { bar, fill, segs } = this.bar();
        const count = this.el('span', 'branch-count');
        row.append(label, bar, count);
        return { row, label, fill, segs, count };
      });
      const score = this.scoreLine('card-score');
      const alt = this.scoreLine('card-score alt');
      alt.line.hidden = true;
      card.append(title, ...branches.map((b) => b.row), score.line, alt.line);
      return { card, title, branches, score, alt };
    });
    this.cardsEl.replaceChildren(...this.cards.map((c) => c.card));
  }

  private fillRoot(r: RootView | null, ms: number): void {
    const e = this.rootEls;
    e.row.hidden = r === null;
    if (r === null) {
      e.fill.style.width = '0%'; // shown again later: the bar fills afresh
      return;
    }
    const t = total(r.counts);
    setText(e.label, r.label);
    setText(e.count, countText(r.counts));
    e.segs.forEach((s, k) => { s.style.width = pct(t > 0 ? r.counts[k] / t : 0); });
    if (e.fill.style.width !== '100%') tr(select(e.fill), T, ms).style('width', '100%');
    setText(e.score, r.measures.map((m) => `${SCORE[m.criterion].measure} ${formatNumber(m.value, 3)}`).join(' · '));
  }

  private fillScore(els: ScoreEls, s: Score | null, impurity: number, decrease: number): void {
    setText(els.measure, s ? `${s.measure} ${formatNumber(impurity, 3)}` : '');
    setText(els.sep, s ? ' · ' : '');
    setText(els.gain, s ? `${s.gain} ${formatNumber(decrease, 3)}${s.unit}` : '');
  }

  private fillCard(els: CardEls, c: CardView, k: Criterion, ms: number): void {
    els.card.classList.toggle('win', c.win);
    els.card.classList.toggle('empty', !c.filled);
    setText(els.title, c.ask ? `${c.title}?` : c.title);
    const n = c.branches.reduce((s, b) => s + total(b.counts), 0);
    c.branches.forEach((b, j) => {
      const e = els.branches[j];
      const t = total(b.counts);
      setText(e.label, b.label);
      setText(e.count, c.filled ? countText(b.counts) : '');
      e.row.classList.toggle('pure', c.win && t > 0 && (b.counts[0] === 0 || b.counts[1] === 0));
      e.segs.forEach((s, i) => { s.style.width = pct(t > 0 ? b.counts[i] / t : 0); });
      const w = pct(c.filled && n > 0 ? t / n : 0);
      if (e.fill.style.width !== w) tr(select(e.fill), T, ms).style('width', w);
    });
    this.fillScore(els.score, c.filled ? SCORE[k] : null, c.impurity, c.decrease);
    els.alt.line.hidden = !c.alt;
    if (c.alt) this.fillScore(els.alt, SCORE[c.alt.criterion], c.alt.impurity, c.alt.decrease);
  }
}
