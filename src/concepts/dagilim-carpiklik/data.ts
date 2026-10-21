import raw from './data/dagilim_data.json';

/** The four book series: 002 and 003 are the outlier examples, the other two are shaped for the tails. */
export type Seri = '002' | '003' | 'simetrik' | 'sol';
export type BinCount = 3 | 5 | 10;

export interface SeriesLog {
  values: number[];
  mean: number;
  median: number;
  skew: number;
}

export interface Series {
  values: number[];
  mean: number;
  median: number;
  /** Sample standard deviation (ddof 1), pandas' Series.std(). */
  std: number;
  /** pandas' Series.skew() (G1, bias-corrected). */
  skew: number;
  log: SeriesLog;
}

export interface ExtremePoint {
  x: number;
  mean: number;
  median: number;
  skew: number;
}

const data = raw as unknown as {
  series: Record<Seri, Series>;
  bins: Record<Seri, Record<'3' | '5' | '10', number[]>>;
  extremeSweep: ExtremePoint[];
};

/** Raw series and their pandas summary. */
export const SERIES: Record<Seri, Series> = data.series;
/** numpy.histogram counts per series and bin count: the fixture the page's histCounts is checked against. */
export const BINS: Record<Seri, Record<'3' | '5' | '10', number[]>> = data.bins;
/** Series 003's last value dragged from 28 to 60. */
export const SWEEP: ExtremePoint[] = data.extremeSweep;
