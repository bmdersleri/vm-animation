import generated from './data/crisp.json';

export type Days = 4 | 14 | 28 | 56;
export type Missing = 'sifir' | 'cikar';
export type Stock = 'satis' | 'soran';

/** Training window lengths: the first N days of the 56 day pool. */
export const DAY_OPTIONS = [4, 14, 28, 56] as const;

export interface Meta {
  seed: number;
  versions: Record<string, string>;
  /** Sandwiches prepared every day so far. */
  oldOrder: number;
  /** Safety margin on the prediction (order = round(margin * prediction)). */
  margin: number;
  /** Share of the customers who ask after the stock ran out. */
  askRate: number;
  examWeeks: [string, string][];
  monthLevel: Record<'3' | '4' | '5', number>;
  criteria: { waste: number; service: number };
  /** Least usable days in each of the two groups for "enough data". */
  minGroup: number;
  poolDays: number;
  testDays: number;
}

export const META: Meta = generated.meta as unknown as Meta;

export interface CafeDay {
  /** ISO date. */
  date: string;
  /** 0 = Monday. */
  weekday: number;
  sinav: boolean;
  month: number;
  /** Null where the till failed. */
  satis: number | null;
  stokTukendi: boolean;
  /** Customers who asked after the stock ran out. */
  soran: number;
  /** Waste of the old order of 50 over the whole month (known only when the month ends). */
  aySonuIsrafi: number;
  /** True demand known to the simulation. */
  talep: number;
  /** The last 14 days. */
  test: boolean;
}

/** The 70 table days, 2026-03-06 .. 2026-05-14. */
export const DAYS: CafeDay[] = generated.days as CafeDay[];

export interface Outcome {
  prepared: number;
  wasted: number;
  lost: number;
  demand: number;
  wasteRate: number | null;
  lostShare: number | null;
  reduction: number | null;
  wasteOk: boolean;
  serviceOk: boolean;
  ok: boolean;
}

export interface Cell {
  days: Days;
  missing: Missing;
  stock: Stock;
  leak: boolean;
  /** Days left in each group after the missing choice. */
  usable: { normal: number; sinav: number };
  enough: boolean;
  /** Group predictions of the model without the leaking input (null for an empty group). */
  pred: { normal: number | null; sinav: number | null };
  /** Coefficient of ay_sonu_israfi (null without the leak). */
  leakCoef: number | null;
  /** The 14 test day orders: evaluation (May's waste) and deployment (April's waste). */
  orders: { eval: number[]; deploy: number[] };
  eval: Outcome;
  deploy: Outcome;
}

/** 32 cells: days x missing x stock x leak, nested in that order. */
export const GRID: Cell[] = generated.grid as Cell[];

/** The cell for these choices. */
export function cellOf(days: Days, missing: Missing, stock: Stock, leak: boolean): Cell {
  const found = GRID.find(c => c.days === days && c.missing === missing && c.stock === stock && c.leak === leak);
  if (!found) {
    throw new Error(`no cell ${days}/${missing}/${stock}/${leak}`);
  }
  return found;
}

/** Ordering 50 every test day. */
export const BASELINE: Outcome = generated.baseline as Outcome;

export interface BookRow {
  tarih: string;
  urun: string;
  satis_adedi: number;
  stok_tukendi: boolean;
  sinav_haftasi: boolean;
}

export interface Book {
  isHedefi: { amac: string; basari_olcutu: string; veri_sorusu: string };
  kafeVerisi: BookRow[];
  /** satisKayitlari grouped by sinav_haftasi (code 003). */
  satisKayitlari: { normal: number; sinav: number };
  /** The 4 row kafeVerisi grouped by sinav_haftasi (mixes coffee and sandwich). */
  kafeVerisiGrup: { normal: number; sinav: number };
  hamVeri: {
    once: { urun: string; satis_adedi: number | null }[];
    sonra: { urun: string; satis_adedi: number | null }[];
    kahveFillna0: number;
    kahveAtlanir: number;
    genelFillna0: number;
    genelAtlanir: number;
  };
  sizinti: {
    gunlukKayit: { gun: string; sicaklik: number; ay_sonu_israfi: number };
    yanlisGirdiler: string[];
    dogruGirdiler: string[];
  };
  kafeAnalizi: { mean: number; count: number; used: number };
}

export const BOOK: Book = generated.book as Book;
