import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { DriftView, SentimentView, VocabView } from './view';

/**
 * Step 8: the vocabulary strip. Three counts (`.vocab-count[data-count=train|all|test-only]`), the terms that
 * occur only in the test comments (`.vocab-test-only`: with the leaky vectoriser they sit in the vocabulary
 * with their IDF `.vocab-idf`, with the clean one they are `.is-oov` and have none; at most 24 chips, then
 * `.vocab-more` "ve N terim daha"), and the two test accuracies (`.vocab-acc[data-model=leaky|clean]`, the
 * chosen one `.is-chosen`) with the one-sentence gap note (`.vocab-gap`).
 */
export class VocabScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly counts: HTMLUListElement;
  private readonly lead: HTMLParagraphElement;
  private readonly chips: HTMLDivElement;
  private readonly accs: HTMLDivElement;
  private readonly gap: HTMLParagraphElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'vocab-scene');
    this.counts = el(doc, 'ul', 'vocab-counts');
    this.lead = el(doc, 'p', 'vocab-lead');
    this.chips = el(doc, 'div', 'vocab-chips');
    this.accs = el(doc, 'div', 'vocab-accs');
    this.gap = el(doc, 'p', 'vocab-gap');
    this.root.append(el(doc, 'h3', 'panel-heading', 'Sözlük: yalnız eğitimden mi, tüm veriden mi?'), this.counts, this.lead, this.chips, this.accs, this.gap);
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: SentimentView, _ms: number): void {
    const vocab = v.vocab;
    if (!vocab) return;
    const doc = this.root.ownerDocument;
    this.root.dataset.leaky = String(vocab.leaky);
    this.root.dataset.model = vocab.model;
    this.counts.replaceChildren(
      ...(
        [
          ['train', 'eğitim sözlüğü', vocab.trainSize],
          ['all', 'tüm veride öğrenilen sözlük', vocab.allSize],
          ['test-only', 'yalnız testte geçen terim', vocab.testOnlyCount],
        ] as const
      ).map(([key, label, n]) => {
        const li = el(doc, 'li', 'vocab-count');
        li.dataset.count = key;
        li.append(el(doc, 'span', 'vocab-count-label', label), el(doc, 'strong', 'vocab-count-value', String(n)));
        return li;
      }),
    );
    this.lead.textContent = vocab.leaky
      ? 'Sızıntılı vektörleştirici testte geçen terimleri de öğrenir: bunlar sözlüğe girer ve IDF değeri alır.'
      : 'Sızıntısız vektörleştirici yalnız eğitimi görür: testte geçen bu terimler sözlük dışıdır, yok sayılır.';
    this.chips.replaceChildren(...this.chipsOf(vocab, doc), ...(vocab.more > 0 ? [el(doc, 'span', 'vocab-more', `ve ${vocab.more} terim daha`)] : []));
    this.accs.replaceChildren(
      this.acc(doc, 'leaky', 'sızıntılı', vocab.accuracy.leaky, vocab.leaky),
      this.acc(doc, 'clean', 'sızıntısız', vocab.accuracy.clean, !vocab.leaky),
    );
    this.gap.textContent = vocab.gap;
  }

  private chipsOf(vocab: VocabView, doc: Document): HTMLElement[] {
    return vocab.terms.map((t) => {
      const chip = el(doc, 'code', `vocab-test-only${t.idf === null ? ' is-oov' : ''}`);
      chip.dataset.term = t.term;
      chip.append(el(doc, 'span', 'vocab-term', t.term));
      if (t.idf !== null) chip.append(el(doc, 'small', 'vocab-idf', ` IDF ${t.idf}`));
      return chip;
    });
  }

  private acc(doc: Document, model: 'leaky' | 'clean', label: string, value: string, chosen: boolean): HTMLElement {
    const box = el(doc, 'div', `vocab-acc${chosen ? ' is-chosen' : ''}`);
    box.dataset.model = model;
    box.append(el(doc, 'span', 'vocab-acc-label', `${label} test doğruluğu`), el(doc, 'strong', 'vocab-acc-value', value));
    return box;
  }
}

/** Heights (px) the drift strip needs, so the score panel below it can be sized. */
export function driftHeight(tick: number): number {
  return Math.round(tick * 1.5 * 3 + 24);
}

/**
 * Step 9's strip above the score panel: the out-of-vocabulary token share of the model's own test comments and
 * of the new-period comments, one bar each (`.drift-row[data-row=test|new]`, bar width = the share).
 */
export class DriftStrip {
  readonly el: HTMLDivElement;
  private readonly title: HTMLParagraphElement;
  private readonly rows: HTMLDivElement;

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    this.el = el(doc, 'div', 'drift-strip');
    this.title = el(doc, 'p', 'drift-title');
    this.rows = el(doc, 'div', 'drift-rows');
    this.el.append(this.title, this.rows);
    this.el.hidden = true;
    parent.append(this.el);
  }

  destroy(): void {
    this.el.remove();
  }

  update(d: DriftView | null): void {
    this.el.hidden = d === null;
    if (!d) return;
    const doc = this.el.ownerDocument;
    this.title.textContent = d.title;
    this.rows.replaceChildren(
      ...d.rows.map((r) => {
        const row = el(doc, 'div', 'drift-row');
        row.dataset.row = r.id;
        const track = el(doc, 'span', 'drift-track');
        const bar = el(doc, 'span', 'drift-bar');
        bar.style.width = `${Math.max(0.5, Math.min(100, r.rate * 100)).toFixed(2)}%`;
        track.append(bar);
        row.append(
          el(doc, 'span', 'drift-label', r.label),
          track,
          el(doc, 'span', 'drift-value', `${r.rateText} (${r.oov} / ${r.tokens} token)`),
        );
        return row;
      }),
    );
  }
}
