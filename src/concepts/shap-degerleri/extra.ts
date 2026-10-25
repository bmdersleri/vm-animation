import type { StepPlayer } from '../../core/player';
import type { ShapParams } from './scenario';

/** Lab note: what this page leaves out, one sentence each (the shell puts it above the controls, so it stays short). */
const NOTES = [
  'KernelSHAP, modele bakmadan Shapley değerini örnekleyerek kestirir; bu sayfada üç özellik olduğundan sekiz koalisyonun hepsi hesaplanır.',
  'SHAP etkileşim değerleri iki özelliğin ortak katkısını ayrıca verir; burada yalnız tek özelliğin katkısı var.',
];

/** Mounts the static Lab note above the controls. */
export function mountShapExtra(host: HTMLElement, _player: StepPlayer<ShapParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'shap-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
