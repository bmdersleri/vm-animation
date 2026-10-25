import type { StepPlayer } from '../../core/player';
import type { SentimentParams } from './scenario';

/** Lab note: three-class sentiment and emoji, one sentence each (the shell puts it above the controls, so it stays short). */
const NOTES = [
  'Üç sınıflı duygu (olumlu, nötr, olumsuz) aynı boru hattıyla kurulur; yalnız etiket sayısı artar ve nötr örnekler gerekir.',
  'Emoji ve emoticon temizlikte atılırsa duygu ipucu kaybolur; onları ayrı terim olarak tutmak ya da kelimeye çevirmek gerekir.',
];

/** Mounts the static Lab note above the controls. */
export function mountSentimentExtra(host: HTMLElement, _player: StepPlayer<SentimentParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'sa-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
