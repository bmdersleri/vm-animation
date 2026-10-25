import type { StepPlayer } from '../../core/player';
import type { LimeParams } from './scenario';

/** Lab note: what this pair of pages leaves out, one sentence each (the shell puts it above the controls, so it stays short). */
const NOTES = [
  'KernelSHAP, modeli kara kutu sayıp özellik kümelerini örnekler ve Shapley değerini ağırlıklı bir doğrusal uydurmayla kestirir.',
  'SHAP için arka plan kümesi, bir özelliğin bilinmediği durumda yerine konan değerleri seçer; farklı bir arka plan farklı katkılar verebilir.',
];

/** Mounts the static Lab note above the controls. */
export function mountLimeExtra(host: HTMLElement, _player: StepPlayer<LimeParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'lime-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
