export interface Confusion { tn: number; fp: number; fn: number; tp: number }
export interface Metrics {
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  specificity: number | null;
}

function validateCounts(c: Confusion): void {
  for (const value of [c.tn, c.fp, c.fn, c.tp]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Counts must be nonnegative safe integers');
  }
}

const ratio = (numerator: number, denominator: number): number | null => denominator === 0 ? null : numerator / denominator;

export function metrics(c: Confusion): Metrics {
  validateCounts(c);
  return {
    accuracy: ratio(c.tn + c.tp, c.tn + c.fp + c.fn + c.tp),
    precision: ratio(c.tp, c.tp + c.fp),
    recall: ratio(c.tp, c.tp + c.fn),
    f1: ratio(2 * c.tp, 2 * c.tp + c.fp + c.fn),
    specificity: ratio(c.tn, c.tn + c.fp),
  };
}

export function allNegative(c: Confusion): Confusion {
  validateCounts(c);
  return { tn: c.tn + c.fp, fp: 0, fn: c.fn + c.tp, tp: 0 };
}

export function cost(c: Confusion, fpCost: number, fnCost: number): number {
  validateCounts(c);
  if (![fpCost, fnCost].every(value => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Costs must be nonnegative finite numbers');
  }
  return c.fp * fpCost + c.fn * fnCost;
}
