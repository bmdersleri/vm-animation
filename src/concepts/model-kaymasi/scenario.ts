import type { Scenario } from '../../core/player';
import { formatNumber as f, formatTrim } from '../../core/plot/format';
import {
  MONITOR_FROM, accuracyAlarm, accuracyReading, alarmMonths, delayText, detectionDelay, falseAlarms, type AccuracyAlarm,
} from './calc';
import { BUGS, OUTPUT } from './code-text';
import { ALARM_LABELS } from './flow';
import {
  BOOK, CURVES, META, REFERENCE, SCENARIO_IDS, SPREAD_MONTH, monthOf, scenarioById, type ScenarioId,
} from './data';

/** The monitored measure: the monthly mean difference or the PSI. */
export type Metric = 'mean' | 'psi';

/**
 * Parameters of the model drift page: the Lab choices (the threshold of step 3 `esik`, the scenario as an index of
 * `SCENARIO_IDS`, the measure and its threshold, the month of steps 7-8, the debugging-code switch of step 10) and the
 * sweep positions: `today` (step 5) and `scan` (the other sweeps), `SCAN_DONE` once finished.
 */
export interface KaymaParams {
  esik: number;
  scenario: number;
  metric: Metric;
  threshold: number;
  month: number;
  fixed: boolean;
  today: number;
  scan: number;
}

/** The finished value of a sweep (and the default, so a view derived without a sweep shows everything). */
export const SCAN_DONE = Number.POSITIVE_INFINITY;

/** The threshold slider of step 3. */
export const ESIK = { min: 0, max: 20, step: 0.5 } as const;

/** The threshold slider of steps 5-6, per measure; changing the measure brings the new measure's default. */
export const THRESHOLD = {
  mean: { min: 1, max: 20, step: 0.5, def: 8 },
  psi: { min: 0.05, max: 1, step: 0.05, def: 0.25 },
} as const;

/** The thresholds step 6 sweeps. */
export const ORDER_THRESHOLDS: readonly number[] = [4, 8, 12];

/** The thresholds the Lab table of step 6 lists besides the slider's value, per measure. */
export const LAB_TABLE_THRESHOLDS: Record<Metric, readonly number[]> = { mean: [4, 8, 12], psi: [0.1, 0.25, 0.5] };

/** The usual PSI limits (common practice; the book gives none). */
export const PSI_CONVENTION: readonly [number, number] = [0.1, 0.25];

/** Months the Lab month control offers: the monitored months. */
export const LAB_MONTHS = { min: MONITOR_FROM, max: META.months } as const;

/** The scenario of the Lab choice `index` (clamped to the five). */
export function scenarioIdAt(index: number): ScenarioId {
  return SCENARIO_IDS[Math.max(0, Math.min(SCENARIO_IDS.length - 1, Math.round(index)))];
}

/** The monthly values of a scenario for a measure, month 1 first. */
export function valuesOf(id: ScenarioId, metric: Metric): number[] {
  return scenarioById(id).months.map(m => (metric === 'mean' ? m.diff : m.psi));
}

export interface Readout {
  alarms: number[];
  falseAlarms: number;
  delay: number | null;
  acc: AccuracyAlarm | null;
  /** The delay as the page writes it ("—", "kaçırıldı", "N ay"). */
  delayText: string;
  /** The performance alarm as the page writes it on `today`. */
  accuracy: { month: string; known: string };
}

/** The Lab reading panel: alarms, false alarms, detection delay and the performance alarm of a scenario at a threshold, with today at month 24. */
export function readout(id: ScenarioId, metric: Metric, threshold: number): Readout {
  const sc = scenarioById(id);
  const alarms = alarmMonths(valuesOf(id, metric), threshold);
  const delay = detectionDelay(alarms, sc.changeMonth);
  const acc = accuracyAlarm(sc.months.map(m => m.accuracy), REFERENCE.accuracy, META.accMargin, META.labelDelay);
  return {
    alarms,
    falseAlarms: falseAlarms(alarms, sc.changeMonth),
    delay,
    acc,
    delayText: delayText(delay, sc.changeMonth),
    accuracy: accuracyReading(acc, META.months),
  };
}

/** Sentences the step text and the view's strips share, so each is written once. */
export const NOTE_DIFF = 'Mutlak fark yönü değil büyüklüğü ölçer; tek başına bozulmayı kanıtlamaz.';
export const NOTE_INPUT = 'Kitabın üçüncü kodu girdiyi izler: veri kaymasını görür.';
export const NOTE_ADVICE =
  'Başarım etiketi gecikmeli geliyorsa önce girdi kayması, etiket geldiğinde ise hata ve kalibrasyon kayması izlenmelidir.';
export const NOTE_THRESHOLD = 'Eşik; tarihsel dalgalanma, iş riski ve yanlış alarm maliyetiyle belirlenmelidir.';
export const NOTE_TABLE = 'Ortalama farkı: Dağılım biçimini kaçırabilir.';
export const NOTE_SEGMENT = 'Segmentler ayrı izlenir; KS testi bir başka seçenektir.';
export const NOTE_TRAP =
  'Bir uyarı veri kalitesinde geçici bir bozulmayı da işaret edebilir; kaynağı incelenmeden yapılan otomatik yeniden eğitim, hatalı veriyi modele kalıcı olarak öğretebilir.';
/** Lab card of the `kavram` scenario when only the performance alarm fires. */
export const NOTE_CONCEPT = 'Girdi izlemesi kavram kaymasını görmez.';

/** The PSI limits and the caution the book adds, as step 8 and the view's note line write them. */
export function psiNote(): string {
  const [low, high] = PSI_CONVENTION;
  return `${formatTrim(low, 2)} / ${formatTrim(high, 2)} yaygın uygulamadır; kitap sınır vermez. PSI bölme seçimine, örneklem büyüklüğüne ve mevsime duyarlıdır.`;
}

/** A sentence start: the scenario names are lower case. */
const cap = (s: string): string => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

/** The label of a node of the alarm flow as one sentence part. */
const flowWords = (id: keyof typeof ALARM_LABELS): string => ALARM_LABELS[id].join(' ');

const ani = scenarioById('ani');
const yok = scenarioById('yok');
const yavas = scenarioById('yavas');
const spread = monthOf('yayilim', SPREAD_MONTH);
const aniAlarm = readout('ani', 'mean', BOOK.esik).alarms[0];
const refList = `[${BOOK.reference.join(', ')}]`;
const curList = `[${BOOK.current.join(', ')}]`;
const thresholdRows = ORDER_THRESHOLDS.map(t => ({
  falseAlarms: readout('yok', 'mean', t).falseAlarms,
  delay: readout('yavas', 'mean', t).delayText,
}));

/** The step scenario of the model drift page (Ders steps 1-10). */
export const modelKaymasiScenario: Scenario<KaymaParams> = {
  defaults: {
    esik: BOOK.esik,
    scenario: SCENARIO_IDS.indexOf('ani'),
    metric: 'mean',
    threshold: THRESHOLD.mean.def,
    month: SPREAD_MONTH,
    fixed: false,
    today: META.months,
    scan: SCAN_DONE,
  },
  steps: [
    {
      id: 'alti-ay-sonra',
      title: 'Altı ay sonra da çalışacak mı?',
      text: `Kitabın açılış sorusu: "Bu model altı ay sonra da aynı güvenilirlikte çalışacak mı?" Telco Churn bağlamında model, ayrılan müşteriyi aylık ücretten tahmin eder. Ay 1–${META.refMonths} referans dönemidir (model burada eğitildi), ay ${META.refMonths + 1}–${META.months} izlemedir; izlenen öznitelik aylık ücrettir.`,
    },
    {
      id: 'iki-donem',
      title: 'İki dönem',
      text: `Kitabın Şekil 14.2 verisi: referans dönem ${refList} ortalaması ${f(BOOK.refMean, 2)}, güncel dönem ${curList} ortalaması ${f(BOOK.curMean, 2)}. Aylık ücret para birimsiz yazılır; iki ortalama arasındaki mesafe kayma farkıdır.`,
      sweep: { key: 'scan', values: [1, 2], intervalMs: 2500 },
    },
    {
      id: 'fark-esik',
      title: 'Fark ve eşik',
      term: 'kayma eşiği',
      text: `fark = |X̄g − X̄r| = |${f(BOOK.curMean, 2)} − ${f(BOOK.refMean, 2)}| = ${f(BOOK.diff, 2)}. Eşik ${f(BOOK.esik, 1)}: ${f(BOOK.diff, 2)} > ${f(BOOK.esik, 1)}, durum ${BOOK.status}. Kitabın çıktısı: Kayma farkı: ${BOOK.diff.toFixed(2)} | Durum: ${BOOK.status}. ${NOTE_DIFF}`,
      labText: 'Eşik kaydırıcısını oynatın: fark eşiği aşınca rozet UYARI, aşmayınca NORMAL olur.',
    },
    {
      id: 'veri-kavram',
      title: 'Veri kayması ile kavram kayması',
      term: 'kavram kayması',
      text: `${cap(ani.name)} paneli: ücret histogramı değişir, ayrılma eğrisi yerinde kalır (katsayı ${f(REFERENCE.coef, 3)} → ${f(CURVES.ani.coef, 3)}); P(X) değişti, bu veri kaymasıdır. ${cap(scenarioById('kavram').name)} paneli: histogram aynı, eğri döner (katsayı ${f(REFERENCE.coef, 3)} → ${f(CURVES.kavram.coef, 3)}); P(Y | X) değişti, bu kavram kaymasıdır. ${NOTE_INPUT}`,
      labText: 'Senaryoyu seçin: panel seçilen senaryonun ücret histogramını ve ayrılma eğrisini gösterir; değişmeyen senaryoda kaymadan sonraki aylar referansla aynı dağılımdır.',
    },
    {
      id: 'aylik-izleme',
      title: 'Aylık izleme ve etiket gecikmesi',
      text: `${cap(ani.name)} senaryosu, ortalama farkı, eşik ${f(BOOK.esik, 1)}. Bugün imleci ay ${MONITOR_FROM} ile ay ${META.months} arasında yürür: metrik noktası o ay çizilir, doğruluk noktası ${META.labelDelay} ay sonra belirir. Ay ${aniAlarm} alarm verir (fark ${f(monthOf('ani', aniAlarm).diff, 2)}); ay ${MONITOR_FROM} ile ay ${aniAlarm - 1} arasında mevsim dalgası eşiğin altında kalır. ${NOTE_ADVICE}`,
      labText: 'Senaryoyu, ölçüyü ve eşiği seçin: grafik, doğruluk şeridi ve okuma paneli seçime göre yeniden çizilir; bugün sabittir.',
      sweep: { key: 'today', values: Array.from({ length: META.months - MONITOR_FROM + 1 }, (_v, i) => MONITOR_FROM + i), intervalMs: 700 },
    },
    {
      id: 'esik-secimi',
      title: 'Eşiği seçmek',
      text: `${cap(yok.name)} ve ${yavas.name} senaryoları. Eşik ${ORDER_THRESHOLDS.map(t => f(t, 0)).join(' → ')} taranır: ${yok.name} senaryosunda yanlış alarm ${thresholdRows.map(r => r.falseAlarms).join(' / ')}; ${yavas.name} senaryosunda gecikme ${thresholdRows.map(r => r.delay).join(' / ')}. ${NOTE_THRESHOLD} Referans aylarının kendi aylık dalgalanmasının en büyüğü ${f(REFERENCE.maxMonthlyDiff, 2)}.`,
      labText: 'Senaryoyu, ölçüyü ve eşiği değiştirin: okuma paneli yanlış alarmı, gecikmeyi ve başarım alarmını yeniden hesaplar.',
      sweep: { key: 'scan', values: [1, 2, 3], intervalMs: 2500 },
    },
    {
      id: 'ortalama-yaniltir',
      title: 'Ortalama yanıltır',
      text: `${cap(scenarioById('yayilim').name)} senaryosu, ay ${SPREAD_MONTH}: ortalama farkı ${f(spread.diff, 2)}, eşiğin çok altında; ama histogram iki yana açılmıştır, std ${f(REFERENCE.std, 2)} → ${f(spread.std, 2)}. Kitabın tablosu: ${NOTE_TABLE} ${NOTE_SEGMENT}`,
      labText: 'Senaryoyu ve ayı seçin: histogram çifti ve iki sayı kutusu seçime göre yeniden çizilir.',
    },
    {
      id: 'psi',
      title: 'PSI',
      term: 'PSI (population stability index)',
      text: `Aynı ay: PSI = Σ (qᵢ − pᵢ) ln(qᵢ / pᵢ). Bölmeler referansın onda birlikleri (pᵢ ≈ ${f(1 / REFERENCE.psiCounts.length, 1)}); ${REFERENCE.psiCounts.length} çubuk tek tek dolar, toplam ${f(spread.psi, 3)}. ${psiNote()}`,
      labText: 'Senaryoyu ve ayı seçin: çubuklar, formül şeridi ve PSI toplamı seçilen aya göre yeniden hesaplanır.',
      sweep: { key: 'scan', values: Array.from({ length: REFERENCE.psiCounts.length }, (_v, i) => i + 1), intervalMs: 700 },
    },
    {
      id: 'alarm-akisi',
      title: 'Alarm bir emir değildir',
      text: `Akış (Şekil 14.4): ${flowWords('izleme')} → "${flowWords('esik')}" → ${flowWords('alarm')} → ${flowWords('inceleme')} → "${flowWords('neden')}" → veri kalitesi / mevsimsellik / gerçek davranış değişimi / adillik veya gizlilik → izlemeye dönüş. Tarama ${ani.name} senaryosunun ay ${aniAlarm} alarmını gerçek davranış değişimi dalından geçirir. ${NOTE_TRAP}`,
      sweep: { key: 'scan', values: [1, 2, 3, 4, 5, 6], intervalMs: 1600 },
    },
    {
      id: 'hata-ayiklama',
      title: 'Hata ayıklama',
      text: `Kitabın HataAyiklama kodunda ${BUGS.length} hata sırayla işaretlenir (${BUGS.map(b => b.kind).join(', ')}); ilk hatada program TypeError ile durur, sonuncusu kod hatası değil tasarım eksiğidir. Düzeltilmiş kod ${OUTPUT.map(o => `"${o}"`).join(' ve ')} yazar. Ders sonu bağlantıları: crisp-dm (Bölüm 1, yaygınlaştırma) ve shap-degerleri (Bölüm 13).`,
      labText: 'Düzeltilmiş kodu göster anahtarıyla hatalı ve düzeltilmiş kod arasında geçin.',
      sweep: { key: 'scan', values: [1, 2, 3, 4, 5], intervalMs: 1800 },
    },
  ],
};
