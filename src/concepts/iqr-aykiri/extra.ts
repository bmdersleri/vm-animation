import type { PlayerState, StepPlayer } from '../../core/player';
import { deriveIqrView } from './view';
import type { IqrParams } from './scenario';

/** Static Lab text (no user input), `html` allows <code>. */
const PART1: readonly string[] = [
  'MCAR (tamamen rastgele eksik): eksiklik hiçbir değişkenle ilişkili değildir; örneğin bir sensör rastgele arıza yapar.',
  'MAR (rastgele eksik): eksiklik gözlenen başka bir değişkenle ilişkilidir; örneğin yaşlı müşteriler çevrimiçi formdaki alanları daha sık boş bırakır.',
  'MNAR (rastgele olmayan eksik): eksiklik eksik değerin kendisiyle ilişkilidir; örneğin yüksek gelirli müşteriler gelir bilgisini gizler.',
  'Kategorik sütunda mod kullanılır: Aylık, Aylık, boş, Bir Yıllık → boş hücre Aylık olur.',
];
const PART2: readonly string[] = [
  'Bıyıklar sınıra kadar uzamaz; sınırların içinde kalan en uç gözlemde biter: alt bıyık 29,85’te, üst bıyık 60,20’de (matplotlib ve seaborn bu kuralı izler; kitabın Şekil 3.2’si).',
  'Sekiz gözlemde, ddof = 0 ile hiçbir z değeri √7 ≈ 2,65’i geçemez; bu yüzden |z| > 3 kuralı burada hiçbir şeyi yakalayamaz.',
  'Kitabın hata alıştırmasında üst sınır <code>q3 + 1.5 * q1</code> diye yazılmış; doğrusu <code>q3 + 1.5 * (q3 - q1)</code>.',
];

/** Lab-only panel: part 1 missingness notes, part 2 whisker/z/formula notes, and the live note. */
export function mountIqrExtra(host: HTMLElement, p: StepPlayer<IqrParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'iqr-extra';
  const make = (html: string): HTMLParagraphElement => {
    const e = doc.createElement('p');
    e.innerHTML = html;
    return e;
  };
  const p1 = PART1.map(make);
  const p2 = PART2.map(make);
  const note = doc.createElement('p');
  note.className = 'live-note';
  wrap.append(...p1, ...p2, note);
  host.append(wrap);

  const render = (s: PlayerState<IqrParams>): void => {
    const v = deriveIqrView(s.index, s.params);
    for (const e of p1) e.hidden = v.part !== 1;
    for (const e of p2) e.hidden = v.part !== 2;
    if (note.textContent !== v.note) note.textContent = v.note;
  };
  render(p.state);
  p.subscribe(render);
}
