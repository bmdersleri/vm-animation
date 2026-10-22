import { formatNumber, formatNonZero, formatTrim } from '../../core/plot/format';
import { histCounts, mean, median, skewness } from '../../core/stats';
import { SERIES, type Seri } from './data';
import { dagilimScenario, EXTREME_STEPS, type DagilimParams } from './scenario';

export interface DagilimView {
  stepId: string;
  seri: Seri;
  values: number[];
  bins: { lo: number; hi: number; count: number }[];
  mean: number;
  median: number;
  skew: number;
  showMean: boolean;
  showMedian: boolean;
  tail: 'right' | 'left' | null;
  log: boolean;
  thresholds: boolean;
  strip: string;
  note: string;
}

/** The only step that drags series 003's last value (shared with the scenario's control guard). */
const EXTREME_STEP = EXTREME_STEPS[0];
/** Steps 3–8 print the mean and median marks. */
const MARK_STEPS: readonly number[] = [2, 3, 4, 5, 6, 7];

const f2 = (x: number): string => formatNonZero(x, 2);

/** Up to two decimals with trailing zeros trimmed: "16,4", "2,79", "8". */
const trim = (x: number): string => formatTrim(x, 2);

/** Skewness text: an exact zero reads "0", every other value keeps two decimals. */
const skewText = (x: number): string => (x === 0 ? '0' : f2(x));

/** The step's values: series 003's last entry becomes `p.extreme`, then `log1p` when asked. */
function valuesOf(seri: Seri, p: DagilimParams, index: number, log: boolean): number[] {
  const raw = SERIES[seri].values;
  const values = index === EXTREME_STEP && seri === '003' ? [...raw.slice(0, -1), p.extreme] : [...raw];
  return log ? values.map((x) => Math.log1p(x)) : values;
}

const NOTES: readonly string[] = [
  'Değerlerin çoğu 8–20 arasında; 25 ve 30 sağda ayrı duruyor.',
  'Dağılımın biçimi ilk kez görünür.',
  'Ortalama sağdaki iki değer yüzünden medyandan 1,9 saat büyük.',
  'Ortalama–medyan farkı tek bir sayıya dönüşür.',
  'Histogramın şekli kova seçimine duyarlıdır; kova sayısı veriyle birlikte yazılmalıdır.',
  'Dönüşüm kuyruğu kısaltır, yönü değiştirmez; her zaman sıfıra indirmez.',
  'Tek gözlem ortalamayı çeker, medyanı çekmez.',
  'Çarpıklığın işareti kuyruğun yönünü, büyüklüğü uzunluğunu verir; simetrikte ortalama = medyan.',
  'Çarpıklık varsa özet olarak medyan + IQR kullan; uç değeri silmeden önce kaynağını incele.',
];

/** Pure derivation of one step's picture: no DOM, no player. */
export function deriveDagilimView(index: number, p: DagilimParams): DagilimView {
  const steps = dagilimScenario.steps;
  const i = Math.max(0, Math.min(steps.length - 1, index));
  const stepId = steps[i].id;
  // step 7 owns series 003: its outlier is the point of the step
  const seri: Seri = stepId === 'kuyruk' ? '003' : p.seri;
  // step 8 always draws raw series: a residual log from step 6 must not survive a step-dot jump
  const logOn = p.log && stepId !== 'uc-sekil';
  const values = valuesOf(seri, p, i, logOn);
  const { edges, counts } = histCounts(values, p.bins);
  const bins = counts.map((count, k) => ({ lo: edges[k], hi: edges[k + 1], count }));
  const mu = mean(values);
  const med = median(values);
  const sk = skewness(values);
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const countsText = counts.join(', ');
  const skewOf = (s: Seri): number => skewness(valuesOf(s, p, -1, false));

  let strip: string;
  switch (stepId) {
    case 'noktalar':
      strip = `n = ${formatNumber(n, 0)} · en düşük ${trim(sorted[0])} · en yüksek ${trim(sorted[n - 1])}`;
      break;
    case 'histogram':
      strip = `bins = ${p.bins} → ${countsText}`;
      break;
    case 'ortalama-medyan':
      strip = `(${trim(sorted[0])} + ${trim(sorted[1])} + … + ${trim(sorted[n - 1])}) / ${n} = ${trim(mu)}; `
        + `ortadaki iki değer (${trim(sorted[n / 2 - 1])} + ${trim(sorted[n / 2])}) / 2 = ${trim(med)}`;
      break;
    case 'carpiklik':
      strip = sk > 0
        ? `çarpıklık = ${skewText(sk)} > 0: sağ kuyruk uzun`
        : sk < 0 ? `çarpıklık = ${skewText(sk)} < 0: sol kuyruk uzun` : 'çarpıklık = 0: iki kuyruk eşit';
      break;
    case 'kova':
      strip = `bins = ${p.bins} → ${countsText}`;
      break;
    case 'log': {
      // both sides describe the *same* series: the raw summary on the left, the log1p one on the right
      const base = SERIES[seri];
      strip = `log1p: çarpıklık ${skewText(base.skew)} → ${skewText(sk)}; `
        + `ortalama ${trim(base.mean)} → ${trim(mu)}`;
      break;
    }
    case 'kuyruk':
      strip = `uç değer ${formatNumber(p.extreme, 0)} → ortalama ${trim(mu)} · medyan ${trim(med)} `
        + `· çarpıklık ${f2(sk)}`;
      break;
    case 'uc-sekil': {
      const right: Seri = p.seri === '003' ? '003' : '002';
      strip = `sağ: ${skewText(skewOf(right))} · simetrik: ${skewText(skewOf('simetrik'))} `
        + `· sol: ${skewText(skewOf('sol'))}`;
      break;
    }
    case 'kural':
    default:
      strip = '|çarpıklık| < 0,5 ≈ simetrik · 0,5–1 orta · > 1 güçlü · çarpıklık varsa özet: medyan + IQR';
      break;
  }

  const tail: DagilimView['tail'] = stepId === 'carpiklik' || stepId === 'uc-sekil'
    ? (sk > 0 ? 'right' : sk < 0 ? 'left' : null)
    : null;

  return {
    stepId,
    seri,
    values,
    bins,
    mean: mu,
    median: med,
    skew: sk,
    showMean: MARK_STEPS.includes(i),
    showMedian: MARK_STEPS.includes(i),
    tail,
    log: logOn,
    thresholds: stepId === 'kural',
    strip,
    note: NOTES[i],
  };
}
