/** Greedy label placement shared by the scatter layers: candidate offsets around a mark, scored against boxes already taken. */
export type Box = { l: number; t: number; r: number; b: number };
export type Anchor = 'start' | 'middle' | 'end';
export type Offset = { dx: number; dy: number; anchor: Anchor };

/** Label width estimate per character, in em (bold sans digits and capitals; errs wide). */
const CHAR_EM = 0.7;
export const LABEL_FALLBACK_PX = 12;
/** px of tolerance: the width estimate is not exact, so near-ties count as ambiguous. */
export const AMBIGUITY_SLACK = 3;

export const overlap = (p: Box, q: Box): number =>
  Math.max(0, Math.min(p.r, q.r) - Math.max(p.l, q.l)) * Math.max(0, Math.min(p.b, q.b) - Math.max(p.t, q.t));
type Key = [number, number, number];
/** Lexicographic a < b: the first differing entry decides. */
const less = (a: Key, b: Key): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

/** Text box of a label written at (x, y) with the given anchor (y is the baseline). */
export function labelBox(x: number, y: number, chars: number, anchor: Anchor, fs: number): Box {
  const w = chars * CHAR_EM * fs;
  const l = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { l: l - 1, t: y - 0.95 * fs - 1, r: l + w + 1, b: y + 0.3 * fs + 1 };
}

/** Label offsets around a mark of half-size `half`, in order of preference: NE, NW, SE, SW, then wider fallbacks. */
export function offsets(half: number, gap: number, fs: number): Offset[] {
  const d = half + gap;
  const up = -half;
  const down = half + fs;
  return [
    { dx: d, dy: up, anchor: 'start' }, { dx: -d, dy: up, anchor: 'end' },
    { dx: d, dy: down, anchor: 'start' }, { dx: -d, dy: down, anchor: 'end' },
    { dx: 0, dy: up - gap, anchor: 'middle' }, { dx: 0, dy: down + gap, anchor: 'middle' },
    { dx: d, dy: up - fs, anchor: 'start' }, { dx: -d, dy: up - fs, anchor: 'end' },
    { dx: d, dy: down + fs, anchor: 'start' }, { dx: -d, dy: down + fs, anchor: 'end' },
  ];
}

/** Area a label may use: the plot rect widened by `m` px on every side. */
export function labelArea(rect: { left: number; top: number; width: number; height: number }, m = 6): Box {
  return { l: rect.left - m, t: rect.top - m, r: rect.left + rect.width + m, b: rect.top + rect.height + m };
}

export interface ChooseArgs {
  x: number; y: number; chars: number; cands: readonly Offset[]; fs: number;
  /** Boxes already occupied; the chosen label's box is appended. */
  taken: Box[];
  area: Box;
  /** True when the label box would read as belonging to another mark. */
  ambiguous?: (box: Box) => boolean;
}

/**
 * Order: collision-free and unambiguous, collision-free but ambiguous, then the least overlap
 * (taken boxes plus the part outside `area`). The first collision-free, unambiguous candidate wins.
 */
export function chooseOffset(a: ChooseArgs): Offset {
  const outside = (b: Box): number => (b.r - b.l) * (b.b - b.t) - overlap(b, a.area);
  let best = a.cands[0];
  let bestKey: Key = [Infinity, Infinity, Infinity];
  let bestBox: Box | null = null;
  for (const o of a.cands) {
    const box = labelBox(a.x + o.dx, a.y + o.dy, a.chars, o.anchor, a.fs);
    const hits = a.taken.reduce((sum, t) => sum + overlap(box, t), 0) + outside(box);
    const key: Key = [hits > 0 ? 1 : 0, a.ambiguous?.(box) ? 1 : 0, hits];
    if (less(key, bestKey)) { best = o; bestKey = key; bestBox = box; }
    if (key[0] === 0 && key[1] === 0) break;
  }
  if (bestBox) a.taken.push(bestBox);
  return best;
}
