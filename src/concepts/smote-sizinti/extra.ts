import type { StepPlayer } from '../../core/player';
import type { LeakParams } from './scenario';

/** Lab note: two short sentences (the shell puts this note above the controls, so it must stay short). */
const NOTES = [
  'RandomUnderSampler çoğunluk sınıfından satır atarak dengeler; veri azsa bilgi kaybettirir.',
  'SMOTENC sayısal ve kategorik özellikleri birlikte işler; sentetik noktanın kategorisini komşulardan alır.',
];

/** Mounts the static Lab note above the controls. */
export function mountLeakExtra(host: HTMLElement, _player: StepPlayer<LeakParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'leak-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
