import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { Perplexity } from './data';
import { pairFit, type Birim } from './pca2';

export interface PcaParams {
  /** Projection direction in degrees, 0-180. */
  theta: number;
  /** Unit of the 9th feature: x1 or x1000 (TL -> kuruş). */
  birim: Birim;
  /** Cumulative-variance threshold in percent, 50-99. */
  threshold: number;
  perplexity: Perplexity;
}

/** theta sweep of step 3: 0, 3, ..., 180 (61 values, 50 ms apart, about 3 s). */
export const THETA_SWEEP: readonly number[] = Array.from({ length: 61 }, (_, i) => i * 3);
export const THETA_SWEEP_MS = 50;

/** Steps where theta can be dragged (slider, Y). */
export const THETA_STEPS: readonly number[] = [1, 2, 3, 4];
/** Steps where B works. */
export const BIRIM_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];
export const THRESHOLD_STEPS: readonly number[] = [8, 9];
/** Steps where T works. */
export const PERPLEXITY_STEPS: readonly number[] = [10, 11];

const P = { birim: 1 as Birim, threshold: 90, perplexity: 30 as Perplexity };

export const pcaScenario: Scenario<PcaParams> = {
  defaults: { theta: 0, ...P },
  steps: [
    {
      id: 'bulut',
      title: 'Bulut',
      text: '500 müşteri, iki öznitelik: 2. ve 9. öznitelik. İkisi birlikte artıyor; aralarındaki korelasyon (correlation) r = 0,82. Noktalar eğik, uzun bir bulut oluşturuyor.',
      term: 'korelasyon (correlation)',
      params: { theta: 0, ...P },
    },
    {
      id: 'yon-sec',
      title: 'Bir yön seç',
      text: 'Bir yön seçip her noktayı o yöne düşürürüz; bu izdüşüm (projection) bulutu tek eksene indirir. Yatay yönde izdüşüm varyansı 1,00. Yönü çevirmek bu sayıyı değiştirir.',
      term: 'izdüşüm (projection)',
      params: { theta: 0, ...P },
    },
    {
      id: 'yonu-cevir',
      title: 'Yönü çevir',
      text: 'Yön 0°’den 180°’ye döner ve her açıda izdüşümün varyansı (variance) ölçülür. En çok yayılan yön aranıyor: o yönde veri en az bilgi kaybıyla özetlenir.',
      term: 'varyans (variance)',
      params: { ...P },
      sweep: { key: 'theta', values: [...THETA_SWEEP], intervalMs: THETA_SWEEP_MS },
    },
    {
      id: 'pc1',
      title: 'PC1',
      text: 'Bu bulut hangi yönde en çok yayılmış? 45° civarında: izdüşüm varyansı en büyük, λ1 = 1,83. Bu yön birinci temel bileşen (principal component), PC1. Korelasyon pozitifse PC1 köşegen boyunca uzanır.',
      term: 'temel bileşen (principal component)',
      params: { theta: 45, ...P },
    },
    {
      id: 'pc2',
      title: 'PC2',
      text: 'İkinci bileşen PC1’e dik, yani ortogonal (orthogonal) yöndür. Geriye kalan yayılmayı taşır: λ2 = 0,18.',
      term: 'ortogonal (orthogonal)',
      params: { theta: 45, ...P },
    },
    {
      id: 'yeni-eksenler',
      title: 'Yeni eksenler',
      text: 'Bulut artık PC1 ve PC2 eksenlerinde çiziliyor. PC1’in açıkladığı varyans oranı (explained variance ratio) %91,2: λ1 / (λ1 + λ2).',
      term: 'açıklanan varyans oranı (explained variance ratio)',
      params: { theta: 45, ...P },
    },
    {
      id: 'bir-boyut',
      title: 'Bir boyuta indir',
      text: 'PC2’yi atıp yalnızca PC1’i tutarsak boyut indirgeme (dimensionality reduction) yapmış oluruz: iki sütun tek sütuna iner. Korunan bilgi %91,2, kaybolan %8,8.',
      term: 'boyut indirgeme (dimensionality reduction)',
      params: { theta: 45, ...P },
    },
    {
      id: 'olcek-tuzagi',
      title: 'Ölçek tuzağı',
      text: '9. öznitelik TL yerine kuruş olarak yazılırsa değerler 1000 kat büyür ve ölçek duyarlılığı (scale sensitivity) ortaya çıkar. Ölçeklemeden PCA, sayısı büyük sütunu izler: PC1 neredeyse yalnız o sütundur.',
      term: 'ölçek duyarlılığı (scale sensitivity)',
      params: { theta: 45, birim: 1000, threshold: 90, perplexity: 30 },
    },
    {
      id: 'ozdegerler',
      title: 'Özdeğerler',
      text: 'Gerçek veride 12 sütun var. Her bileşenin özdeğeri (eigenvalue) ne kadar varyans taşıdığını söyler. 12 sütunun bilgisi yalnızca 3 yönde toplanıyor: veri 3 gizli sinyalden üretildi.',
      term: 'özdeğer (eigenvalue)',
      params: { theta: 45, ...P },
    },
    {
      id: 'esik',
      title: '%90 eşiği',
      text: 'Kümülatif varyans (cumulative variance) %90’ı geçince bileşen eklemeyi bırakırız. PCA(n_components=0.90) tam 3 bileşen seçer; bu üçü varyansın %93,8’ini taşır.',
      term: 'kümülatif varyans (cumulative variance)',
      params: { theta: 45, ...P },
    },
    {
      id: 'yan-yana',
      title: 'Yan yana',
      text: 'PCA ile t-SNE aynı müşterileri iki boyuta indirir. t-SNE kümeleri daha net ayırır ama eksenlerinin sayısal anlamı yoktur; perplexity değişince harita da değişir.',
      term: 't-SNE',
      params: { theta: 45, ...P },
    },
    {
      id: 'yeni-musteri',
      title: 'Yeni müşteri',
      text: 'Yeni müşteri geldiğinde PCA onu eğitilmiş eksenlere transform eder ve haritada yerini bulur. t-SNE’nin transform’u yok: yeniden çalıştırınca harita değişti, yeni müşteri eski haritaya eklenemez.',
      term: 'transform',
      params: { theta: 45, ...P },
    },
    {
      id: 'kural',
      title: 'Kural',
      text: 'Sınav Notu: özdeğer sıralaması bileşen sıralamasıyla birebir örtüşür; PC1 her zaman en büyük özdeğere sahiptir. PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir. Model girdisi (model input) için fit yalnızca eğitim verisinde çağrılır, transform her yerde.',
      term: 'model girdisi (model input)',
      params: { theta: 45, ...P },
    },
  ],
};

/** Eases theta to `to` over `ms`; stops on a step change or when the returned stopper is called. */
export function animateTheta(
  p: StepPlayer<PcaParams>,
  to: number,
  opts: { ms?: number; raf?: (cb: FrameRequestCallback) => number; now?: () => number } = {},
): () => void {
  const ms = opts.ms ?? 600;
  const raf = opts.raf ?? ((cb: FrameRequestCallback): number => requestAnimationFrame(cb));
  const now = opts.now ?? ((): number => performance.now());
  const from = p.state.params.theta;
  const index = p.state.index;
  if (Math.abs(to - from) < 0.5) {
    p.setParam('theta', Math.round(to));
    return () => {};
  }
  const t0 = now();
  let stopped = false;
  const frame = (): void => {
    if (stopped || p.state.index !== index) return;
    const t = Math.min(1, Math.max(0, (now() - t0) / ms));
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    p.setParam('theta', t >= 1 ? Math.round(to) : Math.round(from + (to - from) * e));
    if (t < 1) raf(frame);
  };
  frame();
  return () => { stopped = true; };
}

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function pcaShortcuts(player: StepPlayer<PcaParams>): Shortcut[] {
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  const PER: Perplexity[] = [5, 30, 50];
  let stop: () => void = () => {};
  return [
    {
      keys: ['b', 'B'], display: 'B', label: '9. öznitelik birimi: ×1 / ×1000',
      run: () => {
        if (inSteps(BIRIM_STEPS)) player.setParam('birim', player.state.params.birim === 1 ? 1000 : 1);
      },
    },
    {
      keys: ['y', 'Y'], display: 'Y', label: 'PC1’i bul',
      run: () => {
        if (inSteps(THETA_STEPS)) {
          stop();
          stop = animateTheta(player, Math.round(pairFit(player.state.params.birim).pc1Deg));
        }
      },
    },
    {
      keys: ['t', 'T'], display: 'T', label: 'perplexity: 5 / 30 / 50',
      run: () => {
        if (inSteps(PERPLEXITY_STEPS)) {
          const i = PER.indexOf(player.state.params.perplexity);
          player.setParam('perplexity', PER[(i + 1) % PER.length]);
        }
      },
    },
  ];
}
