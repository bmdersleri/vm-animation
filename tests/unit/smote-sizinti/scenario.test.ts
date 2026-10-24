import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK_NUMBERS, COMPARE, CV, KOD05, LEAK } from '../../../src/concepts/dengesiz/data';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { labTextTests } from '../lab-text';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const run = LEAK.bySeed[0];

describe('smote-sizinti scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'iki-sira',
      'once-smote',
      'testte-ne-var',
      'pr-taban',
      'iki-skor',
      'pipeline',
      'smote-agirlik',
      'esik',
      'hata-ayiklama',
      'baska-sizintilar',
    ]);
    expect(sc.defaults).toEqual({
      order: 'yanlis',
      seed: 42,
      fold: 0,
      show: { base: true, smote: true, weighted: true },
      model: 'smote',
      threshold: 0.5,
      bug: 0,
      fixed: false,
    });
  });

  it('step texts read their numbers from the data', () => {
    expect(step('once-smote').text).toContain('1876 / 124');
    expect(step('once-smote').text).toContain('1876 / 1876 yapar (1752 sentetik)');
    expect(step('once-smote').text).toContain(`test ${run.leaky.n} satır, ${run.leaky.pos} ayrılan, bunların ${run.leaky.synthPos} sentetik`);
    expect(run.leaky.n).toBe(1126);
    expect(step('testte-ne-var').text).toContain('%98 ');
    expect(step('pr-taban').text).toContain('0,470');
    expect(step('pr-taban').text).toContain('0,062');
    expect(step('iki-skor').text).toContain(`Sızıntılı ${f(run.leaky.ap, 3)}, sızıntısız ${f(run.honest.ap, 3)}`);
    expect(step('iki-skor').text).toContain(`kitap ${f(BOOK_NUMBERS.leaky, 3)} / ${f(BOOK_NUMBERS.honest, 3)}`);
    expect(step('pipeline').text).toContain(`ortalama ${f(CV.mean, 3)}`);
    expect(step('pipeline').text).toContain(`kitap ${f(BOOK_NUMBERS.cv, 3)}`);
    for (const m of ['base', 'smote', 'weighted'] as const) {
      expect(step('smote-agirlik').text).toContain(f(COMPARE[m].ap, 3));
    }
    const m = KOD05.matrix;
    expect(step('esik').text).toContain(`${m.tp} / ${m.tp + m.fn}`);
    expect(step('esik').text).toMatch(/kesinlik 0,\d{3}/);
    expect(step('esik').text).toMatch(/aynı duyarlılığa 0,\d{3} eşiğinde ulaşır, kesinliği 0,\d{3}/);
  });

  it('no computed number is followed by an apostrophe suffix', () => {
    for (const s of sc.steps) {
      expect(s.text).not.toMatch(/\d['’][a-zçğıöşü]/i);
    }
  });

  it('step 6 sweeps the folds 1 to 5', () => {
    const s = step('pipeline').sweep!;
    expect(s.key).toBe('fold');
    expect(s.values).toEqual([1, 2, 3, 4, 5]);
  });

  it('no step forces the order, so the Lab choice of step 1 carries on', () => {
    for (const s of sc.steps) {
      expect(s.params ?? {}, s.id).not.toHaveProperty('order');
    }
    const player = new StepPlayer(sc);
    player.setParams({ order: 'dogru' });
    for (let i = 1; i < 5; i++) {
      player.goto(i);
      expect(player.state.params.order, sc.steps[i].id).toBe('dogru');
    }
    player.destroy();
  });
});

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
