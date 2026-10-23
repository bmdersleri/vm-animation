import type { StepPlayer } from '../../core/player';
import type { BaggingParams } from './scenario';

/** Lab note: what this page leaves out, with the two neighbours of bagging named in one sentence each. */
const NOTES = [
  'Bu sayfada ağaçlar tarayıcıda eğitilmez; her bootstrap ağacı önceden, tam derinlikte eğitilmiş ve yalnız yapısından tahmin edilir. Çekilişler tohumludur: aynı n ve aynı "Yeni çekiliş" sırası hep aynı örneği verir.',
  'Extra Trees, bölünme eşiklerini de rastgele seçerek ağaçları bagging’den daha çok birbirinden uzaklaştırır.',
  'Boosting ise ağaçları paralel değil sırayla eğitir; her yeni ağaç öncekilerin yaptığı hataları düzeltmeye çalışır.',
];

/** Mounts the static Lab note under the page. */
export function mountBaggingExtra(host: HTMLElement, _player: StepPlayer<BaggingParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'bagging-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
