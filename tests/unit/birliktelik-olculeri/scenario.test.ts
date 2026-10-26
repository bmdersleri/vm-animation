import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { count } from '../../../src/concepts/birliktelik/metrics';
import { rules } from '../../../src/concepts/birliktelik/rules';
import { birliktelikOlculeriScenario as scenario } from '../../../src/concepts/birliktelik-olculeri/scenario';
import { labTextTests } from '../lab-text';

const steps = scenario.steps;
const tx = sepetData.transactions;
const text = (id: string): string => steps.find((s) => s.id === id)!.text;

describe('birliktelik-olculeri scenario', () => {
  it('step ids follow the spec', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'fisler', 'tablo', 'destek-tek', 'destek-cift', 'guven', 'guven-yon', 'tuzak', 'gercek', 'kurallar', 'suzgec',
    ]);
    for (const s of steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(scenario.defaults).toEqual({ x: [], y: [], minSupport: 0.2, minConfidence: 0.5, minLift: 0, edits: [] });
  });

  it('step texts read their numbers from the basket', () => {
    const c = (...items: string[]): number => count(tx, items);
    const n = tx.length;
    expect(text('fisler')).toContain(`${n} kasa fişi`);
    expect(text('destek-tek')).toContain(`${c('ekmek')} / ${n} = 0,611`);
    expect(text('destek-cift')).toContain(`${c('ekmek', 'sut')} / ${n} = 0,389`);
    expect(text('guven')).toContain(`${c('ekmek', 'sut')} / ${c('ekmek')} = 0,636`);
    expect(text('guven')).toContain('%63,6');
    expect(text('guven-yon')).toContain(`${c('ekmek', 'sut')} / ${c('sut')} = 0,583`);
    expect(text('tuzak')).toContain(`${c('sut')} / ${n} = 0,667`);
    expect(text('tuzak')).toContain('0,636 / 0,667 = 0,955');
    expect(text('gercek')).toContain(`${c('yumurta', 'sut')} / ${c('yumurta')} = 0,900`);
    expect(text('gercek')).toContain('lift 1,350');
    expect(text('gercek')).toContain('için de 1,350 (güveni 0,750');
    const all = rules(tx, 0.2, 0.5);
    const kept = all.filter((r) => r.lift > 1.1 + 1e-9);
    expect(text('kurallar')).toContain(`${all.length} kural`);
    // rules with the same support and confidence share a point: 13 rules on 11 points
    const spots = new Set(all.map((r) => `${r.support.toFixed(6)}|${r.confidence.toFixed(6)}`)).size;
    expect([all.length, spots]).toEqual([13, 11]);
    expect(text('kurallar')).toContain(`${all.length} kural ${spots} noktada`);
    expect(text('suzgec')).toContain(`${kept.length} kuralı bırakır`);
    expect(text('suzgec')).toContain(`${all.length - kept.length} kural soluklaşır`);
    expect(text('suzgec')).toContain('{Ekmek, Yumurta} → Süt (güven 1,000, lift 1,500)');
  });

  it('steps choose the rules the spec names', () => {
    const p = (id: string) => steps.find((s) => s.id === id)!.params!;
    expect(p('destek-tek')).toMatchObject({ x: ['ekmek'], y: [] });
    expect(p('guven')).toMatchObject({ x: ['ekmek'], y: ['sut'] });
    expect(p('guven-yon')).toMatchObject({ x: ['sut'], y: ['ekmek'] });
    expect(p('gercek')).toMatchObject({ x: ['yumurta'], y: ['sut'] });
    expect(p('kurallar').minLift).toBe(0);
    expect(p('suzgec').minLift).toBe(1.1);
  });

  labTextTests(steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
