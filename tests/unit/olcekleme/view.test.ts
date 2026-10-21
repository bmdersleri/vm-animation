import { describe, it, expect, vi } from 'vitest';
import { deriveOlcView } from '../../../src/concepts/olcekleme/view';
import { olceklemeScenario, type OlcParams } from '../../../src/concepts/olcekleme/scenario';
import { CUSTOMERS } from '../../../src/concepts/olcekleme/data';
import fixture from '../../fixtures/onisleme_sklearn.json';

const base = (i: number): OlcParams => ({ ...olceklemeScenario.defaults, ...olceklemeScenario.steps[i].params });
const V = (i: number, over: Partial<OlcParams> = {}) => deriveOlcView(i, { ...base(i), ...over });
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);
const nearestIds = (v: ReturnType<typeof V>) => v.scatter!.customers.filter((c) => c.nearest).map((c) => c.id);
const UN = { ay: 'ay', yil: 'yıl', gun: 'gün' } as const;

describe('olcekleme view', () => {
  it('kind and part per step', () => {
    const idx = [...Array(13).keys()];
    expect(idx.map((i) => V(i).kind)).toEqual([
      ...Array(7).fill('scatter'), 'scalers', 'scatter', ...Array(4).fill('split'),
    ]);
    expect(idx.map((i) => V(i).part)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it('strips at the book values', () => {
    const s = (i: number, over: Partial<OlcParams> = {}) => V(i, over).strip;
    expect(s(0)).toBe('hizmet süresi 1–60 ay · aylık fatura 29,85–200 TL');
    expect(s(1)).toBe('d = √((12 − 2)² + (55 − 42,30)²) = √(100 + 161,29) = 16,16');
    expect(s(2, { unit: 'ay' })).toBe('ay: en yakın M3, d = 16,16');
    expect(s(2, { unit: 'yil' })).toBe('yıl: en yakın M2, d = 2,68');
    expect(s(2, { unit: 'gun' })).toBe('gün: en yakın M5, d = 188,22');
    expect(s(3)).toBe('hizmet süresi μ = 25, σ = 22,73 · fatura μ = 72,95, σ = 58,29');
    expect(s(4)).toBe('x − μ: hizmet süresi − 25 · fatura − 72,95');
    expect(s(5)).toBe('z = (200 − 72,95) / 58,29 = 2,18');
    for (const u of ['ay', 'yil', 'gun'] as const) {
      expect(s(6, { unit: u })).toBe(`${UN[u]} → z: en yakın M3, d = 0,49`);
    }
    expect(s(7)).toBe(
      'StandardScaler (x − 72,95) / 58,29 · MinMaxScaler (x − 29,85) / 170,15 · RobustScaler (x − 49,63) / 27,36',
    );
    expect(s(8)).toBe('((12 − 25) / 22,73; (55 − 72,95) / 58,29) = (−0,57; −0,31)');
    expect(s(9)).toBe('stratify: churn oranı eğitimde 0,29, testte 0,33');
    expect(s(10)).toBe('eğitimden fit: μ = 58,63, σ = 19,26 → test z: −0,71 · −1,33 · −1,04');
    expect(s(11)).toBe('tüm veriyle fit: μ = 52,69, σ = 18,69 → test z: −0,41 · −1,05 · −0,76');
    expect(s(12)).toBe('önce ayır, sonra öğren, sonra uygula');
  });

  it('step 10 and 11 strips follow the chosen fit scope', () => {
    expect(V(10, { fit: 'tum' }).strip).toBe(V(11).strip);
    expect(V(11, { fit: 'egitim' }).strip).toBe(V(10).strip);
  });

  it('step 1: axis titles and ranges', () => {
    const v = V(0);
    expect(v.scatter!.axisTitles).toEqual({ x: 'Hizmet süresi (ay)', y: 'Aylık fatura (TL)' });
    expect(V(2, { unit: 'yil' }).scatter!.axisTitles.x).toBe('Hizmet süresi (yıl)');
    expect(V(2, { unit: 'gun' }).scatter!.axisTitles.x).toBe('Hizmet süresi (gün)');
    expect(V(5, { unit: 'gun' }).scatter!.axisTitles).toEqual({
      x: 'Hizmet süresi (z, birim: gün)', y: 'Aylık fatura (z)',
    });
    expect(v.scatter!.customers).toHaveLength(6);
    expect(v.scatter!.aspect).toBe('ay-orani');
    expect(v.scatter!.queryShown).toBe(false);
    expect(v.scatter!.lines).toBe(false);
    expect(v.scatter!.iso).toBeNull();
  });

  it('step 2: distances and nearest M3', () => {
    const v = V(1);
    const s = v.scatter!;
    expect(nearestIds(v)).toEqual(['M3']);
    expect(s.queryShown && s.lines).toBe(true);
    near(s.iso!.r, s.customers[2].d);
    expect(s.query.label).toBe('Yeni (12 ay; 55 TL)');
    near(s.query.x, 12);
    expect(s.box.x).toEqual([0, 64]);
    expect(s.box.y).toEqual([20, 210]);
  });

  it('step 3: nearest per unit with its distance', () => {
    const got = (['ay', 'yil', 'gun'] as const).map((u) => nearestIds(V(2, { unit: u }))[0]);
    expect(got).toEqual(['M3', 'M2', 'M5']);
    const yil = V(2, { unit: 'yil' }).scatter!;
    near(yil.customers[1].x, 34 / 12);
    near(yil.box.x[1], 64 / 12);
    expect(yil.query.label).toBe('Yeni (1 yıl; 55 TL)');
    expect(V(2, { unit: 'gun' }).scatter!.query.label).toBe('Yeni (360 gün; 55 TL)');
  });

  it('step 4: μ and σ per axis', () => {
    const m = V(3).scatter!.mu!;
    near(m.x, 25);
    near(m.y, 72.95);
    expect(Math.abs(m.sx - 22.73)).toBeLessThan(0.01);
    expect(Math.abs(m.sy - 58.29)).toBeLessThan(0.01);
    expect(m.labels).toEqual(['μ = 25, σ = 22,73', 'μ = 72,95, σ = 58,29']);
    expect(V(3, { unit: 'gun' }).scatter!.mu!.labels[0]).toBe('μ = 750, σ = 681,91');
    expect(V(1).scatter!.mu).toBeNull();
    expect(V(8).scatter!.mu).toBeNull();
  });

  it('step 5: shifted space, μ at zero', () => {
    const s = V(4).scatter!;
    near(s.mu!.x, 0);
    near(s.mu!.y, 0);
    near(s.customers[0].x, 1 - 25);
    near(s.customers[0].y, 29.85 - 72.95);
    near(s.box.x[0], -25);
    expect(s.aspect).toBe('ay-orani');
    near(s.customers[2].d, V(1).scatter!.customers[2].d);
    const z = V(5).scatter!;
    expect(z.mu).toMatchObject({ x: 0, y: 0, sx: 1, sy: 1 });
    expect(z.aspect).toBe('esit');
  });

  it('plot frames: raw views widen from the box minimum, steps 4 and 5 share one frame, z keeps the centre', () => {
    for (const i of [0, 1, 2]) {
      const s = V(i).scatter!;
      expect(s.frame).toEqual(s.box);
      expect(s.anchor).toBe('min');
    }
    const s4 = V(3).scatter!;
    const s5 = V(4).scatter!;
    expect(s4.frame).toEqual(s5.frame);
    expect(s4.anchor).toBe('min');
    expect(s5.anchor).toBe('min');
    near(s5.frame.x[0], -25);
    near(s5.frame.x[1], 64);
    near(s5.frame.y[0], 20 - 72.95);
    near(s5.frame.y[1], 210);
    // the raw box (step 4) and the centred box (step 5) both lie inside it
    for (const b of [s4.box, s5.box]) {
      expect(b.x[0]).toBeGreaterThanOrEqual(s5.frame.x[0] - 1e-9);
      expect(b.x[1]).toBeLessThanOrEqual(s5.frame.x[1] + 1e-9);
      expect(b.y[0]).toBeGreaterThanOrEqual(s5.frame.y[0] - 1e-9);
      expect(b.y[1]).toBeLessThanOrEqual(s5.frame.y[1] + 1e-9);
    }
    near(V(4, { unit: 'gun' }).scatter!.frame.x[0], -750);
    const z = V(5).scatter!;
    expect(z.frame).toEqual(z.box);
    expect(z.anchor).toBe('centre');
  });

  it('step 5: the query label shows x − μ', () => {
    expect(V(4).scatter!.query.label).toBe('Yeni (−13 ay; −17,95 TL)');
    expect(V(4, { query: { t: 25, f: 72.95 } }).scatter!.query.label).toBe('Yeni (0 ay; 0 TL)');
    expect(V(4, { query: { t: 25.004, f: 80 } }).scatter!.query.label).toBe('Yeni (0,004 ay; 7,05 TL)');
    expect(V(3).scatter!.query.label).toBe('Yeni (12 ay; 55 TL)');
  });

  it('step 7: z positions and M3 at every unit', () => {
    const pos = (u: 'ay' | 'yil' | 'gun') => V(6, { unit: u }).scatter!.customers.map((c) => [c.x, c.y, c.d]);
    const a = pos('ay');
    expect(pos('yil')).toEqual(a);
    expect(pos('gun')).toEqual(a);
    (['ay', 'yil', 'gun'] as const).forEach((u) => expect(nearestIds(V(6, { unit: u }))).toEqual(['M3']));
    CUSTOMERS.forEach((_, i) => {
      near(V(6).scatter!.customers[i].x, fixture.scale.z[i][0]);
      near(V(6).scatter!.customers[i].y, fixture.scale.z[i][1]);
    });
  });

  it('step 8: MinMax squeezes the crowd, Robust keeps it open', () => {
    const sc = V(7).scalers!;
    expect(sc.domain).toEqual([-1, 6]);
    expect(sc.lines.map((l) => l.name)).toEqual(['StandardScaler', 'MinMaxScaler', 'RobustScaler']);
    sc.lines.forEach((l) => {
      expect(l.values).toHaveLength(6);
      expect(l.labels).toHaveLength(6);
    });
    const mm = sc.lines[1].values;
    near(mm[4], 1);
    mm.filter((_, i) => i !== 4).forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(0.25);
    });
    const width = (vs: number[]) => {
      const rest = vs.filter((_, i) => i !== 4);
      return Math.max(...rest) - Math.min(...rest);
    };
    const [st, m, ro] = sc.lines.map((l) => width(l.values));
    expect(ro).toBeGreaterThan(st);
    expect(st).toBeGreaterThan(m);
    expect(V(7).scatter).toBeNull();
  });

  it('step 9: transform with the train μ and σ', () => {
    const s = V(8).scatter!;
    expect(s.query.label).toBe('Yeni (−0,57; −0,31)');
    expect(s.space).toBe('z');
  });

  it('query label shows z when scaled', () => {
    expect(V(5, { query: { t: 30, f: 100 } }).scatter!.query.label).toMatch(/^Yeni \(−?\d,\d\d; −?\d,\d\d\)$/);
    expect(V(1, { query: { t: 30, f: 100 } }).scatter!.query.label).toBe('Yeni (30 ay; 100 TL)');
    expect(V(1, { query: { t: 30, f: 55.5 } }).scatter!.query.label).toBe('Yeni (30 ay; 55,50 TL)');
  });

  it('steps 10–13: split view', () => {
    const a = V(9).split!;
    expect(a.values).toHaveLength(10);
    expect(a.train).toHaveLength(7);
    expect(a.test).toHaveLength(3);
    expect(a.separated).toBe(true);
    expect(a.fit).toBeNull();
    expect(a.testZ).toBeNull();
    expect(a.flow).toBe(false);
    const b = V(10).split!;
    expect(b.fadeTest).toBe(true);
    expect(b.fit!.scope).toBe('egitim');
    near(b.fit!.mu, 58.628571428571426);
    expect(b.testZ).toEqual(['−0,71', '−1,33', '−1,04']);
    expect(b.ghostMu).toBeNull();
    const c = V(11).split!;
    expect(c.fit!.scope).toBe('tum');
    expect(Math.abs(c.ghostMu! - 58.63)).toBeLessThan(0.01);
    expect(c.fadeTest).toBe(false);
    expect(c.testZ).toEqual(['−0,41', '−1,05', '−0,76']);
    const d = V(12).split!;
    expect(d.flow).toBe(true);
    expect(d.fit!.scope).toBe('egitim');
    expect(V(12, { fit: 'tum' }).split!.fit!.scope).toBe('tum');
    expect(V(0).split).toBeNull();
  });

  it('query moves: distances, nearest, iso radius and strip follow', () => {
    const dc = fixture.scale.dragCases[0];
    const q = { t: dc.query[0], f: dc.query[1] };
    const v = V(1, { query: q });
    const s = v.scatter!;
    s.customers.forEach((c, i) => near(c.d, dc.dist.ay[i]));
    near(s.iso!.r, Math.min(...dc.dist.ay));
    expect(nearestIds(v)).toEqual([CUSTOMERS[dc.nearest.ay].id]);
    expect(v.strip).toBe('d = √((30 − 60)² + (100 − 70,10)²) = √(900 + 894,01) = 42,36');
    V(5, { query: q }).scatter!.customers.forEach((c, i) => near(c.d, dc.dist.z[i]));
    V(2, { unit: 'gun', query: q }).scatter!.customers.forEach((c, i) => near(c.d, dc.dist.gun[i]));
  });

  it('ties pick the first customer', async () => {
    // two customers at the very same spot: equal distances in every unit and in z
    vi.resetModules();
    vi.doMock('../../../src/concepts/olcekleme/data', async (orig) => {
      const real = await orig<typeof import('../../../src/concepts/olcekleme/data')>();
      const customers = real.CUSTOMERS.map((c, i) => (i === 3 ? { ...c, t: real.CUSTOMERS[0].t, f: real.CUSTOMERS[0].f } : c));
      return { ...real, CUSTOMERS: customers };
    });
    const mod = await import('../../../src/concepts/olcekleme/view');
    const sc = await import('../../../src/concepts/olcekleme/scenario');
    const params = (over: Partial<OlcParams>): OlcParams => ({ ...sc.olceklemeScenario.defaults, query: { t: 1, f: 31 }, ...over });
    for (const scaling of ['yok', 'standard'] as const) {
      const v = mod.deriveOlcView(1, params({ scaling }));
      const ids = v.scatter!.customers.filter((c) => c.nearest).map((c) => c.id);
      expect(v.scatter!.customers[0].d).toBe(v.scatter!.customers[3].d);
      expect(ids).toEqual(['M1']);
    }
    vi.doUnmock('../../../src/concepts/olcekleme/data');
    vi.resetModules();
  });

  it('strip puts a negative subtrahend in parentheses', () => {
    const s = V(1, { scaling: 'standard' }).strip;
    expect(s).toMatch(/^d = √\(\(−0,57 − \(−1,01\)\)²/);
  });

  it('table rows: raw always, z when scaled, nearest marked', () => {
    const t = V(1).table!;
    expect(t.unitName).toBe('ay');
    expect(t.scaled).toBe(false);
    expect(t.rows).toHaveLength(6);
    expect(t.rows[2]).toMatchObject({ id: 'M3', t: '2', f: '42,30', zt: null, zf: null, d: '16,16', nearest: true });
    expect(t.rows.filter((r) => r.nearest)).toHaveLength(1);
    expect(t.query).toEqual({ t: '12', f: '55', zt: null, zf: null });
    const z = V(1, { scaling: 'standard' }).table!;
    expect(z.scaled).toBe(true);
    expect(z.rows.every((r) => r.zt !== null && r.zf !== null)).toBe(true);
    expect(z.rows[4].zf).toBe('2,18');
    expect(z.rows[2].nearest).toBe(true);
    expect(z.query.zt).toBe('−0,57');
    expect(V(9).table).toBeNull();
    expect(V(0).table).not.toBeNull();
  });

  it('whole numbers have no decimals and use the thousands separator', () => {
    expect(V(1, { query: { t: 12, f: 1800 } }).scatter!.query.label).toBe('Yeni (12 ay; 1.800 TL)');
  });
});
