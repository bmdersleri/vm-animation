import '../core/theme.css';
import { concepts, type ConceptEntry } from '../concepts/registry';

const INTRO =
  'Kitaptaki temel kavramları adım adım ilerleyen, parametreleriyle oynanabilen animasyonlarla keşfedin. Derste anlatım için Ders modunu, kendi başınıza çalışmak için Laboratuvar modunu kullanın.';

const SVG_OPEN =
  '<svg class="glyph" viewBox="0 0 48 32" width="48" height="32" aria-hidden="true" focusable="false">';

function glyph(c: ConceptEntry): string {
  if (c.id === 'knn') {
    return (
      SVG_OPEN +
      '<g stroke="#14365C" stroke-width="1.5"><line x1="24" y1="16" x2="12" y2="8"/><line x1="24" y1="16" x2="36" y2="9"/><line x1="24" y1="16" x2="33" y2="25"/></g>' +
      '<circle cx="12" cy="8" r="3" fill="#0EA5A4"/><circle cx="36" cy="9" r="3" fill="#0EA5A4"/><circle cx="33" cy="25" r="3" fill="#F08A00"/>' +
      '<circle cx="6" cy="25" r="3" fill="#F08A00" opacity=".5"/><circle cx="44" cy="20" r="3" fill="#0EA5A4" opacity=".5"/>' +
      '<circle cx="24" cy="16" r="4" fill="#14365C"/></svg>'
    );
  }
  return (
    SVG_OPEN +
    '<line x1="6" y1="24" x2="42" y2="8" stroke="#14365C" stroke-width="1.5" opacity=".5"/>' +
    '<circle cx="10" cy="12" r="3" fill="#0EA5A4"/><circle cx="22" cy="22" r="3" fill="#F08A00"/>' +
    '<circle cx="34" cy="10" r="3" fill="#14365C"/><circle cx="40" cy="24" r="3" fill="#0EA5A4"/></svg>'
  );
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function card(c: ConceptEntry): HTMLElement {
  const ready = c.status === 'hazir' && c.href;
  let root: HTMLElement;
  if (ready) {
    const a = el('a', 'card hazir');
    a.href = c.href!;
    root = a;
  } else {
    root = el('article', 'card yakinda');
    root.setAttribute('aria-disabled', 'true');
  }
  const top = el('div', 'card-top');
  top.append(el('span', 'badge', `Bölüm ${c.chapter}`));
  if (!ready) top.append(el('span', 'tag', 'Yakında'));
  const g = el('div', 'glyph-wrap');
  g.innerHTML = glyph(c);
  root.append(top, g, el('h3', 'card-title', c.title));
  return root;
}

export function renderHome(root: HTMLElement): void {
  root.textContent = '';
  const header = el('header', 'home-head');
  header.append(
    el('h1', undefined, 'Modern Veri Madenciliğine Giriş'),
    el('p', 'subtitle', 'Kavram Animasyonları'),
    el('p', 'author', 'Prof. Dr. İsmail KIRBAŞ'),
    el('p', 'intro', INTRO),
  );
  const main = el('main', 'home-main');

  const chapters = [...new Set(concepts.map((c) => c.chapter))];
  for (const ch of chapters) {
    const items = concepts.filter((c) => c.chapter === ch);
    const sec = el('section', 'chapter');
    sec.append(el('h2', undefined, `Bölüm ${ch} · ${items[0].chapterTitle}`));
    const grid = el('div', 'grid');
    for (const c of items) {
      if (c.status === 'hazir' && c.href) {
        const wrap = el('div', 'card-wrap');
        const ders = el('a', 'card-ders', 'Ders modunda aç');
        ders.href = `${c.href}?mod=ders`;
        wrap.append(card(c), ders);
        grid.append(wrap);
      } else {
        grid.append(card(c));
      }
    }
    sec.append(grid);
    main.append(sec);
  }
  root.append(header, main);
}

const app = document.querySelector<HTMLElement>('#app');
if (app) renderHome(app);
