import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { cellOf } from '../../../src/concepts/crisp-dm/data';
import { crispDmScenario as sc } from '../../../src/concepts/crisp-dm/scenario';
import { deriveCrispView } from '../../../src/concepts/crisp-dm/view';

const at = (id: string, over: Partial<typeof sc.defaults> = {}, lab = false) =>
  deriveCrispView(stepIndex(sc, id), { ...sc.defaults, ...over }, lab);

describe('crisp-dm view', () => {
  it('cards follow the steps', () => {
    expect(sc.steps.map((_s, i) => deriveCrispView(i, sc.defaults).card)).toEqual([
      'intro', 'goal', 'table', 'summary', 'clean', 'leak', 'groups', 'results', 'results', 'code',
    ]);
  });

  it('step 4 path goes back from the first decision', () => {
    const v1 = at('veri-yeterli', { scan: 1 });
    expect(v1.graph.current).toBe('d1');
    expect(v1.card).toBe('table');
    const v2 = at('veri-yeterli', { scan: 2 });
    expect(v2.graph.path).toEqual(['d1-ia']);
    expect(v2.graph.token).toEqual({ at: 'ia', via: 'd1-ia' });
    expect(v2.card).toBe('goal');
    expect(v2.goal?.extra).toContain('8 haftalık günlük kayıt');
    const v3 = at('veri-yeterli', { scan: 3 });
    expect(v3.graph.current).toBe('va');
    expect(v3.card).toBe('summary');
    const v4 = at('veri-yeterli', { scan: 4 });
    expect(v4.graph.current).toBe('d1');
    expect(v4.graph.path).toContain('d1-vh');
  });

  it('step 8 path goes back from the second decision', () => {
    const v1 = at('degerlendirme', { scan: 1 });
    expect(v1.card).toBe('table');
    expect(v1.table!.rows).toHaveLength(14);
    const v2 = at('degerlendirme', { scan: 2 });
    expect(v2.graph.current).toBe('d2');
    expect(v2.results!.columns.map(c => c.id)).toEqual(['base', 'eval']);
    const v3 = at('degerlendirme', { scan: 3 });
    expect(v3.graph.path).toEqual(['d2-va']);
    expect(v3.graph.token).toEqual({ at: 'va', via: 'd2-va' });
    const done = at('degerlendirme');
    expect(done.graph.current).toBe('va');
    expect(done.results!.columns[1].serviceOk).toBe(false);
    expect(done.results!.columns[1].wasteOk).toBe(true);
    expect(done.strip).toContain('israf oranı = atılan / hazırlanan = ');
    expect(done.strip).toContain('kaçan talep = karşılanamayan / toplam talep = ');
  });

  it('step 9 path loops through deployment', () => {
    const stages = [1, 2, 3, 4, 5, 6, 7].map(scan => at('ikinci-tur', { scan }).graph.token!.at);
    expect(stages).toEqual(['va', 'vh', 'mo', 'de', 'd2', 'ya', 'ia']);
    const v7 = at('ikinci-tur');
    expect(v7.graph.path).toEqual(['ya-ia']);
    expect(v7.graph.edges.find(e => e.id === 'ya-ia')!.tone).toBeUndefined();
    expect(v7.results!.columns.map(c => c.id)).toEqual(['base', 'eval', 'deploy']);
    expect(v7.results!.rule).toMatch(/^Sınav haftasında \d+, diğer günler \d+ sandviç$/);
  });

  it('lab path follows the choices', () => {
    const v = at('degerlendirme', { stock: 'satis' }, true);
    expect(v.route!.end).toBe('uygun-degil');
    expect(v.graph.path).toEqual(['ia-va', 'va-d1', 'd1-vh', 'vh-mo', 'mo-de', 'de-d2', 'd2-va']);
    expect(v.graph.token).toEqual({ at: 'd2' });
    expect(v.route!.text).toContain('Sonuç uygun mu? Hayır');
    const leak = at('ikinci-tur', { leak: true }, true);
    expect(leak.route!.end).toBe('sahada-dustu');
    expect(leak.graph.edges.find(e => e.id === 'ya-ia')!.tone).toBe('alarm');
    expect(leak.graph.path).toContain('ya-ia');
    const ok = at('ikinci-tur', {}, true);
    expect(ok.route!.end).toBe('yaygin');
    expect(ok.hypothetical).toBe(false);
    expect(at('sizinti', { leak: true }, true).leak!.coefficient).toBe(
      String(cellOf(56, 'cikar', 'soran', true).leakCoef!.toFixed(3)).replace('-', '−').replace('.', ','),
    );
  });

  it('lab with four days is hypothetical', () => {
    const v = at('degerlendirme', { days: 4 }, true);
    expect(v.hypothetical).toBe(true);
    expect(v.route!.end).toBe('yetersiz');
    expect(v.graph.path).toEqual(['ia-va', 'va-d1', 'd1-ia']);
    expect(v.results!.title).toContain('yine de denenseydi');
    const groups = at('modelleme', { days: 4 }, true);
    expect(groups.groups!.bars[1].text).toBe('veri yok');
    expect(groups.groups!.bars[1].value).toBeNull();
  });

  it('no view text carries NaN or Infinity in any cell', () => {
    for (const days of [4, 14, 28, 56] as const) {
      for (const missing of ['sifir', 'cikar'] as const) {
        for (const stock of ['satis', 'soran'] as const) {
          for (const leak of [false, true]) {
            for (let i = 0; i < sc.steps.length; i += 1) {
              const v = deriveCrispView(i, { ...sc.defaults, days, missing, stock, leak }, true);
              expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|undefined/);
            }
          }
        }
      }
    }
  });

  it('lab step 10 follows the switch', () => {
    expect(at('hata-ayiklama', { fixed: true }, true).code!.fixed).toBe(true);
    expect(at('hata-ayiklama', {}, true).code!.fixed).toBe(false);
    expect(at('hata-ayiklama', { scan: 3 }).code!.marked).toBe(3);
    expect(at('hata-ayiklama').code!.fixed).toBe(true);
    expect(at('hata-ayiklama').code!.output).toEqual(['Ortalama: 90.0', 'Kayıt sayısı: 2']);
  });
});
