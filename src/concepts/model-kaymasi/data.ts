import generated from './data/kayma.json';

export type ScenarioId = 'yok' | 'ani' | 'yavas' | 'yayilim' | 'kavram';

/** The five drift scenarios, in the order the page lists them. */
export const SCENARIO_IDS: readonly ScenarioId[] = ['yok', 'ani', 'yavas', 'yayilim', 'kavram'];

export interface Meta {
  seed: number;
  versions: Record<string, string>;
  months: number;
  perMonth: number;
  refMonths: number;
  /** Months until the churn label (and so the accuracy) of a month is known. */
  labelDelay: number;
  /** Accuracy alarm margin below the reference accuracy. */
  accMargin: number;
  /** Replaces an empty current bin share inside the PSI term. */
  psiFloor: number;
  /** Screen histogram: 22 bins of `width` from `lo` to `hi`. */
  hist: { lo: number; hi: number; width: number };
}

export const META: Meta = generated.meta;

/** Code 03 of chapter 14 and the mini application's difference. */
export interface Book {
  reference: number[];
  current: number[];
  refMean: number;
  curMean: number;
  diff: number;
  esik: number;
  status: 'UYARI' | 'NORMAL';
  miniDiff: number;
}

export const BOOK: Book = generated.book as Book;

/** Months 1..6 (1500 customers): the reference period and its model. */
export interface Reference {
  n: number;
  mean: number;
  std: number;
  /** Nine PSI cut points (deciles of the reference fees). */
  psiCuts: number[];
  /** Reference count per PSI bin (ten); the share p_i is the count / n. */
  psiCounts: number[];
  /** Screen histogram counts (22 bins). */
  hist: number[];
  coef: number;
  intercept: number;
  accuracy: number;
  churnRate: number;
  /** Largest |month mean - reference mean| over months 1..6. */
  maxMonthlyDiff: number;
}

export const REFERENCE: Reference = generated.reference;

export interface MonthStats {
  month: number;
  mean: number;
  std: number;
  diff: number;
  psiCounts: number[];
  psi: number;
  hist: number[];
  accuracy: number;
  churnRate: number;
}

export interface DriftScenario {
  id: ScenarioId;
  name: string;
  changeMonth: number | null;
  /** Months 1..24 in order. */
  months: MonthStats[];
}

export const SCENARIOS: DriftScenario[] = generated.scenarios as DriftScenario[];

/** The scenario with this id. */
export function scenarioById(id: ScenarioId): DriftScenario {
  const found = SCENARIOS.find(s => s.id === id);
  if (!found) {
    throw new Error(`no scenario ${id}`);
  }
  return found;
}

/** One month (1..24) of a scenario. */
export function monthOf(id: ScenarioId, month: number): MonthStats {
  const found = scenarioById(id).months[month - 1];
  if (!found) {
    throw new Error(`no month ${month}`);
  }
  return found;
}

/** Logistic fit on months 15..24 of a scenario. */
export interface Curve {
  coef: number;
  intercept: number;
  churnRate: number;
}

export const CURVES: Record<ScenarioId, Curve> = generated.curves as Record<ScenarioId, Curve>;

/** In `yayilim`, the month in 15..24 whose mean difference is smallest. */
export const SPREAD_MONTH: number = generated.spreadMonth;
