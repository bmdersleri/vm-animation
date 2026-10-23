import type { StepPlayer } from '../../core/player';
import type { NormalParams } from './scenario';
import { SERIES } from './data';
import { deriveNormalView } from './view';
const NOTES = [
 'Eğri yüksekliği olasılık değildir; sürekli dağılımda tek bir noktanın olasılığı 0’dır. Olasılık, eğrinin altındaki alandır.',
 `pandas std() ddof = 1, StandardScaler ddof = 0 kullanır. n = ${SERIES.sinav.values.length} için bu fark küçüktür.`,
 '68–95–99,7 kuralı yalnız normale yakın veride geçerlidir. Q–Q grafiği bu yakınlığı denetlemenin bir yoludur.',
 '|z| > 3 aykırılık için kaba bir işarettir; çarpık veride IQR daha dayanıklıdır.',
 'GaussianNB her özelliğin sınıf içinde normal dağıldığını varsayar (Bölüm 5).',
];
export function mountNormalExtra(host:HTMLElement,player:StepPlayer<NormalParams>):void {
 const wrap=host.ownerDocument.createElement('div');wrap.className='normal-extra';
 for(const text of NOTES){const p=host.ownerDocument.createElement('p');p.textContent=text;wrap.append(p);}
 const note=host.ownerDocument.createElement('p');note.className='live-note';wrap.append(note);host.append(wrap);
 const sync=()=>{note.textContent=deriveNormalView(player.state.index,player.state.params).note;};sync();player.subscribe(sync);
}
