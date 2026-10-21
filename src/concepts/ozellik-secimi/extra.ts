import type { PlayerState, StepPlayer } from '../../core/player';
import { deriveSecimView } from './view';
import type { SecimParams } from './scenario';

const ENGINEERING = 'Özellik mühendisliği var olan sütunlardan yeni sütun türetir (kıdem, oran, etkileşim; kitabın 001 örneği); özellik seçimi var olan sütunlardan bazılarını eler.';
const EMBEDDED = 'Gömülü yöntemler seçimi modelin eğitimi sırasında yapar: Lasso bazı katsayıları sıfıra indirir, ağaçlar önem puanı verir.';
const EMBEDDED_FIRST_STEP = 5;

const HEAD = ['Tür', 'Örnek', 'Hız', 'Etkileşim'];
const ROWS: readonly (readonly string[])[] = [
  ['Filtre', 'VarianceThreshold, SelectKBest', 'Çok hızlı', 'Hayır'],
  ['Sarmalayıcı', 'RFE', 'Yavaş', 'Evet'],
  ['Gömülü', 'Lasso, ağaç önemleri', 'Orta', 'Kısmen'],
];

/** Lab-only panel: steps 1-5 feature engineering, 6-10 embedded methods, the method table always, live note at the bottom. */
export function mountSecimExtra(host: HTMLElement, p: StepPlayer<SecimParams>): void {
  const doc = host.ownerDocument;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const engineering = make('p', ENGINEERING);
  const embedded = make('p', EMBEDDED);

  const table = make('table');
  table.className = 'methods';
  const headRow = make('tr');
  headRow.append(...HEAD.map((h) => make('th', h)));
  const thead = make('thead');
  thead.append(headRow);
  const tbody = make('tbody');
  for (const cells of ROWS) {
    const tr = make('tr');
    tr.append(...cells.map((c) => make('td', c)));
    tbody.append(tr);
  }
  table.append(thead, tbody);

  const note = make('p');
  note.className = 'live-note';
  const wrap = make('div');
  wrap.className = 'secim-extra';
  wrap.append(engineering, embedded, table, note);
  host.append(wrap);

  const render = (s: PlayerState<SecimParams>): void => {
    const late = s.index >= EMBEDDED_FIRST_STEP;
    engineering.hidden = late;
    embedded.hidden = !late;
    const text = deriveSecimView(s.index, s.params).note;
    if (note.textContent !== text) note.textContent = text;
  };
  render(p.state);
  p.subscribe(render);
}
