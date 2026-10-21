import type { PlayerState, StepPlayer } from '../../core/player';
import { deriveOlcView, type TableView } from './view';
import type { OlcParams } from './scenario';

const TREE_NOTE = 'Ağaç tabanlı modeller (karar ağacı, Random Forest, XGBoost) her özelliği ayrı eşiklerle böldüğü için ölçeklemeye duyarlı değildir.';
const BOOK_ERRORS: readonly string[] = [
  'Test verisinde ölçekleyiciyi yeniden fit etmek: test kendi istatistiğini öğrenir; yalnızca transform kullanılmalı.',
  'Ayrımdan önce tüm veriyi ölçeklemek: test bilgisi eğitim istatistiklerine sızar.',
  'train_test_split’te stratify ve random_state vermemek: sonuç tekrarlanamaz, churn oranı bölünmede bozulabilir.',
];
const TREE_STEP = 7;
const FIRST_ERROR_STEP = 9;

/** Lab-only panel: customer table (steps 1-9), tree note (step 8), book errors (steps 10-13). Text only via textContent. */
export function mountOlcExtra(host: HTMLElement, p: StepPlayer<OlcParams>): void {
  const doc = host.ownerDocument;
  const cell = (tag: 'th' | 'td', text: string, cls?: string): HTMLTableCellElement => {
    const c = doc.createElement(tag);
    c.textContent = text;
    if (cls) c.className = cls;
    if (tag === 'th') c.scope = 'col';
    return c;
  };
  const row = (cells: HTMLTableCellElement[], cls?: string): HTMLTableRowElement => {
    const r = doc.createElement('tr');
    if (cls) r.className = cls;
    r.append(...cells);
    return r;
  };

  const wrap = doc.createElement('div');
  wrap.className = 'olc-extra';
  const tableWrap = doc.createElement('div');
  tableWrap.className = 'olc-table-wrap';
  const table = doc.createElement('table');
  table.className = 'cust-table';
  const thead = table.createTHead();
  const tbody = table.createTBody();
  tableWrap.append(table);
  const tree = doc.createElement('p');
  tree.className = 'tree-note';
  tree.textContent = TREE_NOTE;
  const errors = doc.createElement('ul');
  errors.className = 'book-errors';
  for (const t of BOOK_ERRORS) {
    const li = doc.createElement('li');
    li.textContent = t;
    errors.append(li);
  }
  wrap.append(tableWrap, tree, errors);
  host.append(wrap);

  const drawTable = (t: TableView): void => {
    const head = [cell('th', 'Müşteri'), cell('th', `Hizmet süresi (${t.unitName})`), cell('th', 'Aylık fatura (TL)')];
    if (t.scaled) head.push(cell('th', 'z süre', 'z'), cell('th', 'z fatura', 'z'));
    head.push(cell('th', 'Uzaklık'));
    thead.replaceChildren(row(head));
    const line = (
      id: string, tt: string, f: string, zt: string | null, zf: string | null, d: string, cls?: string,
    ): HTMLTableRowElement => row([
      cell('td', id), cell('td', tt), cell('td', f),
      ...(t.scaled ? [cell('td', zt ?? '', 'z'), cell('td', zf ?? '', 'z')] : []),
      cell('td', d),
    ], cls);
    tbody.replaceChildren(
      ...t.rows.map((r) => line(r.id, r.t, r.f, r.zt, r.zf, r.d, r.nearest ? 'nearest' : undefined)),
      line('Yeni', t.query.t, t.query.f, t.query.zt, t.query.zf, '', 'query-row'),
    );
  };

  const render = (s: PlayerState<OlcParams>): void => {
    const v = deriveOlcView(s.index, s.params);
    tableWrap.hidden = !v.table;
    if (v.table) drawTable(v.table);
    tree.hidden = s.index !== TREE_STEP;
    errors.hidden = s.index < FIRST_ERROR_STEP;
  };
  render(p.state);
  p.subscribe(render);
}
