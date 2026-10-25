import { code, el, table } from './scene-base';
import type { CleanCard, CrispView, GoalCard, LeakCard, SummaryCard, TableCard } from './view';

/** Step 1: the three lines of the problem. */
export function introCard(doc: Document, lines: string[]): HTMLElement {
  const box = el(doc, 'div', 'intro-card');
  for (const line of lines) {
    box.append(el(doc, 'p', 'intro-line', line));
  }
  return box;
}

/** The book's `isHedefi` dictionary (keys in code font), the page's service row and, after the first decision, the new data question. */
export function goalCard(doc: Document, c: GoalCard): HTMLElement {
  const box = el(doc, 'div', 'goal-dict');
  for (const r of c.rows) {
    const row = el(doc, 'div', 'goal-row');
    row.append(code(doc, r.key, 'goal-key'), el(doc, 'span', 'goal-value', r.value));
    box.append(row);
  }
  box.append(el(doc, 'div', 'service-row', c.service));
  if (c.extra) {
    box.append(el(doc, 'div', 'goal-extra', c.extra));
  }
  return box;
}

/** A table of rows (the book's four records, or the test window); highlighted rows carry `highlightClass`. */
export function tableCard(doc: Document, c: TableCard, highlightClass: string): HTMLElement {
  const box = el(doc, 'div', 'table-card');
  const t = table(doc, 'cafe-table', c.columns, c.rows.map(r => r.cells));
  t.querySelectorAll('tbody tr').forEach((tr, i) => {
    if (c.rows[i].highlight) {
      tr.classList.add(highlightClass);
    }
  });
  box.append(t);
  if (c.note) {
    box.append(el(doc, 'p', 'table-note', c.note));
  }
  return box;
}

/** Day counts of the window and the answer of the first decision (✓ / ✗ with the word). */
export function summaryCard(doc: Document, c: SummaryCard): HTMLElement {
  const box = el(doc, 'div', 'data-summary');
  const list = el(doc, 'dl', 'summary-list');
  for (const item of c.items) {
    const row = el(doc, 'div', 'summary-item');
    const dt = el(doc, 'dt', 'summary-label', item.label);
    const dd = el(doc, 'dd', 'summary-value', item.value);
    row.append(dt, dd);
    list.append(row);
  }
  box.append(list);
  if (c.decision && c.enough !== null) {
    const d = el(doc, 'p', 'summary-decision', `Veri yeterli mi? ${c.enough ? '✓' : '✗'} ${c.decision}`);
    d.dataset.ok = String(c.enough);
    box.append(d);
  }
  if (c.note) {
    box.append(el(doc, 'p', 'summary-note', c.note));
  }
  return box;
}

function compare(doc: Document, group: string, label: string, m: { zero: string; skip: string }): HTMLElement {
  const row = el(doc, 'div', 'mean-compare');
  row.dataset.group = group;
  const zero = el(doc, 'span', 'mean-value', m.zero);
  zero.dataset.k = 'fill0';
  const skip = el(doc, 'span', 'mean-value', m.skip);
  skip.dataset.k = 'skip';
  row.append(
    el(doc, 'span', 'mean-label', label),
    el(doc, 'span', 'mean-cap', '0 ile doldur'),
    zero,
    el(doc, 'span', 'mean-cap', 'işaretle ve çıkar'),
    skip,
  );
  return row;
}

/** Book raw data before / after cleaning and the means with the missing values filled with 0 or skipped. */
export function cleanCard(doc: Document, c: CleanCard): HTMLElement {
  const box = el(doc, 'div', 'clean-card');
  box.append(
    table(doc, 'clean-table', ['önce: ürün', 'önce: satış', 'sonra: ürün', 'sonra: satış'], c.rows.map(r => [r.before.urun, r.before.satis, r.after.urun, r.after.satis])),
    compare(doc, 'kahve', 'Kahve ortalaması', c.kahve),
    compare(doc, 'normal', 'Normal gün ortalaması', c.normal),
    compare(doc, 'sinav', 'Sınav günü ortalaması', c.exam),
    el(doc, 'p', 'clean-count', `eksik kayıt: ${c.missing} (stok tükenen sınav gününde: ${c.missingOnExam})`),
    el(doc, 'p', 'clean-note', c.note),
  );
  return box;
}

function inputList(doc: Document, cls: string, title: string, names: string[]): HTMLElement {
  const box = el(doc, 'div', cls);
  box.append(el(doc, 'p', 'input-title', title));
  const ul = el(doc, 'ul', 'input-list');
  for (const n of names) {
    const li = doc.createElement('li');
    li.append(code(doc, n));
    ul.append(li);
  }
  box.append(ul);
  return box;
}

/** The book's daily record, the wrong and the right inputs and the coefficient of `ay_sonu_israfi` with and without the leak. */
export function leakCard(doc: Document, c: LeakCard): HTMLElement {
  const box = el(doc, 'div', 'leak-card');
  const rec = el(doc, 'dl', 'leak-record');
  for (const r of c.record) {
    const row = el(doc, 'div', 'record-row');
    row.dataset.input = String(r.input);
    const dt = el(doc, 'dt', 'record-name');
    dt.append(code(doc, r.name));
    row.append(dt, el(doc, 'dd', 'record-value', r.value), el(doc, 'dd', 'record-tag', r.input ? 'girdi' : 'girdi değil'));
    rec.append(row);
  }
  box.append(rec);
  const lists = el(doc, 'div', 'leak-lists');
  lists.append(inputList(doc, 'leak-wrong', 'yanlış girdiler', c.wrong), inputList(doc, 'leak-right', 'doğru girdiler', c.right));
  box.append(lists);
  const coefs = el(doc, 'div', 'leak-coefs');
  const on = el(doc, 'p', `leak-coef${c.active ? ' is-active' : ''}`);
  on.dataset.leak = 'on';
  on.append(el(doc, 'span', 'coef-title', 'sızıntılı model: '), code(doc, 'ay_sonu_israfi'), el(doc, 'span', 'coef-value', ` katsayısı ${c.coefficient}`));
  const off = el(doc, 'p', `leak-coef${c.active ? '' : ' is-active'}`);
  off.dataset.leak = 'off';
  off.append(el(doc, 'span', 'coef-title', 'sızıntısız model: '), code(doc, 'ay_sonu_israfi'), el(doc, 'span', 'coef-value', ' girdide değil'));
  coefs.append(on, off);
  box.append(coefs, el(doc, 'p', 'leak-note', c.note));
  return box;
}

/** The row class of a highlighted table row: the stocked-out record of step 3, the exam days of the test window. */
export const highlightOf = (v: CrispView): string => (v.stepId === 'degerlendirme' ? 'row-exam' : 'row-stockout');
