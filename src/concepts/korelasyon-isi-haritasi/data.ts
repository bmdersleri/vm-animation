import raw from './data/korelasyon_data.json';

/** One Anscombe set: the points plus the summary the quartet shares. */
export interface AnscombeSet {
  id: 'I' | 'II' | 'III' | 'IV';
  x: number[];
  y: number[];
  meanX: number;
  meanY: number;
  varX: number;
  varY: number;
  r: number;
  slope: number;
}

/** Set IV's single high-x point: `set` is the display number, `index` the array index inside `sets[3]`. */
export interface Leverage {
  set: number;
  index: number;
  x: number;
  y: number;
}

/** One book table: variable labels, the rows and the full correlation matrix. */
export interface CorrelationTable {
  variables: string[];
  rows: number[][];
  matrix: number[][];
}

/** Example 006 plus the numeric-coded `churn` column (no raw rows: the matrix is what the page draws). */
export interface HeatmapData extends CorrelationTable {
  withChurn: { variables: string[]; matrix: number[][] };
}

export interface DragRow {
  y: number;
  r: number;
}

export interface AnscombeData {
  sets: AnscombeSet[];
  leverage: Leverage;
  drag: DragRow[];
  spearman: number;
}

interface KorelasyonData {
  korelasyon: CorrelationTable;
  heatmap: HeatmapData;
  anscombe: AnscombeData;
}

const data = raw as unknown as KorelasyonData;

/** Example 004: 7 students, study / absence / grade. */
export const KORELASYON: CorrelationTable = data.korelasyon;
/** Example 006: 6 students, four variables and the 5 × 5 `churn` variant. */
export const HEATMAP: HeatmapData = data.heatmap;
/** The classic quartet, its leverage drag table and the Spearman value (make_eda_data.py). */
export const ANSCOMBE_JSON: AnscombeData = data.anscombe;

/** One column of a table, in row order. */
export function column(table: CorrelationTable, index: number): number[] {
  return table.rows.map((row) => row[index]);
}
