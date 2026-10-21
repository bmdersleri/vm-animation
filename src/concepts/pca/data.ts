import raw from './data/pca_data.json';

export type Pt = [number, number];
export type Perplexity = 5 | 30 | 50;

export const PERPLEXITIES: readonly Perplexity[] = [5, 30, 50];

interface TsneRaw {
  labels: (0 | 1)[];
  pca: Pt[];
  pcaEvr: [number, number];
  newPca: Pt;
  embed: Record<string, Pt[]>;
  embedNew: Record<string, Pt[]>;
}

const data = raw as unknown as {
  pair: { cols: number[]; points: Pt[] };
  scree: { evr: number[]; cum: number[]; kByThreshold: number[] };
  tsne: TsneRaw;
};

/** 500 standardised customers on the 2nd and 9th feature. */
export const PAIR: readonly Pt[] = data.pair.points;

/** Explained variance of the 12 components; k needed per threshold t = 50..99 (index t - 50). */
export const SCREE: { evr: number[]; cum: number[]; kByThreshold: number[] } = data.scree;

const byPerplexity = (m: Record<string, Pt[]>): Record<Perplexity, Pt[]> => ({
  5: m['5'],
  30: m['30'],
  50: m['50'],
});

export const TSNE: {
  labels: (0 | 1)[];
  pca: Pt[];
  pcaEvr: [number, number];
  newPca: Pt;
  embed: Record<Perplexity, Pt[]>;
  /** 301 points, the last one is the new customer. */
  embedNew: Record<Perplexity, Pt[]>;
} = {
  labels: data.tsne.labels,
  pca: data.tsne.pca,
  pcaEvr: data.tsne.pcaEvr,
  newPca: data.tsne.newPca,
  embed: byPerplexity(data.tsne.embed),
  embedNew: byPerplexity(data.tsne.embedNew),
};
