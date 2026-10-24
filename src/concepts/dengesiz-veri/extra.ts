import type { StepPlayer } from '../../core/player';
import type { ImbParams } from './scenario';

/** Lab note: two short sentences (the shell puts this note above the controls, so it must stay short). */
const NOTES = [
  'Dengeleme olasılıkları şişirir; skorlar olasılık olarak okunmadan önce kalibrasyon denetlenmelidir.',
  'ADASYN öğrenmesi zor bölgelerde, Borderline-SMOTE sınıf sınırında daha çok sentetik nokta üretir.',
];

/** Mounts the static Lab note under the page. */
export function mountImbExtra(host: HTMLElement, _player: StepPlayer<ImbParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'imb-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
