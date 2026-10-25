import { formatNumber as f } from '../../core/plot/format';
import type { CodeBug, CodeLine } from '../../core/plot/code-panel';
import type { FlowGraphSpec, FlowNode } from '../../core/plot/flow-graph';
import { MONITOR_FROM, meanDiff, psiTerms, shares, status } from './calc';
import { BUGGY_CODE, BUGS, FIXED_CODE, OUTPUT, RUN_ERROR } from './code-text';
import {
  BOOK, CURVES, META, REFERENCE, SPREAD_MONTH, monthOf, scenarioById, type ScenarioId,
} from './data';
import { ALARM_EDGES, ALARM_IDS, ALARM_LABELS, ALARM_PATH, type AlarmId } from './flow';
import {
  ESIK, LAB_MONTHS, LAB_TABLE_THRESHOLDS, NOTE_ADVICE, NOTE_CONCEPT, NOTE_DIFF, NOTE_NOISE, NOTE_INPUT, NOTE_SEGMENT, NOTE_TABLE, NOTE_THRESHOLD, NOTE_TRAP,
  ORDER_THRESHOLDS, SCAN_DONE, THRESHOLD, modelKaymasiScenario as scenario, psiNote, readout, scenarioIdAt, valuesOf,
  type KaymaParams, type Metric, type Readout,
} from './scenario';

export { readout };

/** Which scene the stage shows. */
export type KaymaKind = 'timeline' | 'line' | 'drift' | 'monitor' | 'spread' | 'psi' | 'flow' | 'code';

export interface TimelineView {
  months: number;
  refMonths: number;
}

/** Steps 2-3: the two periods' monthly fees, their means and (step 3) the threshold with its badge. */
export interface LineView {
  ref: number[];
  cur: number[];
  refMean: number;
  curMean: number;
  diff: number;
  /** Null in step 2, which has no threshold yet. */
  esik: number | null;
  status: 'UYARI' | 'NORMAL' | null;
  /** False while the sweep shows the reference period alone. */
  showCurrent: boolean;
}

export interface CurveView {
  coef: number;
  intercept: number;
}

/** One panel of step 4: the fee histogram (reference against the months from the curve window on) above the churn curve. */
export interface DriftPanel {
  scenario: ScenarioId;
  name: string;
  /** What kind of change it is: "kayma yok", "veri kayması", "kavram kayması". */
  verdict: string;
  /** Shares of the 22 screen bins, reference and current window. */
  refShare: number[];
  curShare: number[];
  refCurve: CurveView;
  curCurve: CurveView;
  coefText: { ref: string; cur: string };
}

export interface DriftView {
  panels: DriftPanel[];
  /** The months the "current" histogram and the refitted curve come from. */
  window: { from: number; to: number };
}

export interface AccuracyPoint {
  month: number;
  value: number;
  /** True once the labels of the month have arrived (month + label delay <= today). */
  known: boolean;
}

export interface MonitorSeries {
  scenario: ScenarioId;
  name: string;
  changeMonth: number | null;
  /** The monthly measure, month 1 first. */
  values: number[];
  /** Months of the measure drawn: up to today. */
  shown: number;
  /** Alarm months up to today. */
  alarms: number[];
  accuracy: AccuracyPoint[];
  /** The performance alarm of the whole series, and whether its label has arrived by today. */
  accAlarm: { month: number; knownAt: number } | null;
  accAlarmShown: boolean;
}

export interface ThresholdRow {
  threshold: number;
  falseAlarms: number;
  delay: string;
  current: boolean;
}

/** The threshold table of step 6: three column heads and one row per threshold. */
export interface ThresholdTable {
  heads: [string, string, string];
  rows: ThresholdRow[];
}

export interface MonitorView {
  metric: Metric;
  threshold: number;
  today: number;
  /** The reference period's own monthly fluctuation: 0 up to its largest value. */
  refBand: { lo: number; hi: number };
  /** Accuracy below this value is a performance alarm. */
  accThreshold: number;
  refAccuracy: number;
  /** The first series is the main one (the accuracy strip follows it); step 6 adds a second. */
  series: MonitorSeries[];
  /** The Lab reading panel; null in Ders. */
  readout: Readout | null;
  note: string | null;
}

export interface SpreadView {
  scenario: ScenarioId;
  name: string;
  month: number;
  refShare: number[];
  curShare: number[];
  boxes: { label: string; value: string }[];
}

export interface PsiBar {
  bin: number;
  p: number;
  q: number;
  term: number;
  empty: boolean;
  /** True once the sweep has reached this bar. */
  shown: boolean;
}

export interface PsiView {
  scenario: ScenarioId;
  month: number;
  bars: PsiBar[];
  shown: number;
  total: number;
  /** The footnote of an empty bin shown so far, else null. */
  footnote: string | null;
}

export interface CodeCard {
  faulty: readonly CodeLine[];
  fixedLines: readonly CodeLine[];
  bugs: readonly CodeBug[];
  marked: number;
  fixed: boolean;
  output: string[] | null;
  /** The message the faulty program stops with, under the code panel. */
  error: string | null;
}

export interface KaymaView {
  stepId: string;
  kind: KaymaKind;
  lab: boolean;
  /** The formula or book sentence on the strip under the stage. */
  strip: string;
  note: string | null;
  timeline?: TimelineView;
  line?: LineView;
  drift?: DriftView;
  monitor?: MonitorView;
  table?: ThresholdTable;
  spread?: SpreadView;
  psi?: PsiView;
  graph?: FlowGraphSpec;
  code?: CodeCard;
}

const stepId = (index: number): string => scenario.steps[index].id;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const clampStage = (scan: number, n: number): number => clamp(Math.floor(scan), 1, n);

/** The threshold the chart of step `index` draws: the sweep in Ders step 6, the book's 8,0 in Ders step 5, the slider in the Lab. */
export function shownThreshold(index: number, p: KaymaParams, lab: boolean): number {
  const id = stepId(index);
  if (lab) {
    return id === 'fark-esik' ? clamp(p.esik, ESIK.min, ESIK.max) : clamp(p.threshold, THRESHOLD[p.metric].min, THRESHOLD[p.metric].max);
  }
  if (id === 'esik-secimi') {
    return ORDER_THRESHOLDS[clampStage(p.scan, ORDER_THRESHOLDS.length) - 1];
  }
  return BOOK.esik;
}

const CODE03_LINES = ['return abs(mean(referans_degerler) - mean(guncel_degerler))', 'durum = "UYARI" if fark > esik else "NORMAL"'];

function lineView(id: string, p: KaymaParams, esik: number | null): KaymaView {
  const diff = meanDiff(BOOK.reference, BOOK.current);
  const showCurrent = id === 'fark-esik' || clampStage(p.scan, 2) >= 2;
  const view: LineView = {
    ref: BOOK.reference,
    cur: BOOK.current,
    refMean: BOOK.refMean,
    curMean: BOOK.curMean,
    diff,
    esik,
    status: esik === null ? null : status(diff, esik),
    showCurrent,
  };
  if (esik === null) {
    return { stepId: id, kind: 'line', lab: false, strip: CODE03_LINES.join('\n'), note: null, line: view };
  }
  const verdict = view.status!;
  const strip = `fark = |X̄g − X̄r| = |${f(BOOK.curMean, 2)} − ${f(BOOK.refMean, 2)}| = ${f(diff, 2)} ${diff > esik ? '>' : '≤'} ${f(esik, 1)} → ${verdict}`;
  return { stepId: id, kind: 'line', lab: false, strip, note: NOTE_DIFF, line: view };
}

const VERDICT: Record<ScenarioId, string> = {
  yok: 'kayma yok',
  ani: 'veri kayması',
  yavas: 'veri kayması',
  yayilim: 'veri kayması',
  kavram: 'kavram kayması',
};

/** The curve window starts where the sudden shift does (the generator refits the curves on these months). */
const CURVE_FROM = scenarioById('ani').changeMonth!;

function driftPanel(id: ScenarioId): DriftPanel {
  const sc = scenarioById(id);
  const cur = new Array<number>(REFERENCE.hist.length).fill(0);
  for (const m of sc.months.slice(CURVE_FROM - 1)) {
    m.hist.forEach((c, i) => {
      cur[i] += c;
    });
  }
  return {
    scenario: id,
    name: sc.name,
    verdict: VERDICT[id],
    refShare: shares(REFERENCE.hist),
    curShare: shares(cur),
    refCurve: { coef: REFERENCE.coef, intercept: REFERENCE.intercept },
    curCurve: { coef: CURVES[id].coef, intercept: CURVES[id].intercept },
    coefText: { ref: f(REFERENCE.coef, 3), cur: f(CURVES[id].coef, 3) },
  };
}

function driftView(id: string, ids: ScenarioId[]): KaymaView {
  return {
    stepId: id,
    kind: 'drift',
    lab: false,
    strip: NOTE_INPUT,
    note: null,
    drift: { panels: ids.map(driftPanel), window: { from: CURVE_FROM, to: META.months } },
  };
}

function refBandHi(metric: Metric): number {
  if (metric === 'mean') {
    return REFERENCE.maxMonthlyDiff;
  }
  return Math.max(...valuesOf('yok', 'psi').slice(0, META.refMonths));
}

function seriesOf(id: ScenarioId, metric: Metric, threshold: number, today: number): MonitorSeries {
  const sc = scenarioById(id);
  const r = readout(id, metric, threshold);
  return {
    scenario: id,
    name: sc.name,
    changeMonth: sc.changeMonth,
    values: valuesOf(id, metric),
    shown: today,
    alarms: r.alarms.filter(m => m <= today),
    accuracy: sc.months.map(m => ({ month: m.month, value: m.accuracy, known: m.month + META.labelDelay <= today })),
    accAlarm: r.acc,
    accAlarmShown: r.acc !== null && r.acc.knownAt <= today,
  };
}

function monitorOf(ids: ScenarioId[], metric: Metric, threshold: number, today: number, lab: boolean): MonitorView {
  const series = ids.map(id => seriesOf(id, metric, threshold, today));
  const main = readout(ids[0], metric, threshold);
  const concept = lab && ids[0] === 'kavram' && main.alarms.length === 0 && main.acc !== null;
  // with no change month, a performance alarm can only be sampling noise
  const noise = lab && scenarioById(ids[0]).changeMonth === null && main.acc !== null;
  let note: string | null = null;
  if (concept) {
    note = NOTE_CONCEPT;
  } else if (noise) {
    note = NOTE_NOISE;
  }
  return {
    metric,
    threshold,
    today,
    refBand: { lo: 0, hi: refBandHi(metric) },
    accThreshold: REFERENCE.accuracy - META.accMargin,
    refAccuracy: REFERENCE.accuracy,
    series,
    readout: lab ? main : null,
    note,
  };
}

/** Lab table of step 6: the usual thresholds of the measure and the slider's value, for the chosen scenario. */
function labTable(chosen: ScenarioId, metric: Metric, threshold: number): ThresholdTable {
  const list = new Set<number>([...LAB_TABLE_THRESHOLDS[metric], threshold]);
  const rows = [...list].sort((a, b) => a - b).map(t => {
    const r = readout(chosen, metric, t);
    return { threshold: t, falseAlarms: r.falseAlarms, delay: r.delayText, current: t === threshold };
  });
  return { heads: ['Eşik', 'Yanlış alarm', 'Gecikme'], rows };
}

function monitorView(id: string, p: KaymaParams, lab: boolean): KaymaView {
  const strip = id === 'esik-secimi' ? NOTE_THRESHOLD : NOTE_ADVICE;
  if (lab) {
    const metric = p.metric;
    const threshold = shownThreshold(scenario.steps.findIndex(s => s.id === id), p, true);
    const chosen = scenarioIdAt(p.scenario);
    const monitor = monitorOf([chosen], metric, threshold, META.months, true);
    const view: KaymaView = { stepId: id, kind: 'monitor', lab: true, strip, note: monitor.note, monitor };
    if (id === 'esik-secimi') {
      view.table = labTable(chosen, metric, threshold);
    }
    return view;
  }
  if (id === 'aylik-izleme') {
    const today = clamp(Math.floor(p.today), MONITOR_FROM, META.months);
    const monitor = monitorOf(['ani'], 'mean', BOOK.esik, today, false);
    return { stepId: id, kind: 'monitor', lab: false, strip, note: null, monitor };
  }
  const stage = clampStage(p.scan, ORDER_THRESHOLDS.length);
  const threshold = ORDER_THRESHOLDS[stage - 1];
  const monitor = monitorOf(['yok', 'yavas'], 'mean', threshold, META.months, false);
  const yok = scenarioById('yok');
  const yavas = scenarioById('yavas');
  const rows = ORDER_THRESHOLDS.map(t => ({
    threshold: t,
    falseAlarms: readout('yok', 'mean', t).falseAlarms,
    delay: readout('yavas', 'mean', t).delayText,
    current: t === threshold,
  }));
  const heads: ThresholdTable['heads'] = ['Eşik', `Yanlış alarm (${yok.name})`, `Gecikme (${yavas.name})`];
  return { stepId: id, kind: 'monitor', lab: false, strip, note: null, monitor, table: { heads, rows } };
}

function spreadView(id: string, scenarioId: ScenarioId, month: number, lab: boolean): KaymaView {
  const m = monthOf(scenarioId, month);
  const spread: SpreadView = {
    scenario: scenarioId,
    name: scenarioById(scenarioId).name,
    month,
    refShare: shares(REFERENCE.hist),
    curShare: shares(m.hist),
    boxes: [
      { label: 'Ortalama farkı', value: f(m.diff, 2) },
      { label: 'Standart sapma', value: `${f(REFERENCE.std, 2)} → ${f(m.std, 2)}` },
    ],
  };
  return { stepId: id, kind: 'spread', lab, strip: NOTE_TABLE, note: NOTE_SEGMENT, spread };
}

/**
 * The PSI bars of `counts` (a current histogram of the ten reference bins, `n` values) with the first `shown` bars
 * reached by the sweep. An empty count raises q to the floor and marks the bar `empty` (the scene writes "q = 0").
 */
export function psiFromCounts(scenarioId: ScenarioId, month: number, counts: readonly number[], shown = counts.length, n = META.perMonth): PsiView {
  const terms = psiTerms(counts, n, REFERENCE.psiCounts, REFERENCE.n);
  const count = clamp(shown, 0, terms.length);
  const total = terms.reduce((a, t) => a + t.term, 0);
  const bars: PsiBar[] = terms.map((t, i) => ({ bin: i + 1, ...t, shown: i < count }));
  const hasEmpty = bars.some(b => b.shown && b.empty);
  return {
    scenario: scenarioId,
    month,
    bars,
    shown: count,
    total,
    footnote: hasEmpty ? `q = 0 olan bölmede q ${f(META.psiFloor, 4)} alınır` : null,
  };
}

function psiView(id: string, scenarioId: ScenarioId, month: number, scan: number, lab: boolean): KaymaView {
  const m = monthOf(scenarioId, month);
  const shown = lab ? m.psiCounts.length : clampStage(scan, m.psiCounts.length);
  const psi = psiFromCounts(scenarioId, month, m.psiCounts, shown);
  const sum = psi.bars.slice(0, shown).map(b => f(b.term, 3)).join(' + ');
  const strip = `PSI = Σ (qᵢ − pᵢ) ln(qᵢ / pᵢ) = ${sum}${shown < psi.bars.length ? ' + …' : ` = ${f(psi.total, 3)}`}`;
  return { stepId: id, kind: 'psi', lab, strip, note: psiNote(), psi };
}

function flowView(id: string, scan: number): KaymaView {
  const stage = clampStage(scan, ALARM_PATH.length);
  const edge = ALARM_EDGES.find(e => e.id === ALARM_PATH[stage - 1])!;
  const nodes: FlowNode[] = ALARM_IDS.map(nodeId => ({
    id: nodeId,
    label: ALARM_LABELS[nodeId as AlarmId],
    kind: nodeId === 'esik' || nodeId === 'neden' ? 'decision' : 'phase',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));
  const graph: FlowGraphSpec = {
    nodes,
    edges: ALARM_EDGES.map(e => ({ ...e })),
    current: edge.to,
    path: ALARM_PATH.slice(0, stage),
    token: { at: edge.to, via: edge.id },
  };
  return { stepId: id, kind: 'flow', lab: false, strip: NOTE_TRAP, note: null, graph };
}

function codeView(id: string, marked: number, fixed: boolean, lab: boolean): KaymaView {
  const bug = BUGS[marked - 1];
  const code: CodeCard = {
    faulty: BUGGY_CODE,
    fixedLines: FIXED_CODE,
    bugs: BUGS,
    marked,
    fixed,
    output: fixed ? [...OUTPUT] : null,
    error: fixed ? null : RUN_ERROR,
  };
  const strip = fixed ? OUTPUT.join(' · ') : lab ? `${BUGS.length} hata işaretli` : `hata ${bug.n} / ${BUGS.length} · ${bug.kind} · ${bug.what}`;
  return { stepId: id, kind: 'code', lab, strip, note: null, code };
}

/** The Ders story (fixed scenarios, months and thresholds, the step's sweep) for any step. */
function storyView(index: number, p: KaymaParams): KaymaView {
  const id = stepId(index);
  switch (id) {
    case 'alti-ay-sonra':
      return {
        stepId: id,
        kind: 'timeline',
        lab: false,
        strip: `Model ay 1–${META.refMonths} verisiyle eğitildi; ay ${META.refMonths + 1}–${META.months} izlenir.`,
        note: null,
        timeline: { months: META.months, refMonths: META.refMonths },
      };
    case 'iki-donem':
      return lineView(id, p, null);
    case 'fark-esik':
      return lineView(id, p, BOOK.esik);
    case 'veri-kavram':
      return driftView(id, ['ani', 'kavram']);
    case 'aylik-izleme':
    case 'esik-secimi':
      return monitorView(id, p, false);
    case 'ortalama-yaniltir':
      return spreadView(id, 'yayilim', SPREAD_MONTH, false);
    case 'psi':
      return psiView(id, 'yayilim', SPREAD_MONTH, p.scan, false);
    case 'alarm-akisi':
      return flowView(id, p.scan);
    default: {
      const stage = clampStage(p.scan, BUGS.length + 1);
      return codeView(id, Math.min(stage, BUGS.length), stage > BUGS.length, false);
    }
  }
}

/** Lab steps with controls: the view of the chosen scenario, measure, threshold and month, with finished sweeps. */
function labView(index: number, p: KaymaParams): KaymaView | null {
  const id = stepId(index);
  const scenarioId = scenarioIdAt(p.scenario);
  const month = clamp(Math.round(p.month), LAB_MONTHS.min, LAB_MONTHS.max);
  switch (id) {
    case 'fark-esik':
      return { ...lineView(id, p, shownThreshold(index, p, true)), lab: true };
    case 'veri-kavram':
      return { ...driftView(id, [scenarioId]), lab: true };
    case 'aylik-izleme':
    case 'esik-secimi':
      return monitorView(id, p, true);
    case 'ortalama-yaniltir':
      return spreadView(id, scenarioId, month, true);
    case 'psi':
      return psiView(id, scenarioId, month, SCAN_DONE, true);
    case 'hata-ayiklama':
      return codeView(id, BUGS.length, p.fixed, true);
    default:
      return null;
  }
}

/**
 * The view of step `index`. Ders (`lab` false) walks the fixed story and the step's sweep (`p.scan`, `p.today`) and
 * ignores the Lab choices; the Lab draws the steps with controls for the chosen options with finished sweeps.
 */
export function deriveKaymaView(index: number, p: KaymaParams, lab = false): KaymaView {
  if (!lab) {
    return storyView(index, p);
  }
  return labView(index, p) ?? { ...storyView(index, { ...p, scan: SCAN_DONE }), lab: true };
}
