import { describe, it, expect } from 'vitest';
import { COLUMNS, VALUES, CHURN, RFE } from '../../../src/concepts/ozellik-secimi/data';

describe('ozellik-secimi data', () => {
  it('has the book columns and values', () => {
    expect([...COLUMNS]).toEqual([
      'aylikUcret', 'toplamUcret', 'hizmetSayisi', 'musteriKidemAy',
      'sabitDeger', 'gurultuluOznitelik', 'destekTaleplerinSayisi', 'odemeGecikmesi',
    ]);
    expect(VALUES).toHaveLength(8);
    expect(VALUES.every((c) => c.length === 400)).toBe(true);
    expect(CHURN.reduce<number>((a, b) => a + b, 0)).toBe(169);
    expect(VALUES[4].every((v) => v === 1)).toBe(true);
  });

  it('has the RFE elimination orders', () => {
    expect(RFE.yok.order).toEqual([1, 4, 0, 2, 7, 3, 5, 6]);
    expect(RFE.standard.order).toEqual([4, 1, 0, 7, 2, 5, 3, 6]);
    for (const s of ['yok', 'standard'] as const) {
      const path = RFE[s];
      expect(path.rounds).toHaveLength(7);
      expect(path.rounds[0].remaining).toHaveLength(8);
      path.rounds.forEach((r, i) => expect(r.eliminated).toBe(path.order[i]));
    }
  });
});
