import type { StepPlayer } from '../../core/player';
import type { TuneParams } from './scenario';

/** Lab note: what the two production libraries add to this page's settings, one sentence each (spec "Kapsam dışı"). */
const NOTES = [
  'XGBoost ağaçları yalnız kayıp fonksiyonunun birinci türeviyle değil, ikinci türeviyle de (Hessian) büyütür ve yaprak değerlerine L1 ile L2 cezası koyar; bu sayfadaki ağaç yalnız artıkların ortalamasını kullanır.',
  'LightGBM sürekli özellikleri önce histogram kovalarına böler ve eşikleri kova sınırlarında arar; bu sayfadaki ağaç her eşiği ham değerler üzerinde dener.',
];

/** Mounts the static Lab note under the page. */
export function mountTuneExtra(host: HTMLElement, _player: StepPlayer<TuneParams>): void {
  const wrap = host.ownerDocument.createElement('div');
  wrap.className = 'tune-extra';
  for (const text of NOTES) {
    const p = host.ownerDocument.createElement('p');
    p.textContent = text;
    wrap.append(p);
  }
  host.append(wrap);
}
