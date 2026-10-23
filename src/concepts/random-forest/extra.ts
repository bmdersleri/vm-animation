import type { StepPlayer } from '../../core/player';
import type { RfParams } from './scenario';

/** Lab note: what the page leaves out, and the regression rule and the neighbour of Random Forest in one sentence each. */
const NOTES = [
  'Bu sayfada ağaçlar tarayıcıda eğitilmez; kökler, korelasyonlar, doğruluklar ve önemler önceden eğitilmiş ormanlardan okunur. Kaydırıcılar bu hazır sonuçlar arasında gezinir.',
  'Regresyonda max_features için öneri p/3’tür; sınıflandırmada √p’dir.',
  'Extra Trees, bölünme eşiklerini de rastgele seçerek ağaçları Random Forest’tan daha çok birbirinden uzaklaştırır.',
];

/** Mounts the static Lab note under the page. */
export function mountRfExtra(host: HTMLElement, _player: StepPlayer<RfParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'rf-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
