import generated from './data/sepet.json';

export type Item = string;
export type Basket = readonly Item[];
/** Items always in product order (see `items`). */
export type Itemset = readonly Item[];

export interface FixtureRule {
  readonly x: string;
  readonly y: string;
  readonly support: number;
  readonly confidence: number;
  readonly lift: number;
}
export interface SepetData {
  readonly meta: { readonly mlxtend: string; readonly pandas: string };
  /** Product order (the book's order). */
  readonly items: readonly Item[];
  readonly names: Readonly<Record<string, string>>;
  readonly abbr: Readonly<Record<string, string>>;
  /** The book's 18 baskets, in the book's order. */
  readonly transactions: readonly Basket[];
  readonly fixture: {
    /** Keyed by min count 1..18 (min_support = count / 18); itemset key -> count. */
    readonly frequent: Readonly<Record<string, Readonly<Record<string, number>>>>;
    /** association_rules at min_support 0.2, min confidence 0.5; itemsets are keys ("a,b"). */
    readonly rules: readonly FixtureRule[];
    /** Rule counts keyed "<min_support>|<min confidence>", e.g. "0.20|0.5". */
    readonly grid: Readonly<Record<string, number>>;
  };
}

export const sepetData = generated as unknown as SepetData;
