import type { PlayerState, StepPlayer } from '../../core/player';
import { ATTRS, DAYS } from './tennis';
import type { TreeParams } from './scenario';
import { deriveTreeView, pct } from './view';

const CLS = ['● Evet', '▲ Hayır'] as const;
const NOTE = 'scikit-learn (CART) her düğümü ikiye böler; burada kategorileri ayrı dallar olarak gösteriyoruz.';
const CURVE_NOTE = 'Eğri yalnızca aday eşikleri gösterir; sürüklerken nokta iki aday arasında eğrinin dışında kalabilir.';
/** Static markup (no user input): the book's post-pruning, which the page shows as a depth limit. */
const PRUNE_NOTE = 'Kitapta ağaç tam büyüdükten sonra geriye dönük budama (post-pruning) da anlatılır: scikit-learn\'de <code>ccp_alpha</code> ile maliyet-karmaşıklık budaması. Burada budamayı derinlik sınırıyla gösteriyoruz.';

let uid = 0;

/** Lab-only panel: the 14-day tennis table (part 1) or the accuracies (part 2). */
export function mountTreeExtra(host: HTMLElement, p: StepPlayer<TreeParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'tree-extra';

  const caption = doc.createElement('p');
  caption.className = 'tree-extra-caption';
  caption.id = `tree-extra-caption-${++uid}`;
  caption.textContent = 'Tenis verisi: 14 gün';
  const scroll = doc.createElement('div');
  scroll.className = 'tree-extra-scroll';
  scroll.tabIndex = 0; // a scrollable region must be keyboard reachable
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-labelledby', caption.id);
  const table = doc.createElement('table');
  table.setAttribute('aria-labelledby', caption.id);
  table.innerHTML = '<thead><tr><th scope="col">Gün</th>'
    + ATTRS.map((a) => `<th scope="col">${a}</th>`).join('')
    + '<th scope="col">Oyun</th></tr></thead><tbody>'
    + DAYS.map((d) => `<tr><td>${d.id}</td>${d.values.map((v) => `<td>${v}</td>`).join('')}`
      + `<td class="cls ${d.y === 0 ? 'evet' : 'hayir'}">${CLS[d.y]}</td></tr>`).join('')
    + '</tbody>';
  const rows = [...table.tBodies[0].rows];
  scroll.append(table);
  const acc = doc.createElement('p');
  acc.className = 'tree-extra-acc';
  const note = doc.createElement('p');
  note.className = 'tree-extra-note';
  note.textContent = NOTE;
  const curveNote = doc.createElement('p');
  curveNote.className = 'tree-extra-note';
  curveNote.textContent = CURVE_NOTE;
  const prune = doc.createElement('p');
  prune.className = 'tree-extra-note tree-extra-prune';
  prune.innerHTML = PRUNE_NOTE;
  wrap.append(caption, scroll, acc, note, curveNote, prune);
  host.append(wrap);

  const render = (s: PlayerState<TreeParams>): void => {
    const v = deriveTreeView(s.index, s.params);
    const part1 = v.part === 1;
    caption.hidden = scroll.hidden = note.hidden = !part1;
    prune.hidden = v.part !== 2;
    // Branch of the focused candidate (the last filled card, or the winner) per day.
    let focus = v.cards.findIndex((c) => c.win);
    if (focus < 0) focus = v.cards.reduce((f, c, i) => (c.filled ? i : f), -1);
    const card = part1 && focus >= 0 ? v.cards[focus] : null;
    rows.forEach((r, i) => {
      const b = card ? card.branches.findIndex((br) => br.label === DAYS[i].values[focus]) : -1;
      if (b >= 0) r.setAttribute('data-branch', String(b));
      else r.removeAttribute('data-branch');
    });
    const showAcc = v.acc !== null && !!v.tree?.split;
    acc.hidden = curveNote.hidden = !showAcc;
    if (showAcc && v.acc) {
      const rowsText = [`Eğitim doğruluğu ${pct(v.acc.train)}`];
      if (v.acc.test !== null) rowsText.push(`Test doğruluğu ${pct(v.acc.test)}`);
      acc.replaceChildren(...rowsText.map((t) => {
        const d = doc.createElement('span');
        d.textContent = t;
        d.style.display = 'block';
        return d;
      }));
    }
  };
  // A drag notifies on every pointer move: render at most once per frame, from
  // the latest state, and not at all while the panel is hidden (Ders mode).
  const hidden = (): boolean => host.closest('[hidden]') !== null;
  let dirty = true;
  let frame = false;
  const flush = (): void => {
    frame = false;
    if (!dirty || hidden()) return;
    dirty = false;
    render(p.state);
  };
  const schedule = (): void => {
    dirty = true;
    if (frame || hidden()) return;
    if (typeof requestAnimationFrame !== 'function') return flush();
    frame = true;
    requestAnimationFrame(flush);
  };
  flush();
  p.subscribe(schedule);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (dirty) schedule(); })
      .observe(host, { attributes: true, attributeFilter: ['hidden'] });
  }
}
