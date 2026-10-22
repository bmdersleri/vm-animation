import type { PlayerState, StepPlayer } from '../../core/player';
import type { KutuParams } from './scenario';
import { deriveKutuView } from './view';

/** The four Lab notes of the spec (short, no user input). */
const LAB: readonly string[] = [
  'Kutunun dışındaki her nokta hata değildir: 98 notu gerçek bir öğrencinin notu olabilir; baklava “sil” talimatı değil, “kaynağına bak” işaretidir.',
  'Küçük örneklemde güçlü sonuç çıkarmayın: beş notta tek bir gözlem medyanı ve çeyrekleri bir basamak kaydırır; n = 5, n = 500 gibi konuşmaz.',
  'Kutu yoğunluğu gizler: aynı Q1, medyan ve IQR’ye sahip iki grup çok farklı dağılabilir; noktaları ve yoğunluk eğrisini de görün.',
  'Silmeden önce kayıt/ölçüm/iş durumunu ayrıştırın: kayıt hatası, ölçüm hatası ve gerçek iş durumu aynı şey değildir; kaynağı bilinmeyen değer silinmez.',
];

/** Lab-only panel: the four notes plus the live note of the current step. Text only via textContent. */
export function mountKutuExtra(host: HTMLElement, p: StepPlayer<KutuParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'kutu-extra';
  const paras = LAB.map((t) => {
    const e = doc.createElement('p');
    e.textContent = t;
    return e;
  });
  const note = doc.createElement('p');
  note.className = 'live-note';
  wrap.append(...paras, note);
  host.append(wrap);

  const render = (s: PlayerState<KutuParams>): void => {
    const v = deriveKutuView(s.index, s.params);
    if (note.textContent !== v.note) note.textContent = v.note;
  };
  render(p.state);
  p.subscribe(render);
}
