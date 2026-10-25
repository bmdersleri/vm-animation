import type { FlowEdge, FlowNode } from '../../core/plot/flow-graph';
import { naturalSize } from '../../core/plot/flow-graph';
import type { TextMeasure } from '../../core/plot/text-measure';

/** izleme monitoring, esik the threshold decision, alarm the alarm and log, inceleme the human review, neden the cause decision, then the four causes. */
export type AlarmId = 'izleme' | 'esik' | 'alarm' | 'inceleme' | 'neden' | 'kalite' | 'mevsim' | 'davranis' | 'yonetisim';

/** Node order: the chain first, then the four branches top to bottom (wide) or row by row (narrow). */
export const ALARM_IDS: readonly AlarmId[] = ['izleme', 'esik', 'alarm', 'inceleme', 'neden', 'kalite', 'mevsim', 'davranis', 'yonetisim'];

/** Node labels (figure 14.4 of the book plus the seasonal cause from its theory section), one string per line. */
export const ALARM_LABELS: Record<AlarmId, string[]> = {
  izleme: ['İzleme'],
  esik: ['Eşik aşıldı mı?'],
  alarm: ['Alarm ve', 'kayıt'],
  inceleme: ['İnsan', 'incelemesi'],
  neden: ['Neden?'],
  kalite: ['veri kalitesi:', 'veri hattını', 'düzelt'],
  mevsim: ['mevsimsellik:', 'eşiği ve referansı', 'gözden geçir'],
  davranis: ['gerçek davranış', 'değişimi: yeniden', 'değerlendirme', 've eğitim'],
  yonetisim: ['adillik veya', 'gizlilik:', 'yönetişim onayı'],
};

const KIND: Record<AlarmId, FlowNode['kind']> = {
  izleme: 'phase',
  esik: 'decision',
  alarm: 'phase',
  inceleme: 'phase',
  neden: 'decision',
  kalite: 'phase',
  mevsim: 'phase',
  davranis: 'phase',
  yonetisim: 'phase',
};

/**
 * Edges of the alarm flow. The two edges between `izleme` and `esik` bow to opposite sides, the four outer
 * returns bow away from the chain (wide: above for the upper branches and below for the lower ones; narrow: left
 * for the left column and right for the right one); a positive bend is to the right of the travel direction.
 */
export const ALARM_EDGES: FlowEdge[] = [
  { id: 'izleme-esik', from: 'izleme', to: 'esik', kind: 'forward', bend: 8 },
  { id: 'esik-izleme', from: 'esik', to: 'izleme', kind: 'back', label: 'Hayır', bend: 8 },
  { id: 'esik-alarm', from: 'esik', to: 'alarm', kind: 'forward', label: 'Evet' },
  { id: 'alarm-inceleme', from: 'alarm', to: 'inceleme', kind: 'forward' },
  { id: 'inceleme-neden', from: 'inceleme', to: 'neden', kind: 'forward' },
  { id: 'neden-kalite', from: 'neden', to: 'kalite', kind: 'forward' },
  { id: 'neden-mevsim', from: 'neden', to: 'mevsim', kind: 'forward' },
  { id: 'neden-davranis', from: 'neden', to: 'davranis', kind: 'forward' },
  { id: 'neden-yonetisim', from: 'neden', to: 'yonetisim', kind: 'forward' },
  { id: 'kalite-izleme', from: 'kalite', to: 'izleme', kind: 'outer', bend: 70 },
  { id: 'mevsim-izleme', from: 'mevsim', to: 'izleme', kind: 'outer', bend: 45 },
  { id: 'davranis-izleme', from: 'davranis', to: 'izleme', kind: 'outer', bend: -45 },
  { id: 'yonetisim-izleme', from: 'yonetisim', to: 'izleme', kind: 'outer', bend: -70 },
];

/** The route of the Ders sweep: one `ani` alarm through the behaviour-change branch and back to monitoring. */
export const ALARM_PATH: readonly string[] = [
  'izleme-esik', 'esik-alarm', 'alarm-inceleme', 'inceleme-neden', 'neden-davranis', 'davranis-izleme',
];

type Sizes = Record<AlarmId, { w: number; h: number }>;

/** The smallest box of every node for its label at `fontPx` (what the scene measures; tests pass an estimating `TextMeasure`). */
export function alarmSizes(measure: TextMeasure, fontPx: number, labels: Record<AlarmId, string[]> = ALARM_LABELS): Sizes {
  return Object.fromEntries(
    ALARM_IDS.map(id => [id, naturalSize({ kind: KIND[id], label: labels[id] }, measure, fontPx)]),
  ) as Sizes;
}

/** Box padding on each side (`flow-graph.ts` PAD), which a wrapped label line must leave room for. */
const BOX_PAD = 8;

/** The widest a branch box may be in a narrow area of width `w`: two of them side by side with the minimum gap. */
export function narrowBranchWidth(w: number): number {
  return Math.floor((w - 2 * ALARM_MARGIN - MIN_GAP) / 2);
}

/**
 * The labels with the four branch labels wrapped so each box is at most `maxW` wide (a narrow area cannot hold two
 * of the long ones side by side); the chain labels stay as written. A word wider than the room stays whole.
 */
export function wrapBranchLabels(measure: TextMeasure, fontPx: number, maxW: number): Record<AlarmId, string[]> {
  const out = { ...ALARM_LABELS };
  for (const id of BRANCHES) {
    out[id] = ALARM_LABELS[id].flatMap(line => measure.wrap(line, maxW - 2 * BOX_PAD, 'flow-label', fontPx));
  }
  return out;
}

/** Character-count estimate, for a layout asked for before the scene has measured the labels. */
const ESTIMATE = { maxWidth: (lines: string[], _cls: string, fs: number): number => Math.max(...lines.map(l => l.length * fs * 0.6)) } as unknown as TextMeasure;
const FALLBACK_PX = 13;

/** Space kept between the flow and the area's edge (px): the arrows' heads, the token and the arcs of the returns reach past the boxes. */
export const ALARM_MARGIN = 12;
const MAX_GAP_Y = 28;
const MIN_GAP = 8;

const node = (id: AlarmId, sizes: Sizes, x: number, y: number): FlowNode => ({
  id,
  label: ALARM_LABELS[id],
  kind: KIND[id],
  x,
  y,
  w: sizes[id].w,
  h: sizes[id].h,
});

const BRANCHES: AlarmId[] = ['kalite', 'mevsim', 'davranis', 'yonetisim'];

function wideLayout(w: number, h: number, sizes: Sizes): FlowNode[] {
  const chain: AlarmId[] = ['izleme', 'esik', 'alarm', 'inceleme', 'neden'];
  const columnW = Math.max(...BRANCHES.map(id => sizes[id].w));
  const total = chain.reduce((a, id) => a + sizes[id].w, 0) + columnW;
  const gap = Math.max(MIN_GAP, (w - 2 * ALARM_MARGIN - total) / chain.length);
  const cy = h / 2;
  const out: FlowNode[] = [];
  let left = ALARM_MARGIN;
  for (const id of chain) {
    out.push(node(id, sizes, left + sizes[id].w / 2, cy));
    left += sizes[id].w + gap;
  }
  const stack = BRANCHES.reduce((a, id) => a + sizes[id].h, 0);
  const gapY = Math.min(MAX_GAP_Y, Math.max(MIN_GAP, (h - 2 * ALARM_MARGIN - stack) / (BRANCHES.length - 1)));
  let top = cy - (stack + gapY * (BRANCHES.length - 1)) / 2;
  const colX = left + columnW / 2;
  for (const id of BRANCHES) {
    out.push(node(id, sizes, colX, top + sizes[id].h / 2));
    top += sizes[id].h + gapY;
  }
  return out;
}

function narrowLayout(w: number, h: number, sizes: Sizes): FlowNode[] {
  const chain: AlarmId[] = ['izleme', 'esik', 'alarm', 'inceleme', 'neden'];
  const rows: AlarmId[][] = [...chain.map(id => [id]), [BRANCHES[0], BRANCHES[1]], [BRANCHES[2], BRANCHES[3]]];
  const rowH = rows.map(r => Math.max(...r.map(id => sizes[id].h)));
  const gapY = Math.min(MAX_GAP_Y, Math.max(MIN_GAP, (h - 2 * ALARM_MARGIN - rowH.reduce((a, b) => a + b, 0)) / (rows.length - 1)));
  const used = rowH.reduce((a, b) => a + b, 0) + gapY * (rows.length - 1);
  const colW = Math.max(...BRANCHES.map(id => sizes[id].w));
  const gapX = Math.min(MAX_GAP_Y, Math.max(MIN_GAP, w - 2 * ALARM_MARGIN - 2 * colW));
  const cx = w / 2;
  const out: FlowNode[] = [];
  let top = Math.max(ALARM_MARGIN, (h - used) / 2);
  rows.forEach((row, r) => {
    const y = top + rowH[r] / 2;
    if (row.length === 1) {
      out.push(node(row[0], sizes, cx, y));
    } else {
      out.push(node(row[0], sizes, cx - gapX / 2 - colW / 2, y), node(row[1], sizes, cx + gapX / 2 + colW / 2, y));
    }
    top += rowH[r] + gapY;
  });
  // chain first, then the branches row by row, as ALARM_IDS lists them
  return ALARM_IDS.map(id => out.find(n => n.id === id)!);
}

/**
 * The nine nodes of the alarm flow in the `w` x `h` area. Wide: the chain from left to right on the middle line, the
 * four branches stacked at its right end. Narrow: the chain from top to bottom, the branches in a 2 x 2 grid below.
 * `sizes` are the boxes the labels need (`alarmSizes`, measured by the scene); without them the boxes are estimated
 * from the character count at 13 px.
 */
export function alarmLayout(w: number, h: number, narrow: boolean, sizes: Sizes = alarmSizes(ESTIMATE, FALLBACK_PX)): FlowNode[] {
  return narrow ? narrowLayout(w, h, sizes) : wideLayout(w, h, sizes);
}
