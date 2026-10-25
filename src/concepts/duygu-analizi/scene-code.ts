import type { Mode } from '../../core/mode';
import { CodePanel, type CodeBug, type CodeLine } from '../../core/plot/code-panel';
import { el, type ViewScene } from './scene-base';
import type { SentimentView } from './view';

/** The four bugs of the book's `DuyguHata` code, in the order the sweep marks them (kinds as the book's "Hata türleri" list). */
export const BUGS: readonly CodeBug[] = [
  { n: 1, kind: 'Mantık hatası', what: 'yorumlar liste yerine demet' },
  { n: 2, kind: 'Tür ve veri hatası', what: 'boş metinle fit_transform' },
  { n: 3, kind: 'Mantık hatası', what: 'olmayan satıra erişim (tek örnek var)' },
  { n: 4, kind: 'Tasarım hatası', what: 'stop-word listesi doğrulanmadan kullanılmış' },
];

/** The book's faulty `DuyguHata` code (the file header and the three "# Hata:" comment lines, which name the bugs, are left out). */
export const BUGGY_CODE: readonly CodeLine[] = [
  { text: 'from sklearn.feature_extraction.text import TfidfVectorizer', bugs: [] },
  { text: '', bugs: [] },
  { text: 'yorumlar = "internet kötü", "destek iyi"', bugs: [1] },
  { text: 'durak_kelimeler = ["ve", "ile"]', bugs: [4] },
  { text: 'vektorlestirici = TfidfVectorizer(stop_words=durak_kelimeler)', bugs: [] },
  { text: 'matris = vektorlestirici.fit_transform("")', bugs: [2] },
  { text: 'print(matris[2])', bugs: [3] },
  { text: '# Çıktı: Kod hata üretir.', bugs: [] },
];

/** The book's corrected code (`DuyguDuzeltildi`, file header left out). */
export const FIXED_CODE: readonly CodeLine[] = [
  { text: 'from sklearn.feature_extraction.text import TfidfVectorizer', bugs: [] },
  { text: '', bugs: [] },
  { text: '# Metinler açık bir liste içinde tutulur.', bugs: [] },
  { text: '# Vektörleştirici yalnızca anlamlı belge koleksiyonunda eğitilir.', bugs: [] },
  { text: '# Matris satırları geçerli indekslerle okunur.', bugs: [] },
  { text: 'yorumlar = ["internet kötü", "destek iyi"]', bugs: [], fix: true },
  { text: 'durak_kelimeler = {"ve", "ile"}', bugs: [], fix: true },
  { text: '', bugs: [] },
  { text: 'vektorlestirici = TfidfVectorizer(stop_words=list(durak_kelimeler))', bugs: [], fix: true },
  { text: 'matris = vektorlestirici.fit_transform(yorumlar)', bugs: [], fix: true },
  { text: '', bugs: [] },
  { text: 'print(matris[0].toarray())', bugs: [], fix: true },
  { text: '# Çıktı: İlk yorumun TF-IDF vektörü yazdırılır.', bugs: [] },
];

/**
 * Step 10: the book's debugging code as a shared `CodePanel` (numbered lines; the sweep marks the four bug
 * lines one by one with the bug's number and kind, then the corrected code takes over), the book's exam note
 * (`.exam-note`) and the links to the TF-IDF page and Chapter 11's SMOTE-leakage page (`.code-links`).
 */
export class DebugCodeScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly panel: CodePanel;
  private readonly note: HTMLParagraphElement;
  private readonly links: HTMLElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'debug-scene');
    this.panel = new CodePanel(this.root);
    this.note = el(doc, 'p', 'exam-note');
    this.links = el(doc, 'nav', 'code-links');
    this.root.append(this.note, this.links);
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.panel.destroy();
    this.root.remove();
  }

  update(v: SentimentView, _ms: number): void {
    const code = v.code;
    if (!code) return;
    const doc = this.root.ownerDocument;
    this.panel.update({ faulty: BUGGY_CODE, fixedLines: FIXED_CODE, bugs: BUGS, marked: code.marked, fixed: code.fixed });
    this.note.replaceChildren(el(doc, 'strong', 'exam-label', 'Sınav notu: '), code.exam);
    this.links.replaceChildren(
      ...code.links.map((l) => {
        const a = el(doc, 'a', 'card-link', l.text);
        a.href = l.href;
        return a;
      }),
    );
  }
}
