import type { Mode } from '../../core/mode';
import type { ViewScene } from './scene-base';
import type { FoldRow, LeakView } from './view';

/** Smallest share of a bar the validation part keeps, so its text fits. */
const MIN_VAL = '9em';

const div = (doc: Document, cls: string, text = ''): HTMLDivElement => {
  const d = doc.createElement('div');
  d.className = cls;
  d.textContent = text;
  return d;
};

const span = (doc: Document, cls: string, text = ''): HTMLSpanElement => {
  const s = doc.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
};

/** The parts of one drawn fold row. */
interface RowParts {
  row: HTMLDivElement;
  train: HTMLDivElement;
  val: HTMLDivElement;
  trainCounts: HTMLSpanElement;
  smoteCounts: HTMLSpanElement;
  valCounts: HTMLSpanElement;
  score: HTMLSpanElement;
}

/**
 * The fold area (step 6): five rows, each with the training part (width follows the training count; the
 * class counts before and after SMOTE), the untouched validation part and, at the right, the fold's PR-AUC.
 * In Ders the scores appear as the sweep passes the folds; in the Lab all of them stay and the chosen fold is
 * highlighted. Below: the mean and the book's Pipeline line.
 */
export class FoldsScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly rows: RowParts[] = [];
  private readonly mean: HTMLDivElement;
  private readonly book: HTMLElement;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = div(doc, 'fold-scene');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', '5 katlı çapraz doğrulama: her katta SMOTE yalnızca eğitim parçasında');
    for (let i = 0; i < 5; i++) {
      const row = div(doc, 'fold-row');
      row.dataset.fold = String(i + 1);
      const train = div(doc, 'fold-train');
      const val = div(doc, 'fold-val');
      const trainCounts = span(doc, 'fold-counts');
      const smoteCounts = span(doc, 'fold-counts fold-smote');
      const valCounts = span(doc, 'fold-counts');
      train.append(span(doc, 'fold-part', 'eğitim'), trainCounts, smoteCounts);
      val.append(span(doc, 'fold-part', 'dokunulmaz'), valCounts);
      const bar = div(doc, 'fold-bar');
      bar.append(train, val);
      const score = span(doc, 'fold-score');
      row.append(span(doc, 'fold-name', `kat ${i + 1}`), bar, score);
      this.root.append(row);
      this.rows.push({ row, train, val, trainCounts, smoteCounts, valCounts, score });
    }
    this.mean = div(doc, 'fold-mean');
    this.book = doc.createElement('code');
    this.book.className = 'fold-book';
    this.root.append(this.mean, this.book);
    host.append(this.root);
  }

  resize(_w: number, _h: number, mode: Mode): void {
    this.mode = mode;
  }

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: LeakView, _ms: number): void {
    const folds = v.folds;
    if (!folds) {
      return;
    }
    // the Lab keeps every score; Ders reveals them as the sweep passes (fold 0 = all)
    const reached = (r: FoldRow): boolean => this.mode === 'lab' || folds.selected === 0 || r.fold <= folds.selected;
    folds.rows.forEach((r, i) => {
      const p = this.rows[i];
      p.train.style.flex = `${r.trainNeg + r.trainPos} 1 0`;
      p.val.style.flex = `${r.valNeg + r.valPos} 1 ${MIN_VAL}`;
      p.trainCounts.textContent = `kalan ${r.trainNeg} / ayrılan ${r.trainPos}`;
      p.smoteCounts.textContent = `→ SMOTE sonrası ${r.smoteNeg} / ${r.smotePos}`;
      p.valCounts.textContent = `${r.valNeg} / ${r.valPos}`;
      p.row.classList.toggle('is-selected', r.fold === folds.selected);
      const shown = reached(r);
      p.score.textContent = shown ? r.ap : '';
      p.score.classList.toggle('is-shown', shown);
    });
    const all = this.mode === 'lab' || folds.selected === 0 || folds.selected >= folds.rows.length;
    this.mean.textContent = all ? `ortalama PR-AUC ${folds.mean}` : '';
    this.mean.classList.toggle('is-shown', all);
    this.book.textContent = folds.book;
  }
}
