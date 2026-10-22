import { formatNonZero, formatNumber, formatTrim } from '../../core/plot/format';
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
  /**
   * The step's single scatter's Pearson r; NaN where the step shows no single
   * coefficient: step 1 (r arrives on step 2), the heat, box and rule steps.
   */
  r: number;
  strip: string;
  note: string;
}

const f3 = (x: number): string => formatNonZero(x, 3);
/** Example 006's row count: the heat strips name n (spec red line on small samples). */
const HEAT_N = HEATMAP.rows.length;

/** Up to two decimals with trailing zeros trimmed: "12,5", "6", "19". */
const trim = (x: number): string => formatTrim(x, 2);

/** Ordinary least squares through the points: m = cov(x,y) / var(x), b = ȳ − m x̄. */
function fit(points: { x: number; y: number }[]): { m: number; b: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cov = covariance2(xs, ys, 1);
  const m = cov.xy / cov.xx;
  return { m, b: mean(ys) - m * mean(xs) };
}

function panel(
  id: string,
  xs: readonly number[],
  ys: readonly number[],
  stats: string,
  withTrend = true,
): PanelView {
  const points = xs.map((x, i) => ({ x, y: ys[i] }));
  return { id, points, stats, trend: withTrend ? fit(points) : null };
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

/**
 * The four panels share one summary line, derived from the quartet and marked
 * approximate: `≈` carries set III's variance (4,12262, 0,0074 below the printed
 * 4,13) and set IV's r (0,8165214, 0,00052 above the printed 0,816); the line
 * stays within 0,01 of every variance and 0,001 of every r.
 */
export const ANSCOMBE_SUMMARY: string = (() => {
  const avg = (pick: (s: (typeof ANSCOMBE)[number]) => number): number =>
    mean(ANSCOMBE.map(pick));
  // thin spaces (U+2009) around ≈ keep the glyph from crowding its neighbours at panel width
  const approx = ' ≈ ';
  return `x̄${approx}${trim(avg((s) => s.meanX))} · ȳ${approx}${trim(avg((s) => s.meanY))} `
    + `· var${approx}${trim(avg((s) => s.varX))} / ${trim(avg((s) => s.varY))} `
    + `· r${approx}${f3(avg((s) => s.r))}`;
})();

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
  // the set selector (S) is live on steps 6–7: the chosen set is the enlarged panel
  const set: KorelParams['set'] = p.set;

  let panels: PanelView[] = [];
  let heat: HeatView | null = null;
  let r = NaN;
  let strip = '';

  switch (stepId) {
    case 'iki-degisken': {
      // step 1 shows the points only: step 2 adds the trend line and the coefficient
      panels = [panel('calisma-not', study, grade, 'n = 7 öğrenci', false)];
      strip = '7 öğrenci · x: çalışma saati · y: sınav notu';
      break;
    }
    case 'korelasyon': {
      r = pearson(study, grade);
      panels = [panel('calisma-not', study, grade, `n = 7 · r = ${f3(r)}`)];
      strip = `r = cov(x,y) / (σx · σy) = ${f3(r)}`;
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
      strip = `n = ${HEAT_N} · ${heat.variables.length} değişken · ${heat.cells.length} hücre · köşegen 1,000`;
      break;
    }
    case 'anscombe': {
      panels = ANSCOMBE.map((s) => panel(s.id, s.x, s.y, ANSCOMBE_SUMMARY));
      r = ANSCOMBE[0].r;
      strip = 'aynı özet · dört farklı örüntü';
      break;
    }
    case 'kaldirac': {
      if (set === 4) {
        // only set IV's 7. index is a leverage point: it moves with `noktaY`
        const s = ANSCOMBE[3];
        const ys = [...s.y];
        ys[LEVERAGE.index] = p.noktaY;
        r = anscombeR(3, p.noktaY);
        panels = [panel('IV', s.x, ys, `tek nokta (${formatNumber(LEVERAGE.x, 0)}; ${trim(p.noktaY)}) · r = ${f3(r)}`)];
        strip = `tek nokta y = ${trim(p.noktaY)} · r = ${f3(r)}`;
      } else {
        const s = ANSCOMBE[set - 1];
        r = s.r;
        panels = [panel(s.id, s.x, s.y, `set ${s.id} · r = ${f3(r)}`)];
        strip = `set ${s.id} · kaldıraç yok · r = ${f3(r)}`;
      }
      break;
    }
    case 'dogrusal-degil': {
      const s = ANSCOMBE[set - 1];
      r = s.r;
      const rho = spearman(s.x, s.y);
      panels = [panel(s.id, s.x, s.y, `set ${s.id} · r = ${f3(r)} · Spearman ${f3(rho)}`)];
      strip = set === 2
        ? `r = ${f3(r)} · Spearman ${f3(rho)} · ilişki eğri`
        : `set ${s.id} · r = ${f3(r)} · Spearman ${f3(rho)}`;
      break;
    }
    case 'kategori': {
      heat = p.churn
        ? heatView(HEATMAP.withChurn.variables, HEATMAP.withChurn.matrix)
        : heatView(HEATMAP.variables, HEATMAP.matrix);
      if (p.churn) {
        const last = HEATMAP.withChurn.matrix.length - 1;
        const churnR = HEATMAP.withChurn.matrix[last].slice(0, last);
        strip = `n = ${HEAT_N} · 5 değişken · ${heat.cells.length} hücre · churn 0/1 → `
          + `${f3(Math.min(...churnR))} … ${f3(Math.max(...churnR))}`;
      } else {
        strip = `n = ${HEAT_N} · 4 değişken · ${heat.cells.length} hücre · köşegen 1,000 · churn kapalı`;
      }
      break;
    }
    case 'sizinti':
      strip = 'tüm veri üzerinde EDA → test dağılımı görülür (sızıntı) · '
        + 'yalnız eğitim kümesinde EDA → doğrulama temiz';
      break;
    case 'kural':
    default:
      strip = 'Özet istatistik yeterli değildir, grafik şart · '
        + 'kutu-grafigi · iqr-aykiri · pca'
        + '\nküçük örneklem (n = 6–11): r tek gözlemle dalgalanır';
      break;
  }

  return { stepId, set, panels, heat, r, strip, note: NOTES[i] };
}
