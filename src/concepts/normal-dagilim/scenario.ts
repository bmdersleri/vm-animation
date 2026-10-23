import { stepIndex, type Scenario, type StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { SERIES, NORM, SINAV_FIXED, type Seri } from './data';
import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';

/** Parameters of the normal-distribution page (series, mu, sigma, interval a-b, k, x). */
export interface NormalParams {
  seri: Seri;
  mu: number;
  sigma: number;
  a: number;
  b: number;
  x: number;
  k: 1 | 2 | 3;
}

/** Alias used by the registry. */
export type NormalDagilimParams = NormalParams;

const s = SERIES.sinav,
  c = SERIES.cagri;

const seriesLab = 'Seri seçiciyle veriyi değiştir; histogramı, eğriyi ve canlı özetleri karşılaştır.';

/** The step scenario of the normal-distribution page. */
export const normalScenario: Scenario<NormalParams> = {
  defaults: { seri: 'sinav', mu: s.mean, sigma: s.std, a: SINAV_FIXED.a, b: SINAV_FIXED.b, x: SINAV_FIXED.x, k: 1 },
  steps: [
    {
      id: 'histogram',
      title: 'Simetrik bir histogram',
      text: `${f(s.values.length, 0)} öğrencinin sınav notu: ortalama ${f(s.mean, 1)}, medyan ${f(s.median, 1)}, standart sapma ${f(s.std, 1)}. Histogram tek tepeli ve iki yana yaklaşık simetriktir.`,
      labText: seriesLab,
      params: { seri: 'sinav' },
    },
    {
      id: 'egri',
      title: 'Çan eğrisi',
      text: `Histogramın üstüne μ = ${f(s.mean, 1)}, σ = ${f(s.std, 1)} ile çizilen normal dağılım eğrisi oturur.`,
      labText: seriesLab,
      term: 'normal dağılım (normal distribution)',
    },
    {
      id: 'mu-sigma',
      title: 'İki sayı, bir eğri',
      term: 'ortalama μ · standart sapma σ (standard deviation)',
      text: 'μ eğrinin merkezini belirler. σ küçülünce eğri daralır ve yükselir; büyüyünce yayılır ve alçalır. Her eğrinin toplam alanı aynıdır.',
      labText: 'μ ve σ kaydırıcılarını değiştir; merkezin, genişliğin ve tepe yüksekliğinin değişimini izle.',
      params: { seri: 'sinav', mu: s.mean, sigma: s.std },
    },
    {
      id: 'alan',
      title: 'Olasılık bir alandır',
      text: `${f(SINAV_FIXED.a, 0)}–${f(SINAV_FIXED.b, 0)} aralığında teorik olasılık ${pct(SINAV_FIXED.area)}; örneklemde ${f(SINAV_FIXED.count, 0)} öğrenci var. Eğrinin yüksekliği olasılık değildir; olasılık aralığın altındaki alandır.`,
      labText: 'a ve b sınırlarını değiştir; alanı ve aralığa düşen gözlem sayısını karşılaştır.',
      term: 'olasılık yoğunluğu (probability density)',
      params: { seri: 'sinav', a: SINAV_FIXED.a, b: SINAV_FIXED.b },
    },
    {
      id: 'kural',
      title: '68–95–99,7',
      text:
        NORM.bands.map(([k, p]) => `±${f(k, 0)}σ: ${pct(p)}`).join(' · ') +
        '. Bu teorik oranları örneklemle karşılaştır.',
      labText: 'Seriyi ve k bandını değiştir; teorik oranlarla gözlenen oranları karşılaştır.',
      term: '68–95–99,7 kuralı (empirical rule)',
      params: { k: 1 },
    },
    {
      id: 'z-skor',
      title: 'Ortalamadan kaç σ?',
      text: `${f(SINAV_FIXED.x, 0)} alan öğrenci ortalamanın ${f(SINAV_FIXED.z, 2)} standart sapma üstünde; teorik olarak sınıfın ${pct(SINAV_FIXED.phi)}’inden yüksek.`,
      labText: 'x kaydırıcısını değiştir; z-skorunu ve birikimli olasılığı izle.',
      term: 'z-skoru (z-score)',
      params: { seri: 'sinav', x: SINAV_FIXED.x },
    },
    {
      id: 'carpik',
      title: 'Çarpık veride kural tutmaz',
      text: `Çağrı sürelerinde kuyruk sağda: ortalama ${f(c.mean, 1)}, medyan ${f(c.median, 1)}. ±${f(c.band[0].k, 0)}σ içinde örneklemin ${pct(c.band[0].count / c.values.length)}’i var. Dağılım ve çarpıklık sayfasındaki gibi normal eğri veriye uymaz.`,
      labText: 'Seriyi ve k bandını değiştir; histogramın eğriye uyumunu ve gözlenen oranı karşılaştır.',
      params: { seri: 'cagri', k: 1 },
    },
    {
      id: 'olcekleme',
      title: 'z-skoru şekli değiştirmez',
      text: `StandardScaler sonrası ortalama ${f(c.scaled.mean, 0)}, std ${f(c.scaled.std0, 0)}; çarpıklık ${f(c.skew, 2)} → ${f(c.scaled.skew, 2)}. Ölçekleme veriyi normal yapmaz; normal yapmak için dönüşüm (log1p) gerekir.`,
      labText: seriesLab,
      params: { seri: 'cagri' },
    },
  ],
};

/** Alias used by the registry. */
export const normalDagilimScenario = normalScenario;

/** Resolves step ids to indices once, so the control groups below stay in step with the scenario. */
const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(normalScenario, id));

/** Steps where the series select is active. */
export const SERIES_STEPS = indices('histogram', 'egri', 'kural', 'carpik', 'olcekleme');

/** Steps where the mu / sigma sliders are active. */
export const MU_SIGMA_STEPS = indices('mu-sigma');

/** Steps where the a / b interval sliders are active. */
export const AB_STEPS = indices('alan');

/** Steps where the k slider is active. */
export const K_STEPS = indices('kural', 'carpik');

/** Steps where the x slider is active. */
export const X_STEPS = indices('z-skor');

/** Keyboard shortcuts of the page: S switches the series, K cycles the band. */
export function normalShortcuts(player: StepPlayer<NormalParams>): Shortcut[] {
  return [
    {
      keys: ['s', 'S'],
      display: 'S',
      label: 'Seri: sınav / çağrı',
      run: () => {
        if (SERIES_STEPS.includes(player.state.index)) {
          const seri = player.state.params.seri === 'sinav' ? 'cagri' : 'sinav';
          player.setParams({ seri, mu: SERIES[seri].mean, sigma: SERIES[seri].std });
        }
      },
    },
    {
      keys: ['k', 'K'],
      display: 'K',
      label: 'Bant: 1 / 2 / 3',
      run: () => {
        if (K_STEPS.includes(player.state.index)) player.setParam('k', ((player.state.params.k % 3) + 1) as 1 | 2 | 3);
      },
    },
  ];
}
