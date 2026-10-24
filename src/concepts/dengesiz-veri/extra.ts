import type { StepPlayer } from '../../core/player';
import type { ImbParams } from './scenario';

/** Lab note: what balancing does to probabilities, and two SMOTE relatives, one sentence each. */
const NOTES = [
  'Dengeleme olasılıkları şişirir: SMOTE ile ya da sınıf ağırlığıyla eğitilen bir model, gerçekte olduğundan daha sık "ayrılır" olasılığı verir. Bu yüzden skorlar olasılık olarak okunmadan önce kalibrasyon denetimi gerekir.',
  'ADASYN, SMOTE gibi sentetik nokta üretir ama öğrenmesi zor olan, yani çevresinde daha çok kalan bulunan ayrılanlardan daha fazla üretir.',
  'Borderline-SMOTE yalnızca iki sınıfın sınırına yakın ayrılanlardan sentetik nokta üretir; sınırdan uzak, rahat bölgedeki ayrılanları çoğaltmaz.',
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
