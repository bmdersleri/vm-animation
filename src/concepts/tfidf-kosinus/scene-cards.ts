import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { CardsView, TfidfView } from './view';

/** Step 10: the "separate vocabularies" card and the "high similarity is not the same meaning" card, then the links. */
export class CardsScene implements ViewScene {
  private readonly root: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.root = el(host.ownerDocument, 'div', 'cards-scene');
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: TfidfView, _ms: number): void {
    const c = v.cards;
    if (!c) return;
    const doc = this.root.ownerDocument;
    const cards = el(doc, 'div', 'text-cards');
    cards.append(this.separateCard(doc, c), this.meaningCard(doc, c));
    const links = el(doc, 'nav', 'card-links');
    for (const l of c.links) {
      const a = el(doc, 'a', 'card-link', l.text);
      a.href = l.href;
      links.append(a);
    }
    this.root.replaceChildren(cards, links);
  }

  private separateCard(doc: Document, c: CardsView): HTMLElement {
    const card = el(doc, 'section', 'text-card');
    card.dataset.kind = 'ayri-sozluk';
    const pairs = el(doc, 'div', 'vocab-pairs');
    pairs.append(el(doc, 'span', 'vocab-head', 'sütun'), el(doc, 'span', 'vocab-head', 'belge 0'), el(doc, 'span', 'vocab-head', 'belge 2'));
    c.separate.pairs.forEach(([a, b], i) => {
      pairs.append(el(doc, 'span', 'vocab-no', String(i)), el(doc, 'code', 'vocab-term', a), el(doc, 'code', 'vocab-term', b));
    });
    const wrong = el(doc, 'p', 'card-result is-wrong');
    wrong.append('Ayrı vektörleştirici, sütun sütuna kosinüs: ', el(doc, 'strong', 'card-num', c.separate.aligned), ' (anlamsız)');
    const right = el(doc, 'p', 'card-result is-right');
    right.append('Tek vektörleştirici, ortak sözlük: ', el(doc, 'strong', 'card-num', c.separate.shared));
    card.append(
      el(doc, 'h3', 'card-title', 'Her belge ayrı sözlük'),
      el(doc, 'p', 'card-text', 'İki ayrı vektörleştiricinin aynı numaralı sütunları farklı terimlerdir; karşılaştırma anlamsızdır. Doğrusu tek vektörleştirici.'),
      pairs,
      wrong,
      right,
    );
    return card;
  }

  private meaningCard(doc: Document, c: CardsView): HTMLElement {
    const card = el(doc, 'section', 'text-card');
    card.dataset.kind = 'anlam';
    const pair = el(doc, 'div', 'pair-quotes');
    pair.append(el(doc, 'q', 'pair-quote', c.pair.a), el(doc, 'q', 'pair-quote', c.pair.b));
    const num = el(doc, 'p', 'card-result');
    num.append('Kosinüs: ', el(doc, 'strong', 'card-num', c.pair.cos), ' ama duygular zıt');
    card.append(
      el(doc, 'h3', 'card-title', 'Sık yanlış anlama'),
      el(doc, 'p', 'card-text', 'Yüksek benzerlik aynı anlam demek değildir: ortak kelimeler çok, duygu ters olabilir.'),
      pair,
      num,
    );
    return card;
  }
}
