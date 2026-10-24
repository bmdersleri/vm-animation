import type { StepPlayer } from '../../core/player';
import type { GbParams } from './scenario';

/** Lab note: how this page's boosting differs from its two neighbours, one sentence each. */
const NOTES = [
  'Bu sayfada ağaçlar tarayıcıda eğitilir: ν, derinlik ve ağaç sayısını her değiştirişinizde boosting döngüsü baştan çalışır. Veri, kitabın kodundaki gibi sabittir; doğrulama kümesi ezberi göstermek için eklenmiştir.',
  'AdaBoost artık yerine örnek ağırlıklarını kullanır: yanlış sınıflanan örneğin ağırlığı artar, sonraki zayıf öğrenici o örneklere daha çok bakar.',
  'Sınıflandırmada gradyan artırma aynı döngüyü kullanır, ama artık y − p olur (y gerçek sınıf, p modelin olasılığı); bu sayfa kare hatalı regresyonu gösterir.',
];

/** Mounts the static Lab note under the page. */
export function mountGbExtra(host: HTMLElement, _player: StepPlayer<GbParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'gb-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
