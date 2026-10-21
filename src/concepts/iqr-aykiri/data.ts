import raw from './data/iqr_data.json';

const data = raw as unknown as {
  fill: { values: (number | null)[]; extremeIndex: number };
  iqr: { values: number[]; extremeIndex: number };
  mode: { values: (string | null)[] };
};

/** Book example 002: monthly invoices with two gaps and one extreme value. */
export const FILL: { values: (number | null)[]; extremeIndex: number } = data.fill;
/** Book example 003: the IQR series with its extreme value at the end. */
export const IQR: { values: number[]; extremeIndex: number } = data.iqr;
/** Book mode example: a categorical column with one gap. */
export const MODE_VALUES: (string | null)[] = data.mode.values;

/** Drag range of the extreme value (TL). */
export const EXTREME_MIN = 50;
export const EXTREME_MAX = 500;

/** The book's own extreme value per chapter section. */
export const BOOK_EXTREME = { 1: 200, 2: 480 } as const;
