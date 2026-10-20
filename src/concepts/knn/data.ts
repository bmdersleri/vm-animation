import raw from './data/telco_sample.json';

export type DatasetId = 'aylik' | 'toplam';
export interface RawPoint { tenure: number; value: number }
export interface Customer { id: string; tenure: number; monthly: number; total: number; churn: 0 | 1 }

interface Demo {
  defaultQuery: Record<DatasetId, RawPoint>;
  kSwallow: RawPoint;
  metricSplit: RawPoint;
  scaleSplit: RawPoint;
}

const data = raw as unknown as { customers: Customer[]; demo: Demo };

export const customers: Customer[] = data.customers;
export const demo: Demo = data.demo;

export function rawPoint(c: Customer, d: DatasetId): RawPoint {
  return { tenure: c.tenure, value: d === 'aylik' ? c.monthly : c.total };
}
