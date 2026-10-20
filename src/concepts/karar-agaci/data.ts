import raw from './data/churn_tree.json';

export interface Row {
  /** Contract length in months (1-59). */
  t: number;
  /** Complaint count (0-5). */
  c: number;
  /** 0 = Kaldı, 1 = Ayrıldı. */
  y: 0 | 1;
  /** Vertical jitter for display only, within [-0.25, 0.25]. */
  jy: number;
}

const data = raw as unknown as { train: Row[]; test: Row[] };

export const train: Row[] = data.train;
export const test: Row[] = data.test;

export const FEATURES = ['Sözleşme süresi (ay)', 'Şikâyet sayısı'] as const;

/** Plot domain: contract 1-59 months on x, complaints 0-5 on y. */
export const DOMAIN = { x: [0, 60], y: [-0.5, 5.5] } as const;
