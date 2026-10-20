import { decrease, weighted, type Counts, type Criterion } from './impurity';

export const ATTRS = ['Hava', 'Sıcaklık', 'Nem', 'Rüzgâr'] as const;

export interface Day {
  id: string;
  values: [string, string, string, string];
  /** 0 = evet (play), 1 = hayır */
  y: 0 | 1;
}

const row = (id: string, a: string, b: string, c: string, d: string, y: 0 | 1): Day => ({ id, values: [a, b, c, d], y });

/** Quinlan (1986) tennis data, in the spec's order. */
export const DAYS: Day[] = [
  row('G1', 'Güneşli', 'Sıcak', 'Yüksek', 'Zayıf', 1),
  row('G2', 'Güneşli', 'Sıcak', 'Yüksek', 'Güçlü', 1),
  row('G3', 'Bulutlu', 'Sıcak', 'Yüksek', 'Zayıf', 0),
  row('G4', 'Yağmurlu', 'Ilık', 'Yüksek', 'Zayıf', 0),
  row('G5', 'Yağmurlu', 'Serin', 'Normal', 'Zayıf', 0),
  row('G6', 'Yağmurlu', 'Serin', 'Normal', 'Güçlü', 1),
  row('G7', 'Bulutlu', 'Serin', 'Normal', 'Güçlü', 0),
  row('G8', 'Güneşli', 'Ilık', 'Yüksek', 'Zayıf', 1),
  row('G9', 'Güneşli', 'Serin', 'Normal', 'Zayıf', 0),
  row('G10', 'Yağmurlu', 'Ilık', 'Normal', 'Zayıf', 0),
  row('G11', 'Güneşli', 'Ilık', 'Normal', 'Güçlü', 0),
  row('G12', 'Bulutlu', 'Ilık', 'Yüksek', 'Güçlü', 0),
  row('G13', 'Bulutlu', 'Sıcak', 'Normal', 'Zayıf', 0),
  row('G14', 'Yağmurlu', 'Ilık', 'Yüksek', 'Güçlü', 1),
];

export interface Candidate {
  attr: number;
  branches: { value: string; counts: Counts }[];
  impurity: number;
  decrease: number;
}

/** One multiway split candidate per attribute; branches in first-seen order. */
export function candidates(k: Criterion): Candidate[] {
  const root: Counts = [DAYS.filter((d) => d.y === 0).length, DAYS.filter((d) => d.y === 1).length];
  return ATTRS.map((_, attr) => {
    const byValue = new Map<string, [number, number]>();
    for (const d of DAYS) {
      let c = byValue.get(d.values[attr]);
      if (!c) byValue.set(d.values[attr], (c = [0, 0]));
      c[d.y]++;
    }
    const branches = [...byValue].map(([value, counts]) => ({ value, counts: counts as Counts }));
    const kids = branches.map((b) => b.counts);
    return { attr, branches, impurity: weighted(kids, k), decrease: decrease(root, kids, k) };
  });
}

/** Index of the largest decrease; ties go to the smaller index. */
export function winner(cs: Candidate[]): number {
  let best = 0;
  cs.forEach((c, i) => {
    if (c.decrease > cs[best].decrease + 1e-12) best = i;
  });
  return best;
}
