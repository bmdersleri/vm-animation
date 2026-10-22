import type { PlayerState, StepPlayer } from '../../core/player';
import type { KorelParams } from './scenario';
import { deriveKorelView } from './view';

/** The seven Lab notes of the spec: pitfalls, the diagonal rule and the two capstones. */
const LAB: readonly string[] = [
  'Şemsiye–yağmur örneği: iki değişken birlikte artar ama şemsiye yağmuru yapmaz; korelasyon yönü verir, nedeni vermez.',
  'Bir üçüncü değişken (örneğin motivasyon) hem çalışmayı hem notu yükseltirse iki değişken ilişkili görünür; asıl sürücü görünmeyen değişkendir.',
  'Burada bir ters nedensellik sorunu var: yüksek not daha az devamsızlık mı doğurur, yoksa devamsızlık notu mu düşürür? Sıra, veriden tek başına okunmaz.',
  'Köşegen 1,000 bulgu değildir: her değişken kendisiyle tam ilişkilidir; ısı haritasını okurken köşegeni yok sayın, asıl hücrelere bakın.',
  'r küçük örneklemde dalgalanır: altı-yedi gözlemde tek bir nokta katsayıyı savurur; katsayıyı örneklem büyüklüğü ve grafikle birlikte okuyun.',
  'OgrenciEDA sınıfı bu dörtlüyü tek yerde toplar: özet tablo, saçılım, ısı haritası ve kaldıraç kontrolü aynı keşif akışının parçalarıdır.',
  'Telco capstone’da churn sütunu 0/1 kodlanır; ısı haritasına kattığınızda renk ilişki gibi görünür, oysa okunan şey ölçüm değil etikettir.',
];

/** Lab-only panel: the seven notes plus the live note of the current step. Text only via textContent. */
export function mountKorelasyonExtra(host: HTMLElement, p: StepPlayer<KorelParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'kor-extra';
  const paras = LAB.map((t) => {
    const e = doc.createElement('p');
    e.textContent = t;
    return e;
  });
  const note = doc.createElement('p');
  note.className = 'live-note';
  wrap.append(...paras, note);
  host.append(wrap);

  const render = (s: PlayerState<KorelParams>): void => {
    const v = deriveKorelView(s.index, s.params);
    if (note.textContent !== v.note) note.textContent = v.note;
  };
  render(p.state);
  p.subscribe(render);
}
