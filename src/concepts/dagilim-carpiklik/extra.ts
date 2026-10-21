import type { PlayerState, StepPlayer } from '../../core/player';
import type { DagilimParams } from './scenario';
import { deriveDagilimView } from './view';

/** The five Lab notes of the spec (short, no user input). */
const LAB: readonly string[] = [
  '002 örneğinde bölüm adı kategorik bir sütundur: histogram yalnızca sayısal sütun için çizilir, kategoriler için sütun grafiği kullanılır.',
  'Ortalama her zaman tipik değer değildir: uç değer 60 ortalamayı 10,4’ten 13,6’ya çekerken medyan 8,5’te kalır.',
  'Standart sapmanın birimi verinin birimidir (burada saat); varyansın birimi saat² olduğu için doğrudan yorumlanmaz.',
  'Sıfıra yakın çarpıklık kesin normallik kanıtı değildir: simetrik görünen bir dağılım iki tepeli olabilir.',
  'Uç değer tek başına veri hatası değildir: 28 saatlik öğrenci gerçek olabilir; çarpıklık var diye silinmez, önce kaynağı incelenir.',
];

/** Lab-only panel: the five notes plus the live note of the current step. Text only via textContent. */
export function mountDagilimExtra(host: HTMLElement, p: StepPlayer<DagilimParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'dag-extra';
  const paras = LAB.map((t) => {
    const e = doc.createElement('p');
    e.textContent = t;
    return e;
  });
  const note = doc.createElement('p');
  note.className = 'live-note';
  wrap.append(...paras, note);
  host.append(wrap);

  const render = (s: PlayerState<DagilimParams>): void => {
    const v = deriveDagilimView(s.index, s.params);
    if (note.textContent !== v.note) note.textContent = v.note;
  };
  render(p.state);
  p.subscribe(render);
}
