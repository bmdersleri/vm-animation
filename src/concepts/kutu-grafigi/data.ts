import raw from './data/kutu_data.json';

export type GroupId = 'bilgisayar' | 'elektrik' | 'makine';

/** The pandas fixture shape of one group at one k (make_eda_data.py). */
export interface BoxStatJson {
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  lo: number;
  hi: number;
  wLo: number;
  wHi: number;
  outliers: number[];
}

/** One book group: five exam marks plus the sixth student that only two groups have. */
export interface GroupData {
  id: GroupId;
  name: string;
  values: number[];
  /** Bilgisayar 66, Elektrik 62, Makine: no sixth student. */
  sixth: number | null;
  stats: Record<'1.5' | '3', BoxStatJson>;
  withSixth: { values: number[]; stats: Record<'1.5' | '3', BoxStatJson> } | null;
}

const data = raw as unknown as { groups: GroupData[] };

/** The three groups in book order; the JSON is the pandas fixture the page's own maths is checked against. */
export const GROUPS: GroupData[] = data.groups;

/** One colour per group, as the site's CSS tokens; the scene paints the glyphs. */
export const GROUP_COLOR: Record<GroupId, string> = {
  bilgisayar: 'var(--navy)',
  elektrik: 'var(--teal)',
  makine: 'var(--orange)',
};
