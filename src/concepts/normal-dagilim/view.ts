import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { mean, median, normCdf, normPdf, skewness, std } from '../../core/stats';
import { SERIES, type Seri } from './data';
import { normalScenario, type NormalParams } from './scenario';

/** Everything the scene draws for one step and parameter set. */
export interface NormalView {
  stepId: string;
  seri: Seri;
  values: number[];
  domain: [number, number];
  bins: { lo: number; hi: number; count: number; density: number }[];
  mean: number;
  median: number;
  std: number;
  skew: number;
  curve: { mu: number; sigma: number } | null;
  ghosts: { sigma: number }[];
  area: { a: number; b: number; p: number; count: number } | null;
  bands: { k: number; lo: number; hi: number; theory: number; sample: number }[];
  zAxis: boolean;
  marker: { x: number; z: number; phi: number } | null;
  scaled: boolean;
  links: { href: string; label: string }[];
  strip: string;
  note: string;
}

/** Derives the view (bins, curves, bands, marks, labels, links) for step `index` with parameters `p`. */
export function deriveNormalView(index: number, p: NormalParams): NormalView {
  const stepId = normalScenario.steps[Math.max(0, Math.min(7, index))].id;
  const forced = ['mu-sigma', 'alan', 'z-skor'].includes(stepId);
  const seri: Seri = forced ? 'sinav' : p.seri;
  const source = SERIES[seri];
  const scaled = stepId === 'olcekleme';
  const populationStd = std(source.values, 0);
  const tx = (x: number): number => (scaled ? (x - source.mean) / populationStd : x);
  const values = source.values.map(tx);
  const mRaw = mean(values),
    m = Math.abs(mRaw) < 1e-12 ? 0 : mRaw,
    med = median(values),
    sd = std(values, scaled ? 0 : 1),
    sk = skewness(values);
  const mu = stepId === 'mu-sigma' ? p.mu : m,
    sigma = stepId === 'mu-sigma' ? p.sigma : sd;
  const bins = source.counts.map((count, i) => {
    const lo = tx(source.edges[i]),
      hi = tx(source.edges[i + 1]);
    return { lo, hi, count, density: count / (values.length * (hi - lo)) };
  });
  const a = Math.min(p.a, p.b),
    b = Math.max(p.a, p.b);
  const area = a === b ? 0 : normCdf(b, mu, sigma) - normCdf(a, mu, sigma);
  const count = a === b ? 0 : values.filter((x) => x >= a && x <= b).length;
  const z = (p.x - mu) / sigma,
    phi = normCdf(p.x, mu, sigma);
  const bands = [1, 2, 3].map((k) => {
    const lo = mu - k * sigma,
      hi = mu + k * sigma;
    const count = values.filter((x) => x >= lo && x <= hi).length;
    return { k, lo, hi, count, theoretical: normCdf(k, 0, 1) - normCdf(-k, 0, 1), empirical: count / values.length };
  });
  let strip = '';
  switch (stepId) {
    case 'histogram':
      strip = `n = ${f(values.length, 0)} · ortalama = ${f(m, 1)} · medyan = ${f(med, 1)} · std = ${f(sd, 1)}`;
      break;
    case 'egri':
      strip = `f(x) = 1 / (σ√(2π)) · e^(−(x − μ)² / (2σ²)) · μ = ${f(mu, 1)} · σ = ${f(sigma, 1)}`;
      break;
    case 'mu-sigma':
      strip = `μ = ${f(mu, 1)} · σ = ${f(sigma, 1)} · tepe = 1 / (σ√(2π)) = ${f(normPdf(mu, mu, sigma), 3)}`;
      break;
    case 'alan':
      strip = `P(${f(a, 1)} ≤ X ≤ ${f(b, 1)}) = ${f(area, 3)} · örneklem ${f(count, 0)} / ${f(values.length, 0)} (${pct(count / values.length)})`;
      break;
    case 'kural':
      strip = bands.map((t) => `±${f(t.k, 0)}σ: ${pct(t.theoretical)} (örneklem ${pct(t.empirical)})`).join(' · ');
      break;
    case 'z-skor':
      strip = `z = (${f(p.x, 1)} − ${f(mu, 1)}) / ${f(sigma, 1)} = ${f(z, 2)} · Φ(z) = ${f(phi, 3)}`;
      break;
    case 'carpik': {
      const band = bands[p.k - 1];
      strip = `çarpıklık = ${f(sk, 2)} · ±${f(p.k, 0)}σ: örneklem ${pct(band.empirical)} (normalde ${pct(band.theoretical)}) · ortalama ${f(m, 1)} > medyan ${f(med, 1)}`;
      break;
    }
    case 'olcekleme':
      strip = `StandardScaler: ortalama ${f(source.mean, 1)} → ${f(m, 0)} · std ${f(populationStd, 1)} → ${f(sd, 0)} · çarpıklık ${f(source.skew, 2)} → ${f(sk, 2)}`;
      break;
  }
  const notes: Record<string, string> = {
    histogram: 'Yoğunluk: sayı / (n × kova genişliği); toplam histogram alanı birdir.',
    egri: 'Eğrinin yüksekliği olasılık değildir; tek noktanın olasılığı sıfırdır.',
    'mu-sigma': 'Histogram referans olarak yerinde kalır; yalnız normal eğri değişir.',
    alan: 'Sınırlar ters seçilirse küçükten büyüğe okunur; eşit sınırların alanı sıfırdır.',
    kural: 'Kural normale yakın veriler içindir. Q–Q grafiği bir denetimdir.',
    'z-skor': '|z| > 3 kaba bir aykırılık işaretidir; çarpık veride IQR daha dayanıklıdır.',
    carpik: 'Normal eğri negatif sürelere de alan verir; çağrı süresi negatif olamaz.',
    olcekleme: 'pandas std(): ddof = 1; StandardScaler: ddof = 0. Ölçekleme şekli değiştirmez.',
  };
  return {
    stepId,
    seri,
    values,
    domain: [tx(source.domain[0]), tx(source.domain[1])],
    bins,
    mean: m,
    median: med,
    std: sd,
    skew: sk,
    curve: stepId === 'histogram' ? null : { mu, sigma },
    ghosts: stepId === 'mu-sigma' ? [{ sigma: 5 }, { sigma: 15 }] : [],
    area: stepId === 'alan' ? { a, b, p: area, count } : null,
    bands: ['kural', 'carpik'].includes(stepId)
      ? bands.map((t) => ({ k: t.k, lo: t.lo, hi: t.hi, theory: t.theoretical, sample: t.empirical }))
      : [],
    zAxis: ['z-skor', 'carpik', 'olcekleme'].includes(stepId),
    marker: stepId === 'z-skor' ? { x: p.x, z, phi } : null,
    scaled,
    links: scaled
      ? [
          { href: '../dagilim-carpiklik/', label: 'Dağılım ve çarpıklık' },
          { href: '../olcekleme/', label: 'Ölçekleme ve veri sızıntısı' },
          { href: '../naive-bayes/', label: 'Naive Bayes' },
        ]
      : [],
    strip,
    note: notes[stepId],
  };
}
