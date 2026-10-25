import type { Mode } from '../../core/mode';
import { CodePanel, type CodeBug, type CodeLine } from '../../core/plot/code-panel';
import type { ViewScene } from './scene-base';
import type { LeakView } from './view';

/** The five bugs of the book's debugging exercise (its "Hata türleri" list, in the book's order). */
export const BUGS: readonly CodeBug[] = [
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
 * corrected code takes its place. The panel itself is the shared `CodePanel` (core/plot/code-panel.ts).
 */
export class CodeScene implements ViewScene {
  private readonly panel: CodePanel;

  constructor(host: HTMLElement) {
    this.panel = new CodePanel(host);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.panel.destroy();
  }

  update(v: LeakView, _ms: number): void {
    const code = v.code;
    if (!code) {
      return;
    }
    this.panel.update({ faulty: BUGGY_CODE, fixedLines: FIXED_CODE, bugs: BUGS, marked: code.bug, fixed: code.fixed });
  }
}
