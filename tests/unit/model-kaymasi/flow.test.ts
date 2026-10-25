import { describe, expect, it } from 'vitest';
import type { TextMeasure } from '../../../src/core/plot/text-measure';
import {
  ALARM_EDGES, ALARM_IDS, ALARM_LABELS, ALARM_PATH, alarmEdges, alarmLayout, alarmSizes, edgeClear, narrowFlowHeight,
  narrowLabels, type AlarmId,
} from '../../../src/concepts/model-kaymasi/flow';

/** A text measure that estimates widths from the character count (jsdom has no layout). */
const estimator = (): TextMeasure => {
  const width = (t: string, fs: number): number => t.length * fs * 0.6;
  return {
    maxWidth: (lines: string[], _cls: string, fs: number) => Math.max(...lines.map(l => width(l, fs))),
    wrap: (text: string, maxW: number, _cls: string, fs: number) => {
      const lines: string[] = [];
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && width(next, fs) > maxW) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      return line ? [...lines, line] : lines;
    },
  } as unknown as TextMeasure;
};

const sizesAt = (fs: number) => alarmSizes(estimator(), fs);
/** Sizes as the scene measures them in a narrow area: the labels wrapped so the chain and the column of causes fit side by side. */
const narrowSizes = (w: number, fs: number) => alarmSizes(estimator(), fs, narrowLabels(estimator(), fs, w));

// phone, Lab stage beside the controls, a wide stage; fallback sizes and measured sizes of 13 and 18 px labels
const cases: [number, number, boolean, ReturnType<typeof sizesAt> | undefined][] = [
  [390, narrowFlowHeight(narrowSizes(390, 13)), true, narrowSizes(390, 13)],
  [390, narrowFlowHeight(narrowSizes(390, 14)) + 40, true, narrowSizes(390, 14)],
  [560, narrowFlowHeight(narrowSizes(560, 13)), true, narrowSizes(560, 13)],
  [900, 360, false, sizesAt(13)],
  [1280, 540, false, undefined],
  [1280, 540, false, sizesAt(18)],
];

describe('model-kaymasi alarm flow', () => {
  it('alarm flow nodes do not overlap at 390 and 1280', () => {
    for (const [w, h, narrow, sizes] of cases) {
      const nodes = alarmLayout(w, h, narrow, sizes);
      expect(nodes.map(n => n.id)).toEqual([...ALARM_IDS]);
      for (const n of nodes) {
        expect(n.x - n.w / 2, `${n.id} left ${w}x${h}`).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w / 2, `${n.id} right ${w}x${h}`).toBeLessThanOrEqual(w);
        expect(n.y - n.h / 2, `${n.id} top ${w}x${h}`).toBeGreaterThanOrEqual(0);
        expect(n.y + n.h / 2, `${n.id} bottom ${w}x${h}`).toBeLessThanOrEqual(h);
      }
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
          expect(apart, `${a.id} ${b.id} at ${w}x${h} narrow=${narrow}`).toBe(true);
        }
      }
    }
  });

  it('the boxes already fit their labels', () => {
    const fs = 13;
    const need = narrowSizes(390, fs);
    for (const n of alarmLayout(390, 640, true, need)) {
      expect(n.w).toBeGreaterThanOrEqual(need[n.id as AlarmId].w - 1e-9);
      expect(n.h).toBeGreaterThanOrEqual(need[n.id as AlarmId].h - 1e-9);
    }
    // without measured sizes the fallback still holds every label (estimated at the Lab body size)
    for (const n of alarmLayout(1280, 540, false)) {
      expect(n.w).toBeGreaterThan(0);
      expect(n.h).toBeGreaterThan(0);
    }
  });

  it('wide runs left to right with the four branches stacked on the right, narrow runs top to bottom with the cause decision between two rows of causes', () => {
    const by = (nodes: ReturnType<typeof alarmLayout>) => Object.fromEntries(nodes.map(n => [n.id, n]));
    const wide = by(alarmLayout(1280, 540, false, sizesAt(18)));
    const chain: AlarmId[] = ['izleme', 'esik', 'alarm', 'inceleme', 'neden'];
    for (let i = 1; i < chain.length; i += 1) {
      expect(wide[chain[i]].x).toBeGreaterThan(wide[chain[i - 1]].x);
    }
    const branches: AlarmId[] = ['kalite', 'mevsim', 'davranis', 'yonetisim'];
    for (const id of branches) {
      expect(wide[id].x).toBeGreaterThan(wide.neden.x);
    }
    for (let i = 1; i < branches.length; i += 1) {
      expect(wide[branches[i]].y).toBeGreaterThan(wide[branches[i - 1]].y);
    }
    const narrow = by(alarmLayout(390, narrowFlowHeight(narrowSizes(390, 13)), true, narrowSizes(390, 13)));
    for (let i = 1; i < chain.length; i += 1) {
      expect(narrow[chain[i]].y).toBeGreaterThan(narrow[chain[i - 1]].y);
    }
    // the cause decision stands centred between the two cause rows, so its edges to the lower row pass no box
    expect(narrow.kalite.y).toBeCloseTo(narrow.mevsim.y, 6);
    expect(narrow.davranis.y).toBeCloseTo(narrow.yonetisim.y, 6);
    expect(narrow.kalite.x).toBeLessThan(narrow.mevsim.x);
    expect(narrow.davranis.x).toBeCloseTo(narrow.kalite.x, 6);
    expect(narrow.neden.x).toBeCloseTo(195, 6);
    expect(narrow.inceleme.y).toBeLessThan(narrow.kalite.y);
    expect(narrow.kalite.y).toBeLessThan(narrow.neden.y);
    expect(narrow.neden.y).toBeLessThan(narrow.davranis.y);
  });

  it('nodes carry the book labels and kinds', () => {
    const nodes = alarmLayout(1280, 540, false);
    const by = Object.fromEntries(nodes.map(n => [n.id, n]));
    expect(by.esik.kind).toBe('decision');
    expect(by.neden.kind).toBe('decision');
    expect(by.izleme.kind).toBe('phase');
    const text = (id: AlarmId): string => ALARM_LABELS[id].join(' ');
    expect(text('esik')).toBe('Eşik aşıldı mı?');
    expect(text('alarm')).toBe('Alarm ve kayıt');
    expect(text('inceleme')).toBe('İnsan incelemesi');
    expect(text('neden')).toBe('Neden?');
    expect(text('kalite')).toBe('veri kalitesi: veri hattını düzelt');
    expect(text('mevsim')).toBe('mevsimsellik: eşiği ve referansı gözden geçir');
    expect(text('davranis')).toBe('gerçek davranış değişimi: yeniden değerlendirme ve eğitim');
    expect(text('yonetisim')).toBe('adillik veya gizlilik: yönetişim onayı');
    for (const n of nodes) {
      expect(n.label).toEqual(ALARM_LABELS[n.id as AlarmId]);
    }
  });

  it('edges carry the book labels and kinds', () => {
    const by = Object.fromEntries(ALARM_EDGES.map(e => [e.id, e]));
    expect(ALARM_EDGES.map(e => e.id).sort()).toEqual([
      'alarm-inceleme', 'davranis-izleme', 'esik-alarm', 'esik-izleme', 'inceleme-neden', 'izleme-esik', 'kalite-izleme',
      'mevsim-izleme', 'neden-davranis', 'neden-kalite', 'neden-mevsim', 'neden-yonetisim', 'yonetisim-izleme',
    ]);
    expect(by['esik-izleme'].kind).toBe('back');
    expect(by['esik-izleme'].label).toBe('Hayır');
    expect(by['esik-alarm'].label).toBe('Evet');
    for (const id of ['kalite-izleme', 'mevsim-izleme', 'davranis-izleme', 'yonetisim-izleme']) {
      expect(by[id].kind, id).toBe('outer');
      expect(by[id].to).toBe('izleme');
    }
    for (const e of ALARM_EDGES) {
      expect(ALARM_IDS).toContain(e.from);
      expect(ALARM_IDS).toContain(e.to);
      expect(e.id).toBe(`${e.from}-${e.to}`);
    }
  });

  it('alarm path runs through the behaviour branch', () => {
    expect(ALARM_PATH).toEqual([
      'izleme-esik', 'esik-alarm', 'alarm-inceleme', 'inceleme-neden', 'neden-davranis', 'davranis-izleme',
    ]);
    const by = Object.fromEntries(ALARM_EDGES.map(e => [e.id, e]));
    ALARM_PATH.forEach((id, i) => {
      expect(by[id], id).toBeDefined();
      if (i > 0) {
        expect(by[id].from).toBe(by[ALARM_PATH[i - 1]].to);
      }
    });
    expect(by[ALARM_PATH[0]].from).toBe('izleme');
    expect(by[ALARM_PATH.at(-1)!].to).toBe('izleme');
  });

  it('in the narrow layout no edge runs behind a box other than its own two ends', () => {
    for (const [w, fs] of [[390, 13], [390, 14], [560, 13], [745, 13]] as const) {
      const sizes = narrowSizes(w, fs);
      const h = narrowFlowHeight(sizes);
      const nodes = alarmLayout(w, h, true, sizes);
      expect(h).toBeGreaterThanOrEqual(0);
      for (const e of alarmEdges(nodes, w, true)) {
        expect(edgeClear(e, nodes, w), `${e.id} at ${w} px, ${fs} px labels`).toBe(true);
      }
    }
  });

  it('the narrow height covers the rows the layout draws', () => {
    const sizes = narrowSizes(390, 16);
    const h = narrowFlowHeight(sizes);
    for (const n of alarmLayout(390, h, true, sizes)) {
      expect(n.y - n.h / 2, n.id).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h / 2, n.id).toBeLessThanOrEqual(h);
    }
  });

  it('the edge test catches an edge behind a box', () => {
    const sizes = narrowSizes(390, 13);
    const nodes = alarmLayout(390, narrowFlowHeight(sizes), true, sizes).map(n => ({ ...n }));
    const by = Object.fromEntries(nodes.map(n => [n.id, n]));
    // a cause moved onto the straight line from the decision to the last cause
    const edge = ALARM_EDGES.find(e => e.id === 'neden-yonetisim')!;
    by.mevsim.x = (by.neden.x + by.yonetisim.x) / 2;
    by.mevsim.y = (by.neden.y + by.yonetisim.y) / 2;
    expect(edgeClear({ ...edge, bend: 0 }, nodes, 390)).toBe(false);
  });
});
