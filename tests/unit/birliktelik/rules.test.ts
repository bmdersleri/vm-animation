import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { setKey } from '../../../src/concepts/birliktelik/format';
import { rules } from '../../../src/concepts/birliktelik/rules';

const tx = sepetData.transactions;

describe('rules', () => {
  it('rules at 0.2 and 0.5 match mlxtend', () => {
    const got = rules(tx, 0.2, 0.5);
    const want = sepetData.fixture.rules;
    expect(got).toHaveLength(want.length);
    got.forEach((g, i) => {
      expect([setKey(g.x), setKey(g.y)]).toEqual([want[i].x, want[i].y]);
      expect(g.support).toBeCloseTo(want[i].support, 6);
      expect(g.confidence).toBeCloseTo(want[i].confidence, 6);
      expect(g.lift).toBeCloseTo(want[i].lift, 6);
    });
  });

  it('rule counts match the mlxtend grid', () => {
    const entries = Object.entries(sepetData.fixture.grid);
    expect(entries).toHaveLength(12);
    for (const [key, want] of entries) {
      const [s, c] = key.split('|').map(Number);
      expect(rules(tx, s, c).length, key).toBe(want);
    }
  });

  it('9 of 13 rules have lift above 1.1', () => {
    const all = rules(tx, 0.2, 0.5);
    expect(all).toHaveLength(13);
    expect(all.filter((r) => r.lift > 1.1)).toHaveLength(9);
  });
});
