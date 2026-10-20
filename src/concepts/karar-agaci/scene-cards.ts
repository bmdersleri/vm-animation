import { select } from 'd3-selection';
import 'd3-transition';
import { tr } from '../../core/plot/transition';
import { formatNumber } from '../../core/plot/format';
import type { CardView, TreeView } from './view';

/** Transition name of the bar fills (interrupted on every update). */
const T = 'cards';

/** Card score wording per gain label: "Gini 0,343 · azalma 0,116". */
const SCORE: Record<TreeView['gainLabel'], { measure: string; gain: string; unit: string }> = {
  'Gini azalması': { measure: 'Gini', gain: 'azalma', unit: '' },
  'bilgi kazancı (bit)': { measure: 'Entropi', gain: 'bilgi kazancı', unit: ' bit' },
};

/** Class names in index order (0 = teal ●, 1 = orange ▲): tennis in part 1, churn otherwise. */
const CLASSES: Record<'tennis' | 'churn', readonly [string, string]> = {
  tennis: ['evet', 'hayır'],
  churn: ['Kaldı', 'Ayrıldı'],
};

const pct = (x: number): string => `${Math.round(x * 1e6) / 1e4}%`;
const total = (c: readonly number[]): number => c[0] + c[1];

interface BranchEls { row: HTMLElement; label: HTMLElement; fill: HTMLElement; segs: [HTMLElement, HTMLElement]; count: HTMLElement }
interface CardEls { card: HTMLElement; title: HTMLElement; branches: BranchEls[]; measure: HTMLElement; sep: HTMLElement; gain: HTMLElement }

/**
 * Candidate cards and the formula strip: an absolutely positioned HTML layer
 * inside the decision-tree scene. Each card shows one candidate question with a
 * two-colour bar per branch (width = the branch's share of the card's samples)
 * and its weighted impurity and gain. The layer is hidden when the view has no
 * cards (part 2 outside step 8).
 */
export class CardsLayer {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly legend: [HTMLElement, HTMLElement];
  private readonly cardsEl: HTMLElement;
  private readonly strip: HTMLElement;
  private cards: CardEls[] = [];
  /** Titles and branch labels of the built cards; a change rebuilds them empty. */
  private key = '';

  constructor(host: HTMLElement) {
    this.doc = host.ownerDocument;
    this.root = this.el('div', 'cards-layer');
    this.root.hidden = true;
    const legendEl = this.el('p', 'cards-legend');
    this.legend = [this.el('span', 'key c0'), this.el('span', 'key c1')];
    legendEl.append(...this.legend);
    this.cardsEl = this.el('div', 'cards');
    this.strip = this.el('p', 'formula');
    this.strip.hidden = true;
    this.root.append(legendEl, this.cardsEl, this.strip);
    host.append(this.root);
  }

  /** Renders `v`; `ms` (already scaled) animates the bar fills, 0 jumps. */
  update(v: TreeView, ms: number): void {
    // cancel running fills first so rapid step changes end in the final state
    select(this.root).selectAll('.fill').interrupt(T);
    if (v.cards.length === 0) {
      this.root.hidden = true;
      this.key = ''; // shown again later: the cards fill afresh
      return;
    }
    this.root.hidden = false;

    const key = v.cards.map((c) => [c.title, ...c.branches.map((b) => b.label)].join('|')).join('||');
    if (key !== this.key) {
      this.build(v.cards);
      this.key = key;
    }

    const names = CLASSES[v.part === 1 ? 'tennis' : 'churn'];
    this.legend[0].textContent = `● ${names[0]}`;
    this.legend[1].textContent = `▲ ${names[1]}`;

    const score = SCORE[v.gainLabel];
    v.cards.forEach((c, i) => this.fillCard(this.cards[i], c, v.part === 3 ? c.title : `${c.title}?`, score, ms));

    this.strip.hidden = v.strip === null;
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

  private build(cards: CardView[]): void {
    this.cards = cards.map((c) => {
      const card = this.el('div', 'card');
      const title = this.el('h3', 'card-title');
      const branches = c.branches.map((): BranchEls => {
        const row = this.el('div', 'branch');
        const label = this.el('span', 'branch-label');
        const bar = this.el('div', 'bar');
        const fill = this.el('div', 'fill');
        fill.style.width = '0%';
        const segs: [HTMLElement, HTMLElement] = [this.el('div', 'seg c0'), this.el('div', 'seg c1')];
        fill.append(...segs);
        bar.append(fill);
        const count = this.el('span', 'branch-count');
        row.append(label, bar, count);
        return { row, label, fill, segs, count };
      });
      const scoreEl = this.el('p', 'card-score');
      const measure = this.el('span', 'measure');
      const sep = this.el('span', 'sep');
      const gain = this.el('span', 'gain');
      scoreEl.append(measure, sep, gain);
      card.append(title, ...branches.map((b) => b.row), scoreEl);
      return { card, title, branches, measure, sep, gain };
    });
    this.cardsEl.replaceChildren(...this.cards.map((c) => c.card));
  }

  private fillCard(els: CardEls, c: CardView, title: string, score: (typeof SCORE)[keyof typeof SCORE], ms: number): void {
    els.card.classList.toggle('win', c.win);
    els.card.classList.toggle('empty', !c.filled);
    els.title.textContent = title;
    const n = c.branches.reduce((s, b) => s + total(b.counts), 0);
    c.branches.forEach((b, j) => {
      const e = els.branches[j];
      const t = total(b.counts);
      e.label.textContent = b.label;
      e.count.textContent = c.filled ? `${b.counts[0]}/${b.counts[1]}` : '';
      e.row.classList.toggle('pure', c.win && t > 0 && (b.counts[0] === 0 || b.counts[1] === 0));
      e.segs.forEach((s, k) => { s.style.width = pct(t > 0 ? b.counts[k] / t : 0); });
      const w = pct(c.filled && n > 0 ? t / n : 0);
      if (e.fill.style.width !== w) tr(select(e.fill), T, ms).style('width', w);
    });
    els.measure.textContent = c.filled ? `${score.measure} ${formatNumber(c.impurity, 3)}` : '';
    els.sep.textContent = c.filled ? ' · ' : '';
    els.gain.textContent = c.filled ? `${score.gain} ${formatNumber(c.decrease, 3)}${score.unit}` : '';
  }
}
