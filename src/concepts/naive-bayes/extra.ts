import type { PlayerState, StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { spam } from './data';
import type { NbParams } from './scenario';
import { likelihood } from './spam';
import { deriveNbView, pct } from './view';

/** The book's two pitfalls in part 3; headings are static markup (no user input). */
const HATA: readonly { heading: string; html: string }[] = [
  {
    heading: 'Hata 1 — Kategorik/metin verisinde <code>GaussianNB</code> kullanmak',
    html: '<code>GaussianNB</code>, her özniteliğin sınıf içinde normal dağıldığını varsayar; kategorik veya sayım (count) verisinde bu varsayım geçersizdir ve yanlış olasılık tahminlerine yol açar.',
  },
  {
    heading: 'Hata 2 — <code>predict_proba</code> çıktısını ham olasılık gibi yorumlayıp aşırı güvenmek',
    html: 'Sınıflandırma kararı (hangi sınıf daha olası) çoğunlukla doğru kalsa da, olasılık değerlerinin mutlak büyüklüğüne aşırı güvenilmemelidir; bunlar göreli bir sıralama/skor aracı olarak kullanılmalıdır.',
  },
];

let uid = 0;

/**
 * Lab-only panel. Part 1: the exact Bayes value when it differs from the
 * rounded one; part 2: per-word likelihoods at the current alpha; part 3: the
 * book's two pitfalls (Hata 1 and Hata 2).
 */
export function mountNbExtra(host: HTMLElement, p: StepPlayer<NbParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'nb-extra';

  const exact = doc.createElement('p');
  exact.className = 'nb-extra-exact';

  const words = doc.createElement('div');
  words.className = 'nb-extra-words';
  const caption = doc.createElement('p');
  caption.className = 'nb-extra-caption';
  caption.id = `nb-extra-caption-${++uid}`;
  const scroll = doc.createElement('div');
  scroll.className = 'nb-extra-scroll';
  scroll.tabIndex = 0; // a scrollable region must be keyboard reachable
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-labelledby', caption.id);
  const table = doc.createElement('table');
  table.setAttribute('aria-labelledby', caption.id);
  table.innerHTML = '<thead><tr><th scope="col">Kelime</th><th scope="col">P(w | normal)</th>'
    + '<th scope="col">P(w | spam)</th></tr></thead><tbody>'
    + spam.words.map((x) => `<tr><td>${x.w}</td><td></td><td></td></tr>`).join('')
    + '</tbody>';
  const rows = [...table.tBodies[0].rows];
  scroll.append(table);
  words.append(caption, scroll);

  const hatas = HATA.map((h) => {
    const block = doc.createElement('div');
    block.className = 'nb-extra-hata';
    const heading = doc.createElement('p');
    heading.className = 'nb-extra-hata-title';
    heading.innerHTML = h.heading;
    const sentence = doc.createElement('p');
    sentence.innerHTML = h.html;
    block.append(heading, sentence);
    return block;
  });

  wrap.append(exact, words, ...hatas);
  const normalNote = doc.createElement('p');
  normalNote.className = 'normal-note';
  const normalLink = doc.createElement('a');
  normalLink.href = '../normal-dagilim/';
  normalLink.textContent = 'Normal dağılım ve standart sapma';
  normalNote.append('Gauss (çan) eğrisinin kendisi için ', normalLink, ' sayfasına bakın (Bölüm 2).');
  wrap.append(normalNote);
  host.append(wrap);

  const render = (s: PlayerState<NbParams>): void => {
    const v = deriveNbView(s.index, s.params);
    const diff = v.part === 1 && v.reveal === 2 && v.natural.posterior !== null
      && Math.abs(v.natural.exact - v.natural.posterior) * 100 > 0.1;
    exact.hidden = !diff;
    if (diff) exact.textContent = `kesin değer: ${pct(v.natural.exact)}`;

    words.hidden = v.part !== 2;
    if (v.part === 2) {
      const a = s.params.alpha;
      caption.textContent = a === 1 ? 'Kelime olasılıkları (α = 1)' : 'Kelime olasılıkları (α = 0)';
      spam.words.forEach((x, i) => {
        const cells = rows[i].cells;
        cells[1].textContent = formatNumber(likelihood(x.w, 0, a), 3);
        cells[2].textContent = formatNumber(likelihood(x.w, 1, a), 3);
      });
    }
    for (const h of hatas) h.hidden = v.part !== 3;
  };
  // Sliders notify on every move: render at most once per frame, from the
  // latest state, and not at all while the panel is hidden (Ders mode).
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
