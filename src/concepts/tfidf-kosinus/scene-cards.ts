import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { CardsView, TfidfView } from './view';

/**
 * Step 10: the "separate vocabularies" card (the two document texts, then their columns side by side) and the
 * "high similarity is not the same meaning" card, then the links.
 */
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
    const sep = c.separate;
    const card = el(doc, 'section', 'text-card');
    card.dataset.kind = 'ayri-sozluk';
    card.dataset.separate = String(sep.on);
    // the two texts the card compares (a Lab edit of the documents reaches them)
    const texts = el(doc, 'div', 'card-docs');
    sep.names.forEach((name, i) => {
      const line = el(doc, 'p', 'card-doc');
      line.append(el(doc, 'span', 'card-doc-name', name), ': ', el(doc, 'q', 'card-doc-text', sep.docs[i]));
      texts.append(line);
    });
    const pairs = el(doc, 'div', 'vocab-pairs');
    pairs.append(el(doc, 'span', 'vocab-head', 'sütun'), el(doc, 'span', 'vocab-head', sep.names[0]), el(doc, 'span', 'vocab-head', sep.names[1]));
    sep.pairs.forEach(([a, b], i) => {
      pairs.append(el(doc, 'span', 'vocab-no', String(i)), el(doc, 'code', 'vocab-term', a), el(doc, 'code', 'vocab-term', b));
    });
    const result = (cls: string, label: string, num: string, tail = ''): HTMLElement => {
      const p = el(doc, 'p', `card-result ${cls}`);
      p.append(label, el(doc, 'strong', 'card-num', num), tail);
      return p;
    };
    const wrong = result('is-wrong', 'Ayrı vektörleştirici, sütun sütuna kosinüs: ', sep.aligned, ' (anlamsız)');
    const right = result('is-right', 'Tek vektörleştirici, ortak sözlük: ', sep.shared);
    card.append(
      el(doc, 'h3', 'card-title', sep.on ? 'Her belge ayrı sözlük' : 'Ortak sözlük'),
      el(
        doc,
        'p',
        'card-text',
        sep.on
          ? 'İki ayrı vektörleştiricinin aynı numaralı sütunları farklı terimlerdir; karşılaştırma anlamsızdır. Doğrusu tek vektörleştirici.'
          : 'Tek vektörleştirici iki belge için de aynı sütunları kurar: her sütun her iki belgede aynı terimdir, kosinüs anlamlıdır.',
      ),
      texts,
      pairs,
      ...(sep.on ? [wrong, right] : [right]),
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
