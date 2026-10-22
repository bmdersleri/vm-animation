/** Scene colours (ruling R8): marks/fills vs AA-safe text variants. */
export const NAVY = '#14365C';
export const MARK = ['#0EA5A4', '#F08A00'] as const; // Kaldı, Ayrıldı
export const TEXT = ['#0B7473', '#A85A00'] as const;
/** Accent for highlights (AA-safe on white). */
export const ACCENT = '#A85A00';
export const GRID = '#E3E9F0';
export const FRAME = '#C9D5E3';
export const WHITE = '#ffffff';

/** One decimal is plenty for SVG coordinates and keeps attribute strings short. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Equilateral triangle (apex up) with the same area as a circle of radius r, centred on its centroid. */
export function trianglePath(r: number): string {
  const a = r * Math.sqrt((4 * Math.PI) / Math.sqrt(3));
  const R = a / Math.sqrt(3);
  return `M0,${r1(-R)}L${r1(a / 2)},${r1(R / 2)}L${r1(-a / 2)},${r1(R / 2)}Z`;
}

/** Cluster colours (Chapter 7): centre i and its members share CLUSTER[i % 10]. */
export const CLUSTER: readonly string[] = [
  '#1F6FB2', '#E07B00', '#2A9D58', '#8E44AD', '#B8860B',
  '#17A2B8', '#D63384', '#6C757D', '#5C3D2E', '#7CB342',
];
export const UNASSIGNED = '#9AA5B1';
export const NEGATIVE = '#C0392B';
