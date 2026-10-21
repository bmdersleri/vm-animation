import type { PlayerState, StepPlayer } from '../../core/player';
import { derivePcaView } from './view';
import type { PcaParams } from './scenario';

/** Static Lab text (no user input); `html` allows <code>. */
const CURSE = 'Boyutun laneti (curse of dimensionality): 5000 müşteri 5 boyutta kümeler oluşturabilir; aynı 5000 nokta 200 boyuta yayıldığında neredeyse birbirinden eşit uzaklıkta durur.';
const SIXTY = 'Kitabın 002 örneğinde birbirinden bağımsız 60 sütunda <code>PCA(n_components=0.90)</code> 53 bileşen tutar: ilişkisiz sütunlar sıkıştırılamaz.';
const REFIT = 'PCA’yı test kümesine yeniden fit etmeyin: bileşenler yalnızca eğitim verisinden öğrenilir, test verisine yalnızca transform uygulanır.';
const TIP = 't-SNE’den önce PCA ile 30–50 boyuta inmek hem hesabı hızlandırır hem gürültüyü azaltır.';
const TIP_FIRST_STEP = 10;

/** Lab-only panel: steps 1-10 curse, 60 → 53 and refit rule; steps 11-13 refit rule and the PCA-before-t-SNE tip; live note at the bottom. */
export function mountPcaExtra(host: HTMLElement, p: StepPlayer<PcaParams>): void {
  const doc = host.ownerDocument;
  const make = (html: string): HTMLParagraphElement => {
    const e = doc.createElement('p');
    e.innerHTML = html;
    return e;
  };
  const curse = make(CURSE);
  const sixty = make(SIXTY);
  const refit = make(REFIT);
  const tip = make(TIP);
  const note = doc.createElement('p');
  note.className = 'live-note';
  const wrap = doc.createElement('div');
  wrap.className = 'pca-extra';
  wrap.append(curse, sixty, refit, tip, note);
  host.append(wrap);

  const render = (s: PlayerState<PcaParams>): void => {
    const late = s.index >= TIP_FIRST_STEP;
    curse.hidden = late;
    sixty.hidden = late;
    tip.hidden = !late;
    const text = derivePcaView(s.index, s.params).note;
    if (note.textContent !== text) note.textContent = text;
  };
  render(p.state);
  p.subscribe(render);
}
