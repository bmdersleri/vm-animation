import { formatNonZero, formatNumber } from '../../core/plot/format';
import { covariance2, mean, pearson } from '../../core/stats';
import { ANSCOMBE, LEVERAGE, anscombeR, spearman } from './anscombe';
import { HEATMAP, KORELASYON } from './data';
import { korelasyonScenario, type KorelParams } from './scenario';

export interface PanelView {
  id: string;
  points: { x: number; y: number }[];
  stats: string;
  trend: { m: number; b: number } | null;
}

export interface HeatView {
  variables: string[];
  cells: { row: number; col: number; text: string; value: number }[];
}

export interface KorelView {
  stepId: string;
  set: KorelParams['set'];
  panels: PanelView[];
  heat: HeatView | null;
  /** The step's single scatter's Pearson r; NaN on the heat, box and rule steps, which show no single scatter. */
  r: number;
  strip: string;
  note: string;
}

const f3 = (x: number): string => formatNonZero(x, 3);

/** Up to two decimals with trailing zeros trimmed: "12,5", "6", "19". */
function trim(x: number): string {
  return formatNonZero(x, 2).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
}

/** Ordinary least squares through the points: m = cov(x,y) / var(x), b = ȳ − m x̄. */
function fit(points: { x: number; y: number }[]): { m: number; b: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cov = covariance2(xs, ys, 1);
  const m = cov.xy / cov.xx;
  return { m, b: mean(ys) - m * mean(xs) };
}

function panel(id: string, xs: readonly number[], ys: readonly number[], stats: string): PanelView {
  const points = xs.map((x, i) => ({ x, y: ys[i] }));
  return { id, points, stats, trend: fit(points) };
}

function heatView(variables: readonly string[], matrix: readonly (readonly number[])[]): HeatView {
  return {
    variables: [...variables],
    cells: matrix.flatMap((row, rowIndex) => row.map((value, col) => ({
      row: rowIndex,
      col,
      text: f3(value),
      value,
    }))),
  };
}

/** The four panels share one summary line (means, variances, r), as the quartet does. */
const ANSCOMBE_SUMMARY = 'x̄ 9 · ȳ 7,5009 · var 11 / 4,127 · r = 0,816';

const NOTES: readonly string[] = [
  'Noktalar sol alttan sağ üste dizilir; iki değişken birlikte hareket ediyor.',
  'Katsayı ±1 arasındadır: işareti yönü, büyüklüğü ilişkinin gücünü verir.',
  'Korelasyon nedensellik değildir: üçüncü değişken, ters nedensellik ya da rastlantı olabilir.',
  'Isı haritası çok değişkeni tek bakışta tarar; köşegen 1,000 bulgu değildir.',
  'Aynı özet dört farklı örüntüyü gizleyebilir; sayılar tek başına yetmez.',
  'Bir gözlem katsayıyı tek başına taşıyabilir; nokta çıkınca x sabit kalır ve r tanımsız olur.',
  'Pearson yalnız doğrusal ilişkiyi ölçer; grafiğe bakmadan katsayı yorumlanmaz.',
  'Sayısal kodlanmış kategori sürekli ölçüm gibi okunmaz; ısı haritası sayısal sürekli değişkenler içindir.',
  'Test kümesinin dağılımını görmek bilgi sızıntısıdır; keşif eğitimde, doğrulama ayrı kümede yapılır.',
  'Özet istatistik yeterli değildir, grafik şart.',
];

/**
 * Pure derivation of one step's picture: no DOM, no player.
 * Steps 1–3 are one scatter, 4 and 8 the heat matrix, 5–7 the Anscombe panels;
 * 9 and 10 have no panel and the scene draws their boxes and links from `stepId`.
 */
export function deriveKorelView(index: number, p: KorelParams): KorelView {
  const steps = korelasyonScenario.steps;
  const i = Math.max(0, Math.min(steps.length - 1, index));
  const stepId = steps[i].id;
  const study = KORELASYON.rows.map((row) => row[0]);
  const absence = KORELASYON.rows.map((row) => row[1]);
  const grade = KORELASYON.rows.map((row) => row[2]);
  // steps 6 and 7 own their set; the selector (S) enlarges a panel on step 5 and in the Lab
  const set: KorelParams['set'] = stepId === 'kaldirac' ? 4 : stepId === 'dogrusal-degil' ? 2 : p.set;

  let panels: PanelView[] = [];
  let heat: HeatView | null = null;
  let r = NaN;
  let strip = '';

  switch (stepId) {
    case 'iki-degisken':
    case 'korelasyon': {
      r = pearson(study, grade);
      panels = [panel('calisma-not', study, grade, `n = 7 · r = ${f3(r)}`)];
      strip = stepId === 'iki-degisken'
        ? '7 öğrenci · x: çalışma saati · y: sınav notu'
        : `r = cov(x,y) / (σx · σy) = ${f3(r)}`;
      break;
    }
    case 'nedensellik': {
      // the step's pair is absence–grade: r = −0,993, as the book's correlation table says
      r = pearson(grade, absence);
      panels = [panel('not-devamsizlik', grade, absence, `n = 7 · r = ${f3(r)}`)];
      strip = `r = ${f3(r)} · korelasyon ≠ nedensellik`;
      break;
    }
    case 'isi-haritasi': {
      heat = p.churn
        ? heatView(HEATMAP.withChurn.variables, HEATMAP.withChurn.matrix)
        : heatView(HEATMAP.variables, HEATMAP.matrix);
      strip = `${heat.variables.length} değişken · ${heat.cells.length} hücre · köşegen 1,000`;
      break;
    }
    case 'anscombe': {
      panels = ANSCOMBE.map((s) => panel(s.id, s.x, s.y, ANSCOMBE_SUMMARY));
      r = ANSCOMBE[0].r;
      strip = 'aynı özet · dört farklı örüntü';
      break;
    }
    case 'kaldirac': {
      const s = ANSCOMBE[3];
      const ys = [...s.y];
      ys[LEVERAGE.index] = p.noktaY;
      r = anscombeR(3, p.noktaY);
      panels = [panel('IV', s.x, ys, `tek nokta (${formatNumber(LEVERAGE.x, 0)}; ${trim(p.noktaY)}) · r = ${f3(r)}`)];
      strip = `tek nokta y = ${trim(p.noktaY)} · r = ${f3(r)}`;
      break;
    }
    case 'dogrusal-degil': {
      const s = ANSCOMBE[1];
      r = s.r;
      const rho = spearman(s.x, s.y);
      panels = [panel('II', s.x, s.y, `r = ${f3(r)} · Spearman ${f3(rho)}`)];
      strip = `r = ${f3(r)} · Spearman ${f3(rho)} · ilişki eğri`;
      break;
    }
    case 'kategori': {
      heat = heatView(HEATMAP.withChurn.variables, HEATMAP.withChurn.matrix);
      const last = HEATMAP.withChurn.matrix.length - 1;
      const churnR = HEATMAP.withChurn.matrix[last].slice(0, last);
      strip = `5 değişken · ${heat.cells.length} hücre · churn 0/1 → `
        + `${f3(Math.min(...churnR))} … ${f3(Math.max(...churnR))}`;
      break;
    }
    case 'sizinti':
      strip = 'tüm veri üzerinde EDA → test dağılımı görülür (sızıntı) · '
        + 'yalnız eğitim kümesinde EDA → doğrulama temiz';
      break;
    case 'kural':
    default:
      strip = 'Özet istatistik yeterli değildir, grafik şart · '
        + 'kutu-grafigi · iqr-aykiri · pca';
      break;
  }

  return { stepId, set, panels, heat, r, strip, note: NOTES[i] };
}
