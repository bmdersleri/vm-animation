import type { Mode } from '../../core/mode';
import type { ViewScene } from './scene-base';
import type { LeakView } from './view';

/** One numbered code line; `bugs` are the numbers of the bugs found on it. */
interface CodeLine {
  text: string;
  bugs: number[];
  /** True in the corrected code for the lines that changed. */
  fix?: boolean;
}

/** The five bugs of the book's debugging exercise (its "Hata türleri" list, in the book's order). */
export const BUGS: readonly { n: number; kind: string; what: string }[] = [
  { n: 1, kind: 'Mantık hatası', what: 'SMOTE, eğitim/test ayrımından önce uygulanmış' },
  { n: 2, kind: 'Mantık hatası', what: 'model test verisi üzerinde eğitilmiş' },
  { n: 3, kind: 'Değerlendirme hatası', what: 'yalnızca doğruluk raporlanmış' },
  { n: 4, kind: 'Tekrar üretilebilirlik hatası', what: 'random_state belirtilmemiş' },
  { n: 5, kind: 'İstatistiksel hata', what: 'bölmede stratify kullanılmamış' },
];

/** The book's faulty `ChurnDebug` code (the header comments left out). */
export const BUGGY_CODE: readonly CodeLine[] = [
  { text: 'from imblearn.over_sampling import SMOTE', bugs: [] },
  { text: 'from sklearn.model_selection import train_test_split', bugs: [] },
  { text: '', bugs: [] },
  { text: 'dengeli_ozellikler, dengeli_hedef = SMOTE().fit_resample(ozellikler, hedef)', bugs: [1] },
  { text: 'egitim_x, test_x, egitim_y, test_y = train_test_split(', bugs: [] },
  { text: '    dengeli_ozellikler, dengeli_hedef, test_size=0.3', bugs: [4, 5] },
  { text: ')', bugs: [] },
  { text: 'model = LogisticRegression().fit(test_x, test_y)', bugs: [2] },
  { text: 'print(model.score(test_x, test_y))', bugs: [3] },
];

/** The book's corrected code. */
export const FIXED_CODE: readonly CodeLine[] = [
  { text: 'from imblearn.over_sampling import SMOTE', bugs: [] },
  { text: 'from sklearn.linear_model import LogisticRegression', bugs: [] },
  { text: 'from sklearn.metrics import average_precision_score', bugs: [] },
  { text: 'from sklearn.model_selection import train_test_split', bugs: [] },
  { text: '', bugs: [] },
  { text: 'egitim_x, test_x, egitim_y, test_y = train_test_split(', bugs: [], fix: true },
  { text: '    ozellikler, hedef, test_size=0.3, stratify=hedef, random_state=42', bugs: [], fix: true },
  { text: ')', bugs: [] },
  { text: 'dengeli_egitim_x, dengeli_egitim_y = SMOTE(random_state=42).fit_resample(', bugs: [], fix: true },
  { text: '    egitim_x, egitim_y', bugs: [] },
  { text: ')', bugs: [] },
  { text: 'model = LogisticRegression(max_iter=1000, random_state=42).fit(', bugs: [], fix: true },
  { text: '    dengeli_egitim_x, dengeli_egitim_y', bugs: [] },
  { text: ')', bugs: [] },
  { text: 'print(average_precision_score(test_y, model.predict_proba(test_x)[:, 1]))', bugs: [] },
];

/**
 * The code area (step 9): the faulty code as numbered lines; the sweep marks the bug lines one by one with a
 * number and the bug's kind at the line's edge. Once all five are marked (or the Lab switch is on), the
 * corrected code takes its place.
 */
export class CodeScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly pre: HTMLPreElement;
  private lastKey = '';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'code-scene';
    this.title = doc.createElement('div');
    this.title.className = 'code-title';
    this.pre = doc.createElement('pre');
    this.pre.className = 'code-pre';
    this.root.append(this.title, this.pre);
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: LeakView, _ms: number): void {
    const code = v.code;
    if (!code) {
      return;
    }
    const key = `${code.fixed}|${code.bug}`;
    if (key === this.lastKey) {
      return;
    }
    this.lastKey = key;
    const doc = this.root.ownerDocument;
    this.title.textContent = code.fixed ? 'Düzeltilmiş kod' : 'Hatalı kod';
    this.pre.classList.toggle('code-fixed-pre', code.fixed);
    const lines = code.fixed ? FIXED_CODE : BUGGY_CODE;
    this.pre.replaceChildren(
      ...lines.map((line, i) => {
        const shown = line.bugs.filter((n) => n <= code.bug);
        const el = doc.createElement('span');
        const cls = ['code-line'];
        if (code.fixed) {
          cls.push('code-fixed');
          if (line.fix) cls.push('is-fix');
        } else if (shown.length > 0) {
          cls.push('is-bug');
          if (shown.includes(code.bug)) cls.push('is-current');
        }
        el.className = cls.join(' ');
        const no = doc.createElement('span');
        no.className = 'code-no';
        no.textContent = String(i + 1);
        const text = doc.createElement('span');
        text.className = 'code-text';
        text.textContent = line.text;
        el.append(no, text);
        if (!code.fixed) {
          for (const n of shown) {
            const b = BUGS[n - 1];
            const badge = doc.createElement('span');
            badge.className = 'bug-badge';
            badge.dataset.bug = String(n);
            badge.textContent = `${n} · ${b.kind}: ${b.what}`;
            el.append(badge);
          }
        }
        return el;
      }),
    );
  }
}
