import raw from './data/olcekleme_data.json';

export interface Customer {
  id: string;
  /** Tenure in months. */
  t: number;
  /** Monthly invoice in TL. */
  f: number;
}

const data = raw as unknown as {
  customers: Customer[];
  query: { t: number; f: number };
  split: { values: number[]; churn: (0 | 1)[]; train: number[]; test: number[] };
};

export const CUSTOMERS: Customer[] = data.customers;
export const QUERY: { t: number; f: number } = data.query;
export const SPLIT: { values: number[]; churn: (0 | 1)[]; train: number[]; test: number[] } = data.split;

/** Data box (months, TL): axes and drag limit. */
export const RAW = { x: [0, 64], y: [20, 210] } as const;
