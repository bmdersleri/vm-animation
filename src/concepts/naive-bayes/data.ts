import raw from './data/nb_data.json';

export interface WordCount {
  w: string;
  /** Occurrences in [normal, spam] e-mails. */
  n: [number, number];
}

export interface Spam {
  /** Training e-mails per class: [normal, spam]. */
  docs: [number, number];
  words: WordCount[];
}

export interface Customer {
  /** Contract length in months (1-59). */
  t: number;
  /** Complaint count (0-5). */
  c: number;
  /** 0 = Kaldı, 1 = Ayrıldı. */
  y: 0 | 1;
  /** Vertical jitter for display only, within [-0.25, 0.25]. */
  jy: number;
}

export interface Gauss {
  train: Customer[];
  /** The book's first test customer. */
  firstTest: { t: number; c: number };
}

const data = raw as unknown as { spam: Spam; gauss: Gauss };

export const spam: Spam = data.spam;
export const gauss: Gauss = data.gauss;

/** Corpus dictionary, in table order. */
export const WORDS: string[] = spam.words.map((x) => x.w);

export const FEATURES = ['Sözleşme süresi (ay)', 'Şikâyet sayısı'] as const;

/** Plot domain: contract 1-59 months on x, complaints 0-5 on y. */
export const DOMAIN = { x: [0, 60], y: [-0.5, 5.5] } as const;
