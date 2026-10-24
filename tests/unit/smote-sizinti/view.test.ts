import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { LEAK, LEAK_EXAMPLE } from '../../../src/concepts/dengesiz/data';
import { smoteSizintiScenario as sc, type LeakParams } from '../../../src/concepts/smote-sizinti/scenario';
import { deriveLeakView } from '../../../src/concepts/smote-sizinti/view';

const view = (id: string, over: Partial<LeakParams> = {}) => deriveLeakView(stepIndex(sc, id), { ...sc.defaults, ...over });
const value = (id: string, bar: string, over: Partial<LeakParams> = {}) => view(id, over).flow!.bars.find((b) => b.id === bar)!.value;

describe('smote-sizinti view', () => {
  it('step 1 draws both rows', () => {
    const v = view('iki-sira');
    expect(v.kind).toBe('flow');
    expect(v.flow!.rows).toEqual(['yanlis', 'dogru']);
  });

  it('step 2 counts follow the leaky split', () => {
    const run = LEAK.bySeed[0].leaky;
    const v = view('once-smote');
    expect(v.flow!.rows).toEqual(['yanlis']);
    expect(['a-neg', 'a-pos', 'b-neg', 'b-pos'].map((b) => value('once-smote', b))).toEqual([1876, 124, 1876, 1876]);
    expect(value('once-smote', 'c-neg')).toBe(run.n - run.pos);
    expect(value('once-smote', 'c-synth')).toBe(run.pos);
    expect(value('once-smote', 'c-real')).toBe(run.pos - run.synthPos);
    expect(v.flow!.bars.find((b) => b.id === 'c-synth')!.text).toBe('529 (505 sentetik)');
    expect(v.strip).toContain(`test: kalan ${run.n - run.pos} | ayrılan 529 (505 sentetik)`);
  });

  it('right order keeps the test rate at 6.2 percent', () => {
    const v = view('once-smote', { order: 'dogru' });
    expect(v.flow!.testRate).toBe('%6,2');
    const ids = ['a-neg', 'a-pos', 'b-neg', 'b-pos', 'c-neg', 'c-real'];
    expect(ids.map((b) => value('once-smote', b, { order: 'dogru' }))).toEqual([1313, 87, 1313, 1313, 563, 37]);
    expect(v.flow!.bars.some((b) => b.cls === 'bar-synth')).toBe(false);
    expect(view('once-smote').flow!.testRate).toBe('%47,0');
  });

  it('seed choice switches the leak run', () => {
    const other = LEAK.bySeed[1];
    const v = view('once-smote', { seed: other.seed });
    expect(v.flow!.bars.find((b) => b.id === 'c-synth')!.value).toBe(other.leaky.pos);
    const own = view('iki-skor', { seed: other.seed });
    expect(own.strip).not.toBe(view('iki-skor').strip);
    expect(own.strip).toContain(`sızıntılı ${other.leaky.ap.toFixed(3).replace('.', ',')}`);
  });

  it('step 3 carries the example for seed 42 and only the ratio for other seeds', () => {
    const v = view('testte-ne-var');
    expect(v.flow!.example!.point).toEqual({ tenure: LEAK_EXAMPLE.point[0], charge: LEAK_EXAMPLE.point[1] });
    expect(v.strip).toContain('= %98');
    const other = view('testte-ne-var', { seed: 0 });
    expect(other.flow!.example).toBeNull();
    expect(other.flow!.note).toContain('tohum 42');
    expect(view('testte-ne-var', { order: 'dogru' }).flow!.example).toBeNull();
  });

  it('steps 4 and 5 carry floors at the positive rates and the scores', () => {
    const v4 = view('pr-taban');
    expect(v4.pr!.baselines.map((b) => b.label)).toEqual(['taban 0,470', 'taban 0,062']);
    expect(v4.pr!.big).toBeNull();
    const v5 = view('iki-skor');
    expect(v5.pr!.big!.map((b) => b.id)).toEqual(['leaky', 'honest']);
    expect(v5.pr!.note).toBe('kitap 0,724 / 0,147');
  });

  it('every step has a view and an unknown step throws', () => {
    for (const s of sc.steps) {
      expect(() => deriveLeakView(stepIndex(sc, s.id), sc.defaults)).not.toThrow();
    }
    expect(() => deriveLeakView(sc.steps.length, sc.defaults)).toThrow();
  });

  it('later steps reserve their areas', () => {
    expect(view('pipeline').kind).toBe('folds');
    expect(view('hata-ayiklama').kind).toBe('code');
    expect(view('baska-sizintilar').kind).toBe('cards');
    expect(view('smote-agirlik').pr!.series).toHaveLength(3);
    expect(view('smote-agirlik', { show: { base: false, smote: true, weighted: false } }).pr!.series).toHaveLength(1);
    expect(view('esik').pr!.marker).not.toBeNull();
  });
});
