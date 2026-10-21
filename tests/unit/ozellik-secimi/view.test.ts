import { describe, it, expect } from 'vitest';
import { deriveSecimView, type SecimView } from '../../../src/concepts/ozellik-secimi/view';
import { ozellikSecimiScenario, ROUNDS_ALL, type SecimParams } from '../../../src/concepts/ozellik-secimi/scenario';
import { COLUMNS, RFE } from '../../../src/concepts/ozellik-secimi/data';
import { VARIANCES, VT_OPTIONS, rfeState } from '../../../src/concepts/ozellik-secimi/select';
import fixture from '../../fixtures/boyut_sklearn.json';

const base = (i: number): SecimParams => ({ ...ozellikSecimiScenario.defaults, ...ozellikSecimiScenario.steps[i].params });
const V = (i: number, over: Partial<SecimParams> = {}): SecimView => deriveSecimView(i, { ...base(i), ...over });
const idx = [...Array(10).keys()];
const col = (name: string): number => COLUMNS.indexOf(name);
const selectedNames = (v: SecimView): string[] => v.rows.filter((r) => r.selected).map((r) => r.name);
const eliminatedNames = (v: SecimView): string[] => v.rows.filter((r) => r.eliminated).map((r) => r.name);
const secim = fixture.secim;

describe('secim view', () => {
  it('mode and part per step', () => {
    expect(idx.map((i) => V(i).mode)).toEqual([
      'strips', 'variance', 'fscore', 'kbest', 'split', 'rfe', 'rfe', 'rfe', 'rfe', 'intersect',
    ]);
    expect(idx.map((i) => V(i).part)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(idx.map((i) => V(i).stepId)).toEqual(ozellikSecimiScenario.steps.map((s) => s.id));
  });

  it('strips at the book values', () => {
    expect(V(0).strip).toBe('400 müşteri · 8 sütun · churn %42,25');
    expect(V(1).strip).toBe('VarianceThreshold(threshold=0.01) → 7 sütun kalır · elenen: sabitDeger');
    expect(V(1, { vt: 10 }).strip).toBe(
      'VarianceThreshold(threshold=10) → 3 sütun kalır · elenen: hizmetSayisi · sabitDeger · gurultuluOznitelik · destekTaleplerinSayisi · odemeGecikmesi',
    );
    expect(V(1, { vt: 0 }).strip).toContain('threshold=0)');
    expect(V(1, { vt: 1 }).strip).toContain('threshold=1) → 6 sütun kalır');
    expect(V(2).strip).toBe('f_classif: destekTaleplerinSayisi 158,44 · musteriKidemAy 94,66 · hizmetSayisi 2,86 · odemeGecikmesi 1,62 · …');
    expect(V(3).strip).toBe('SelectKBest(f_classif, k=4) → hizmetSayisi · musteriKidemAy · destekTaleplerinSayisi · odemeGecikmesi');
    expect(V(4).strip).toBe('musteriKidemAy: F = 94,66 · gurultuluOznitelik: F = 0,04');
    const rfe = 'RFE(LogisticRegression(max_iter=1000), n_features_to_select=4)';
    expect(V(5).strip).toBe(`${rfe}\ntur 1 → toplamUcret elendi (|β| = 0,00004)`);
    expect(V(5, { nSelect: 2 }).strip.split('\n')[0]).toBe('RFE(LogisticRegression(max_iter=1000), n_features_to_select=2)');
    expect(V(6, { nSelect: 7, rounds: 1 }).strip.split('\n')[0]).toContain('n_features_to_select=7)');
    expect(V(6, { rounds: 0 }).strip).toBe(`${rfe}\nhenüz eleme yok`);
    expect(V(6, { rounds: 1 }).strip.split('\n')[1]).toBe('tur 1: toplamUcret');
    expect(V(6, { rounds: 2 }).strip.split('\n')[1]).toBe('tur 1: toplamUcret · tur 2: sabitDeger');
    expect(V(6, { rounds: 3 }).strip.split('\n')[1]).toBe('tur 1: toplamUcret · tur 2: sabitDeger · tur 3: aylikUcret');
    expect(V(6).strip).toBe(`${rfe}\ntur 1: toplamUcret · tur 2: sabitDeger · tur 3: aylikUcret · tur 4: hizmetSayisi`);
    expect(V(7).strip).toBe(
      'RFE → musteriKidemAy · gurultuluOznitelik · destekTaleplerinSayisi · odemeGecikmesi\nσ: gurultuluOznitelik 0,92 · musteriKidemAy 17,40',
    );
    expect(V(8).strip).toBe(
      'StandardScaler + RFE → hizmetSayisi · musteriKidemAy · gurultuluOznitelik · destekTaleplerinSayisi\ntur 1: sabitDeger · tur 2: toplamUcret · tur 3: aylikUcret · tur 4: odemeGecikmesi',
    );
    expect(V(8, { rounds: 2 }).strip.split('\n')[0]).toBe('StandardScaler + RFE: turlar yeniden oynuyor');
    expect(V(9).strip).toBe(
      'SelectKBest ∩ RFE → musteriKidemAy · destekTaleplerinSayisi · odemeGecikmesi',
    );
  });

  it('live notes', () => {
    expect(V(0).note).toBe('Eşik 0,01: 7 sütun kalır; elenen: sabitDeger.');
    expect(V(1).note).toBe('Eşik 0,01: 7 sütun kalır; elenen: sabitDeger.');
    expect(V(1, { vt: 10 }).note).toBe(
      'Eşik 10: 3 sütun kalır; elenen: hizmetSayisi, sabitDeger, gurultuluOznitelik, destekTaleplerinSayisi, odemeGecikmesi. destekTaleplerinSayisi (F = 158,44) da elendi: varyans birime bağlıdır; toplamUcret 629.688,34 ile en “değişken” sütun ama F = 0,73.',
    );
    expect(V(2).note).toBe('k = 4: hizmetSayisi, musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi.');
    expect(V(4).note).toBe('k = 4: hizmetSayisi, musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi.');
    expect(V(5).note).toBe('n = 4, ölçeksiz: musteriKidemAy, gurultuluOznitelik, destekTaleplerinSayisi, odemeGecikmesi.');
    expect(V(8).note).toBe('n = 4, StandardScaler: hizmetSayisi, musteriKidemAy, gurultuluOznitelik, destekTaleplerinSayisi.');
    expect(V(9).note).toBe('Kesişim: musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi.');
  });

  it('step 1: eight rows in book order', () => {
    const v = V(0);
    expect(v.rows.map((r) => r.name)).toEqual([...COLUMNS]);
    expect(v.rows.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(v.rows.every((r) => r.bar === null && r.value === null && !r.eliminated && !r.hidden && !r.split)).toBe(true);
    expect(v.cut).toBeNull();
    expect(v.intersect).toBeNull();
    expect(v.rule).toBe(false);
  });

  it('step 2: variances and sabitDeger eliminated', () => {
    const v = V(1);
    expect(v.rows.map((r) => r.value)).toEqual([
      '406,37', '629.688,34', '5,22', '302,89', '0,00', '0,84', '8,92', '1,95',
    ]);
    expect(eliminatedNames(v)).toEqual(['sabitDeger']);
    expect(v.rows[4].elimLabel).toBe('elendi');
    expect(v.rows.filter((r) => r.elimLabel !== null)).toHaveLength(1);
  });

  it("vt 1 and 10 eliminate the book's columns", () => {
    expect(eliminatedNames(V(1, { vt: 1 }))).toEqual(['sabitDeger', 'gurultuluOznitelik']);
    expect(eliminatedNames(V(1, { vt: 10 }))).toEqual([
      'hizmetSayisi', 'sabitDeger', 'gurultuluOznitelik', 'destekTaleplerinSayisi', 'odemeGecikmesi',
    ]);
    expect(eliminatedNames(V(1, { vt: 0 }))).toEqual(['sabitDeger']);
    for (const t of VT_OPTIONS) {
      const kept = V(1, { vt: t }).rows.filter((r) => !r.eliminated).map((r) => r.name);
      expect(kept, String(t)).toEqual(secim.vtSupport[String(t) as '0']);
    }
  });

  it('step 3: F order with NaN last', () => {
    const v = V(2);
    expect(v.rows.map((r) => r.name)).toEqual([...COLUMNS]);
    const order = [6, 3, 2, 7, 1, 0, 5, 4];
    order.forEach((c, s) => expect(v.rows[c].slot).toBe(s));
    expect(v.rows.map((r) => r.value)).toEqual(['0,57', '0,73', '2,86', '94,66', '—', '0,04', '158,44', '1,62']);
    expect(v.rows[6].bar).toBe(1);
    expect(v.rows[3].bar).toBeCloseTo(94.65852454300096 / 158.44428346650622, 12);
    expect(v.rows[4].bar).toBe(0);
    expect(v.rows.filter((r) => r.zeroNote).map((r) => r.name)).toEqual(['sabitDeger']);
    expect(v.rows.some((r) => r.eliminated || r.selected)).toBe(false);
  });

  it("step 4: k = 4 selects the book's four", () => {
    const v = V(3);
    expect(selectedNames(v)).toEqual(['hizmetSayisi', 'musteriKidemAy', 'destekTaleplerinSayisi', 'odemeGecikmesi']);
    expect(eliminatedNames(v)).toEqual(['aylikUcret', 'toplamUcret', 'sabitDeger', 'gurultuluOznitelik']);
    expect(v.rows.filter((r) => r.eliminated).every((r) => r.elimLabel === 'elendi')).toBe(true);
    for (let k = 1; k <= 7; k++) {
      expect(selectedNames(V(3, { k })), `k=${k}`).toEqual(secim.kbest[String(k) as '1']);
      expect(eliminatedNames(V(3, { k }))).toHaveLength(8 - k);
    }
  });

  it('step 5: two split rows and the 12-month cut', () => {
    const v = V(4);
    expect(v.rows.filter((r) => r.split).map((r) => r.name)).toEqual(['musteriKidemAy', 'gurultuluOznitelik']);
    expect(v.rows[3].slot).toBe(0);
    expect(v.rows[5].slot).toBe(1);
    expect(v.rows[3].value).toBe('F = 94,66');
    expect(v.rows[5].value).toBe('F = 0,04');
    expect(v.rows.filter((r) => r.hidden)).toHaveLength(6);
    expect(v.rows.filter((r) => !r.hidden).every((r) => r.split)).toBe(true);
    expect(v.cut).toEqual({ col: 3, value: 12, label: '12 ay' });
  });

  it('step 6: round 1 eliminates toplamUcret', () => {
    const v = V(5);
    expect(eliminatedNames(v)).toEqual(['toplamUcret']);
    expect(v.rows[1].elimLabel).toBe('tur 1');
    expect(v.rows[1].value).toBe('0,00004');
    expect(v.rows[1].bar).toBeGreaterThan(0);
    expect(v.rows.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Math.max(...v.rows.map((r) => r.bar!))).toBe(1);
    expect(v.rows[6].value).toBe('0,6286');
    expect(v.rows.some((r) => r.selected)).toBe(false);
  });

  it('step 7: rounds 2–4 eliminate sabitDeger, aylikUcret, hizmetSayisi', () => {
    const v = V(6);
    expect(v.rows.map((r) => r.elimLabel)).toEqual(['tur 3', 'tur 1', 'tur 4', null, 'tur 2', null, null, null]);
    expect(eliminatedNames(v)).toEqual(['aylikUcret', 'toplamUcret', 'hizmetSayisi', 'sabitDeger']);
    expect(v.rows.filter((r) => r.eliminated).every((r) => r.bar === 0 || r.name === 'hizmetSayisi')).toBe(true);
    expect(v.rows[1].bar).toBe(0);
    expect(v.rows[4].bar).toBe(0);
    expect(v.rows[0].bar).toBe(0);
    expect(selectedNames(v)).toEqual(['musteriKidemAy', 'gurultuluOznitelik', 'destekTaleplerinSayisi', 'odemeGecikmesi']);
    // mid sweep nothing is selected yet
    expect(selectedNames(V(6, { rounds: 2 }))).toEqual([]);
    expect(eliminatedNames(V(6, { rounds: 2 }))).toEqual(['toplamUcret', 'sabitDeger']);
  });

  it('step 8: four survivors with gurultuluOznitelik highlighted', () => {
    const v = V(7);
    expect(selectedNames(v)).toEqual(['musteriKidemAy', 'gurultuluOznitelik', 'destekTaleplerinSayisi', 'odemeGecikmesi']);
    expect(v.rows.filter((r) => r.highlight).map((r) => r.name)).toEqual(['gurultuluOznitelik']);
    expect(V(5).rows.some((r) => r.highlight)).toBe(false);
    expect(V(7, { nSelect: 1 }).rows.filter((r) => r.highlight)).toHaveLength(0);
  });

  it('step 9: scaled RFE keeps gurultuluOznitelik', () => {
    const v = V(8);
    expect(selectedNames(v)).toEqual(['hizmetSayisi', 'musteriKidemAy', 'gurultuluOznitelik', 'destekTaleplerinSayisi']);
    const r1 = V(8, { rounds: 1 });
    expect(r1.rows[4].value).toBe('0,0000');
    expect(r1.rows[4].elimLabel).toBe('tur 1');
    expect(V(8, { rounds: 0 }).rows.some((r) => r.eliminated)).toBe(false);
    expect(V(8, { rounds: 0 }).rows[4].value).toBe('0,0000');
  });

  it('step 10: intersection of three', () => {
    const v = V(9);
    expect(v.rows.every((r) => r.hidden)).toBe(true);
    expect(v.intersect).toEqual({
      kbest: ['hizmetSayisi', 'musteriKidemAy', 'destekTaleplerinSayisi', 'odemeGecikmesi'],
      rfe: ['musteriKidemAy', 'gurultuluOznitelik', 'destekTaleplerinSayisi', 'odemeGecikmesi'],
      both: ['musteriKidemAy', 'destekTaleplerinSayisi', 'odemeGecikmesi'],
      kbestTitle: 'SelectKBest (k = 4)',
      rfeTitle: 'RFE (n = 4)',
    });
    expect(v.rule).toBe(true);
    expect(V(8).rule).toBe(false);
    expect(V(9, { k: 2, nSelect: 2 }).intersect!.both).toEqual(['destekTaleplerinSayisi']);
    expect(V(9, { k: 2, nSelect: 2 }).intersect!.kbestTitle).toBe('SelectKBest (k = 2)');
  });

  it('nSelect 1–7 and both scalings match the fixture', () => {
    for (const s of ['yok', 'standard'] as const) {
      for (let n = 1; n <= 7; n++) {
        const v = V(7, { scaling: s, nSelect: n });
        expect(selectedNames(v), `${s} n=${n}`).toEqual(secim.rfe[s].support[String(n) as '1']);
      }
    }
  });

  it('rounds never exceed 8 − nSelect', () => {
    for (const rounds of [0, 1, 2, 3, ROUNDS_ALL]) {
      for (let n = 1; n <= 7; n++) {
        const labelled = V(6, { rounds, nSelect: n }).rows.filter((r) => r.elimLabel !== null).length;
        expect(labelled, `rounds=${rounds} n=${n}`).toBeLessThanOrEqual(8 - n);
        expect(labelled, `rounds=${rounds} n=${n}`).toBe(Math.min(rounds, 8 - n));
      }
    }
  });

  it('no zero-looking value for a non-zero number, no NaN in any text', () => {
    const zeroish = /^−?0(,0+)?$/;
    for (const i of idx) {
      for (const k of [1, 4, 7]) for (const nSelect of [1, 4, 7]) {
        for (const scaling of ['yok', 'standard'] as const) for (const vt of VT_OPTIONS) {
          for (const rounds of [0, 1, ROUNDS_ALL]) {
            const p = { vt, k, nSelect, scaling, rounds };
            const v = V(i, p);
            const coef = rfeState(RFE[scaling], nSelect, rounds).coef;
            v.rows.forEach((r) => {
              if (r.value !== null && zeroish.test(r.value)) {
                const real = v.mode === 'variance' ? VARIANCES[r.col] : coef.get(r.col);
                expect(real, `${i} ${r.name} ${r.value}`).toBe(0);
              }
              for (const t of [r.value, r.elimLabel]) expect(t ?? '').not.toContain('NaN');
            });
            expect(v.strip).not.toContain('NaN');
            expect(v.note).not.toContain('NaN');
          }
        }
      }
    }
  });
});
