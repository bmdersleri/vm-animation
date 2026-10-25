/** Mean of a list of numbers. */
export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Book code 03: |current mean - reference mean|. */
export function meanDiff(ref: readonly number[], cur: readonly number[]): number {
  return Math.abs(mean(cur) - mean(ref));
}

/** The book's rule: strictly greater than the threshold is UYARI. */
export function status(diff: number, esik: number): 'UYARI' | 'NORMAL' {
  return diff > esik ? 'UYARI' : 'NORMAL';
}

export interface PsiTerm {
  /** Reference share of the bin. */
  p: number;
  /** Current share of the bin (the floor `eps` for an empty bin). */
  q: number;
  /** (q - p) ln(q / p). */
  term: number;
  /** True when the bin held no current value and q was raised to `eps`. */
  empty: boolean;
}

/**
 * The PSI term of every bin: p = reference count / `refN`, q = count / `n`; an empty bin takes q = `eps` in the
 * whole term (not only inside the logarithm).
 */
export function psiTerms(
  counts: readonly number[],
  n: number,
  refCounts: readonly number[],
  refN: number,
  eps = 1e-4,
): PsiTerm[] {
  return counts.map((count, i) => {
    const p = refCounts[i] / refN;
    const empty = count === 0;
    const q = empty ? eps : count / n;
    return { p, q, term: (q - p) * Math.log(q / p), empty };
  });
}

/** Population stability index: the sum of the bin terms. */
export function psi(counts: readonly number[], n: number, refCounts: readonly number[], refN: number): number {
  return psiTerms(counts, n, refCounts, refN).reduce((a, t) => a + t.term, 0);
}

/** First monitored month (the months before are the reference period). */
export const MONITOR_FROM = 7;

/** Months (1-based) from `from` on whose value is strictly above the threshold; `values[i]` is month i + 1. */
export function alarmMonths(values: readonly number[], threshold: number, from = MONITOR_FROM): number[] {
  const months: number[] = [];
  values.forEach((v, i) => {
    if (i + 1 >= from && v > threshold) {
      months.push(i + 1);
    }
  });
  return months;
}

/** Alarms before the change month; without a change every alarm is false. */
export function falseAlarms(alarms: readonly number[], changeMonth: number | null): number {
  return changeMonth === null ? alarms.length : alarms.filter(m => m < changeMonth).length;
}

/** First alarm month at or after the change month, minus the change month; null without a change or without such an alarm. */
export function detectionDelay(alarms: readonly number[], changeMonth: number | null): number | null {
  if (changeMonth === null) {
    return null;
  }
  const first = alarms.find(m => m >= changeMonth);
  return first === undefined ? null : first - changeMonth;
}

/** The delay as the page writes it: "—" without a change, "kaçırıldı" when no alarm came, else "N ay". */
export function delayText(delay: number | null, changeMonth: number | null): string {
  if (changeMonth === null) {
    return '—';
  }
  return delay === null ? 'kaçırıldı' : `${delay} ay`;
}

export interface AccuracyAlarm {
  /** First month whose accuracy is below the reference accuracy minus the margin. */
  month: number;
  /** The month the labels of `month` arrive. */
  knownAt: number;
}

/** The performance alarm: accuracy below `refAcc - margin`, known `delay` months after the month it describes. */
export function accuracyAlarm(
  acc: readonly number[],
  refAcc: number,
  margin = 0.05,
  delay = 3,
  from = MONITOR_FROM,
): AccuracyAlarm | null {
  for (let m = from; m <= acc.length; m += 1) {
    if (acc[m - 1] < refAcc - margin) {
      return { month: m, knownAt: m + delay };
    }
  }
  return null;
}

/** How the page writes the performance alarm on `today`: first low month and the month it becomes known. */
export function accuracyReading(a: AccuracyAlarm | null, today: number): { month: string; known: string } {
  if (a === null) {
    return { month: 'başarım düşüşü yok', known: '—' };
  }
  return { month: `ay ${a.month}`, known: a.knownAt > today ? 'henüz bilinmiyor' : `ay ${a.knownAt}` };
}

/** Logistic curve P = 1 / (1 + e^-(coef x + intercept)). */
export function logistic(x: number, coef: number, intercept: number): number {
  return 1 / (1 + Math.exp(-(coef * x + intercept)));
}

/** Counts as shares of their total (all zero for an empty histogram). */
export function shares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map(c => (total > 0 ? c / total : 0));
}
