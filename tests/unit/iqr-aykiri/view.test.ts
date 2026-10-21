import { describe, it, expect } from 'vitest';
import { deriveIqrView, LINE } from '../../../src/concepts/iqr-aykiri/view';
import { iqrAykiriScenario, type IqrParams } from '../../../src/concepts/iqr-aykiri/scenario';

const base = (i: number): IqrParams => ({ ...iqrAykiriScenario.defaults, ...iqrAykiriScenario.steps[i].params });
const V = (i: number, over: Partial<IqrParams> = {}) => deriveIqrView(i, { ...base(i), ...over });
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-4);
const mk = (v: ReturnType<typeof V>, kind: string) => v.markers.find((m) => m.kind === kind);

describe('iqr-aykiri view', () => {
  it('LINE breaks at 100 up to 600', () => {
    expect(LINE).toEqual({ min: 0, max: 100, breakAt: 100, farMax: 600 });
  });

  it('part per step', () => {
    expect([...Array(11).keys()].map((i) => V(i).part)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
  });

  it('strips at the book values', () => {
    const s = (i: number) => V(i).strip;
    expect(s(0)).toBe('8 hücreden 2’si boş: %25 eksik');
    expect(s(1)).toBe('(29,85 + 56,95 + 42,30 + 38,50 + 200,00 + 45,00) / 6 = 68,77');
    expect(s(2)).toBe('(42,30 + 45,00) / 2 = 43,65');
    expect(s(3)).toBe('SimpleImputer(strategy="mean") → 68,77');
    expect(s(4)).toBe('strategy="median" → 43,65');
    expect(s(5)).toBe('sıralı: 29,85 · 38,50 · 42,30 · 45,00 · 51,10 · 56,95 · 60,20 · 480,00');
    expect(s(6)).toBe('Q1 = 38,50 + 0,75 · (42,30 − 38,50) = 41,35');
    expect(s(7)).toBe('Q3 = 56,95 + 0,25 · (60,20 − 56,95) = 57,76\nIQR = 57,76 − 41,35 = 16,41');
    expect(s(8)).toBe(
      '1,5 · 16,41 = 24,62 → alt 41,35 − 24,62 = 16,73 · üst 57,76 + 24,62 = 82,38\naykırı: 480,00',
    );
    expect(s(9)).toBe('z(480) = (480 − 100,49) / 143,74 = 2,64 < 3\nIQR: aykırı · Z-score: aykırı değil');
    expect(s(10)).toBe(
      'ortalama olduğu gibi 100,49 · silince 46,27 · kırpınca 50,79\nkırpınca 480,00 → 82,38',
    );
  });

  it('k = 3 strip and sil strips', () => {
    expect(V(8, { k: 3 }).strip.split('\n')[0]).toBe(
      '3,0 · 16,41 = 49,24 → alt 41,35 − 49,24 = −7,89 · üst 57,76 + 49,24 = 107,00',
    );
    expect(V(5, { action: 'sil' }).strip).toBe(
      'sıralı (n = 7): 29,85 · 38,50 · 42,30 · 45,00 · 51,10 · 56,95 · 60,20',
    );
  });

  it('step 1: six points, 200 far with its label', () => {
    const v = V(0);
    expect(v.points).toHaveLength(6);
    expect(v.points.every((p) => p.shape === 'normal')).toBe(true);
    const far = v.points.filter((p) => p.far);
    expect(far).toHaveLength(1);
    expect(far[0].value).toBe(200);
    expect(far[0].label).toBe('200,00');
    expect(v.cells).toHaveLength(8);
    expect(v.cells.filter((c) => c.empty).map((c) => c.text)).toEqual(['boş', 'boş']);
    expect(v.sorted).toBe(false);
    expect(v.markers).toEqual([]);
  });

  it('step 2: mean 68,77 arrives from the axis start', () => {
    const v = V(1);
    near(mk(v, 'mean')!.value, 68.7667);
    expect(mk(v, 'mean')!.label).toBe('ortalama 68,77');
    expect(v.meanFrom).toBe('start');
    expect(V(2).meanFrom).toBeNull();
  });

  it('step 2: mean lies right of the crowd', () => {
    const v = V(1);
    const crowd = Math.max(...v.points.filter((p) => !p.far).map((p) => p.value));
    expect(mk(v, 'mean')!.value).toBeGreaterThan(crowd);
  });

  it('step 3: sorted, ranks 0-5, mid pair highlighted, median marker', () => {
    const v = V(2);
    expect(v.sorted).toBe(true);
    expect(v.ranks).toBe(true);
    const full = v.cells.filter((c) => !c.empty);
    expect(full.map((c) => c.rank).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(v.cells.filter((c) => c.empty).every((c) => c.slot >= 6)).toBe(true);
    expect(v.cells.filter((c) => c.highlight).map((c) => c.text).sort()).toEqual(['42,30', '45,00']);
    expect(v.points.filter((p) => p.highlight).map((p) => p.value).sort()).toEqual([42.3, 45]);
    expect(mk(v, 'median')!.label).toBe('medyan 43,65');
  });

  it('step 4: two filled points at 68,77', () => {
    const v = V(3);
    const f = v.points.filter((p) => p.shape === 'filled');
    expect(f).toHaveLength(2);
    f.forEach((p) => near(p.value, 68.7667));
    expect(f.every((p) => /^1-f\d$/.test(p.key))).toBe(true);
    const c = v.cells.filter((x) => x.filled);
    expect(c).toHaveLength(2);
    expect(c.every((x) => x.text === '68,77' && !x.empty)).toBe(true);
    expect(v.ranks).toBe(false);
  });

  it('step 5: same diamonds at 43,65', () => {
    const a = V(3).points.filter((p) => p.shape === 'filled').map((p) => p.key);
    const b = V(4).points.filter((p) => p.shape === 'filled');
    expect(b.map((p) => p.key)).toEqual(a);
    b.forEach((p) => near(p.value, 43.65));
  });

  it('step 6: part 2 data, 480 far', () => {
    const v = V(5);
    expect(v.part).toBe(2);
    expect(v.points).toHaveLength(8);
    const far = v.points.filter((p) => p.far);
    expect(far.map((p) => p.label)).toEqual(['480,00']);
    expect(v.sorted && v.ranks).toBe(true);
    const bySlot = [...v.cells].sort((a, b) => a.slot - b.slot);
    expect(bySlot.map((c) => c.rank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bySlot[7].text).toBe('480,00');
  });

  it('step 7: Q1 position 1,75', () => {
    const v = V(6);
    near(v.posMark!.pos, 1.75);
    expect(v.posMark!.label).toBe('konum 0,25 · 7 = 1,75');
    expect(v.cells.filter((c) => c.highlight).map((c) => c.rank).sort()).toEqual([1, 2]);
    expect(mk(v, 'q1')!.label).toBe('Q1 41,35');
    expect(mk(v, 'q3')).toBeUndefined();
    expect(v.box).toBeNull();
  });

  it('step 8: Q3 position 5,25 and the box', () => {
    const v = V(7);
    near(v.posMark!.pos, 5.25);
    expect(v.posMark!.label).toBe('konum 0,75 · 7 = 5,25');
    expect(mk(v, 'q3')!.label).toBe('Q3 57,76');
    near(v.box!.q1, 41.35);
    near(v.box!.q3, 57.7625);
  });

  it('step 9: fences, outlier and whiskers', () => {
    const v = V(8);
    expect(v.arms!.label).toBe('1,5 · IQR = 24,62');
    expect(mk(v, 'lo')!.label).toBe('alt 16,73');
    expect(mk(v, 'hi')!.label).toBe('üst 82,38');
    const o = v.points.filter((p) => p.shape === 'outlier');
    expect(o).toHaveLength(1);
    expect(o[0].label).toBe('480,00 · aykırı');
    expect(v.cells.filter((c) => c.outlier)).toHaveLength(1);
    expect(v.whiskers).toEqual([29.85, 60.2]);
    expect(V(9).arms).toBeNull();
    expect(V(9).whiskers).toEqual([29.85, 60.2]);
    expect(V(7).whiskers).toBeNull();
  });

  it('step 10: z band and strip', () => {
    const v = V(9);
    near(mk(v, 'mean')!.value, 100.4875);
    expect(v.zBand!.loLabel).toBe('μ − 3σ = −330,73');
    expect(v.zBand!.hiLabel).toBe('μ + 3σ = 531,70');
    expect(Math.abs(v.zBand!.lo + 330.73)).toBeLessThan(0.01);
    expect(V(8).zBand).toBeNull();
    expect(V(10).zBand).toBeNull();
  });

  it('step 11: clip moves 480 to 82,38', () => {
    const v = V(10);
    const p = v.points.find((x) => x.shape === 'outlier')!;
    near(p.value, 82.38125);
    expect(p.far).toBe(false);
    expect(p.label).toBe('82,38');
    const c = v.cells.filter((x) => x.clipped);
    expect(c).toHaveLength(1);
    expect(c[0].text).toBe('82,38');
    expect(V(8).points.find((x) => x.shape === 'outlier')!.key).toBe(p.key);
  });

  it('sil recomputes quartiles and fences with n = 7', () => {
    const v = V(10, { action: 'sil' });
    expect(v.strip).toBe(
      'ortalama olduğu gibi 100,49 · silince 46,27 · kırpınca 50,79\nsilince n = 7: Q1 = 40,40 · Q3 = 54,03 · sınırlar 19,96 / 74,46',
    );
    const d = v.cells.filter((c) => c.deleted);
    expect(d).toHaveLength(1);
    expect(d[0].rank).toBeNull();
    expect(v.cells.filter((c) => !c.deleted).map((c) => c.rank).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(v.points.filter((p) => p.deleted)).toHaveLength(1);
    near(mk(v, 'q1')!.value, 40.4);
  });

  it('lab: extreme 300 moves the mean, not the median', () => {
    const v = V(2, { extreme: 300 });
    near(mk(v, 'median')!.value, 43.65);
    near(mk(V(1, { extreme: 300 }), 'mean')!.value, 85.4333);
  });

  it('notes follow the extreme', () => {
    expect(V(1).note).toBe(
      'Uç değer 200,00 → ortalama 68,77, medyan 43,65: ortalama uç değerle kayar, medyan yerinde kalır.',
    );
    expect(V(1, { extreme: 300 }).note).toBe(
      'Uç değer 300,00 → ortalama 85,43, medyan 43,65: ortalama uç değerle kayar, medyan yerinde kalır.',
    );
    expect(V(8).note).toBe('Uç değer 480,00 üst sınırın (82,38) dışında: aykırı.');
    expect(V(8, { extreme: 75 }).note).toBe('Uç değer 75,00 sınırların içinde: aykırı değil.');
  });

  it('extreme 50 sorts into the crowd', () => {
    const v = V(5, { extreme: 50 });
    const c = v.cells.find((x) => x.text === '50,00')!;
    expect(c.slot).toBe(4);
    expect(c.rank).toBe(4);
    const p1 = V(2, { extreme: 50 });
    expect(p1.cells.find((x) => x.text === '50,00')!.slot).toBe(4);
  });

  it('no outlier: steps 9-11 say so, no NaN', () => {
    for (const i of [8, 9, 10]) {
      const v = V(i, { extreme: 75 });
      expect(v.strip.split('\n')[1]).toBe('Sınırların dışında gözlem yok');
      expect(v.strip).not.toMatch(/NaN|undefined/);
    }
    expect(V(8, { extreme: 75 }).points.some((p) => p.shape === 'outlier')).toBe(false);
  });

  it('extreme slider across the break and the fence keeps every mark consistent', () => {
    const far = (e: number) => V(8, { extreme: e }).points.find((p) => p.key === '2-7')!;
    expect(far(480).far).toBe(true);
    expect(far(101).far).toBe(true);
    expect(far(99).far).toBe(false);
    const tri = (e: number) => V(8, { extreme: e }).points.some((p) => p.shape === 'outlier');
    expect([480, 101, 99, 83, 82, 60].map(tri)).toEqual([true, true, true, true, false, false]);
    for (const e of [480, 101, 99, 83, 82, 60, 50, 500]) {
      for (const k of [1.5, 3] as const) {
        for (const action of ['yok', 'sil', 'kirp'] as const) {
          for (let i = 0; i < 11; i++) {
            const v = V(i, { extreme: e, k, action });
            const txt = [
              v.strip, v.note, ...v.points.map((p) => p.label ?? ''), ...v.markers.map((m) => m.label),
              v.arms?.label ?? '', v.zBand?.loLabel ?? '', v.zBand?.hiLabel ?? '', v.posMark?.label ?? '',
              ...v.cells.map((c) => c.text),
            ].join('|');
            expect(txt).not.toMatch(/NaN|undefined/);
          }
        }
      }
    }
  });
});
