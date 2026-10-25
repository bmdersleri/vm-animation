import type { StepPlayer } from '../../core/player';
import type { TfidfParams } from './scenario';

/** Lab note: n-gram and lemmatisation, one sentence each (the shell puts it above the controls, so it stays short). */
const NOTES = [
  'N-gram bitişik kelime çiftlerini ("kötü değil") tek terim sayar; sözlük büyür ama olumsuzlama korunur.',
  'Lemmatization kelimeleri köklerine indirir ("bağlantısı" → "bağlantı"); ek yüzünden bölünen sütunlar birleşir.',
];

/** Mounts the static Lab note above the controls. */
export function mountTfidfExtra(host: HTMLElement, _player: StepPlayer<TfidfParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'tf-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
