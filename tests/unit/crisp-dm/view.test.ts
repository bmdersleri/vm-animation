import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { formatNumber, formatPercent } from '../../../src/core/plot/format';
import { BOOK, META, cellOf } from '../../../src/concepts/crisp-dm/data';
import { crispDmScenario as sc, examStockNote } from '../../../src/concepts/crisp-dm/scenario';
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
    // the end state of a stage keeps the whole route walked so far marked
    expect(v2.graph.path).toEqual(['ia-va', 'va-d1', 'd1-ia']);
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
    expect(v3.graph.path).toEqual(['mo-de', 'de-d2', 'd2-va']);
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
    expect(v7.graph.path).toEqual(['va-d1', 'd1-vh', 'vh-mo', 'mo-de', 'de-d2', 'd2-ya', 'ya-ia']);
    expect(v7.graph.edges.find(e => e.id === 'ya-ia')!.tone).toBeUndefined();
    expect(v7.results!.columns.map(c => c.id)).toEqual(['base', 'eval', 'deploy']);
    expect(v7.results!.rule).toMatch(/^Sınav haftasında \d+, diğer günler \d+ sandviç$/);
  });

  it('lab path follows the choices', () => {
    const v = at('degerlendirme', { stock: 'satis' }, true);
    expect(v.route!.end).toBe('uygun-degil');
    expect(v.graph.path).toEqual(['ia-va', 'va-d1', 'd1-vh', 'vh-mo', 'mo-de', 'de-d2', 'd2-va']);
    expect(v.graph.token).toEqual({ at: 'd2' });
    const lost = cellOf(56, 'cikar', 'satis', false).eval.lostShare!;
    expect(v.route!.reason).toEqual({
      node: 'd2',
      text: `Sonuç uygun mu? Hayır: kaçan talep ${formatPercent(lost)} > ${formatPercent(META.criteria.service, 0)}`,
    });
    const leak = at('ikinci-tur', { leak: true }, true);
    expect(leak.route!.end).toBe('sahada-dustu');
    expect(leak.graph.edges.find(e => e.id === 'ya-ia')!.tone).toBe('alarm');
    expect(leak.graph.path).toContain('ya-ia');
    const ok = at('ikinci-tur', {}, true);
    expect(ok.route!.end).toBe('yaygin');
    expect(ok.route!.reason).toBeNull();
    expect(ok.hypothetical).toBe(false);
    expect(at('sizinti', { leak: true }, true).leak!.coefficient).toBe(
      formatNumber(cellOf(56, 'cikar', 'soran', true).leakCoef!, 3),
    );
  });

  it('lab with four days is hypothetical', () => {
    const v = at('degerlendirme', { days: 4 }, true);
    expect(v.hypothetical).toBe(true);
    expect(v.route!.end).toBe('yetersiz');
    const four = cellOf(4, 'cikar', 'soran', false);
    const exam = four.usable.sinav <= four.usable.normal;
    expect(v.route!.reason).toEqual({
      node: 'd1',
      text: `Veri yeterli mi? Hayır: ${exam ? 'sınav günü' : 'normal gün'} ${exam ? four.usable.sinav : four.usable.normal} < ${META.minGroup}`,
    });
    expect(v.graph.path).toEqual(['ia-va', 'va-d1', 'd1-ia']);
    expect(v.results!.title).toContain('yine de denenseydi');
    const groups = at('modelleme', { days: 4 }, true);
    expect(groups.groups!.bars[1].text).toBe('veri yok');
    expect(groups.groups!.bars[1].value).toBeNull();
  });

  it('a waste rise reads israf artışı on the board and in the reason line', () => {
    const cell = cellOf(56, 'cikar', 'soran', true);
    const r = cell.deploy.reduction!;
    expect(r).toBeLessThan(0);
    const v = at('ikinci-tur', { leak: true }, true);
    const deploy = v.results!.columns.find(c => c.id === 'deploy')!;
    expect(deploy.reduction).toEqual({ label: 'israf artışı', value: formatPercent(-r) });
    expect(v.route!.reason).toEqual({
      node: 'ya',
      text: `Sahada tutmadı: israf artışı ${formatPercent(-r)} (en az ${formatPercent(META.criteria.waste, 0)} düşüş gerekir)`,
    });
    // a fall keeps the old wording
    const evalCol = v.results!.columns.find(c => c.id === 'eval')!;
    expect(evalCol.reduction).toEqual({ label: 'israf düşüşü', value: formatPercent(cell.eval.reduction!) });
    expect(JSON.stringify(v)).not.toContain('%−');
  });

  it('no view text carries NaN or Infinity in any cell', () => {
    for (const days of [4, 14, 28, 56] as const) {
      for (const missing of ['sifir', 'cikar'] as const) {
        for (const stock of ['satis', 'soran'] as const) {
          for (const leak of [false, true]) {
            for (let i = 0; i < sc.steps.length; i += 1) {
              const v = deriveCrispView(i, { ...sc.defaults, days, missing, stock, leak }, true);
              expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|undefined|%−/);
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

  it('the book Kahve means print with one decimal in Ders and Lab', () => {
    const want = {
      zero: formatNumber(BOOK.hamVeri.kahveFillna0, 1),
      skip: formatNumber(BOOK.hamVeri.kahveAtlanir, 1),
    };
    expect(at('eksik-sifir-degil').clean!.kahve).toEqual(want);
    expect(at('eksik-sifir-degil', {}, true).clean!.kahve).toEqual(want);
    expect(want).toEqual({ zero: '40,0', skip: '80,0' });
  });

  it('step 8 note and the scenario text share one helper', () => {
    const v = at('degerlendirme', { scan: 3 });
    expect(v.results!.note).toBe(examStockNote());
    expect(sc.steps[stepIndex(sc, 'degerlendirme')].text).toContain(examStockNote());
    expect(examStockNote()).toMatch(/satış (hep|en çok) \d+$/);
  });

  it('step 9 strips and rule read the deployment once it is shown', () => {
    const cell = cellOf(56, 'cikar', 'soran', false);
    expect(at('ikinci-tur', { scan: 6 }).strip).toContain(`${cell.deploy.wasted} / ${cell.deploy.prepared}`);
  });

  it('Ders views ignore the Lab choices on every step', () => {
    const choices = [
      { days: 4 as const }, { days: 14 as const, missing: 'sifir' as const },
      { stock: 'satis' as const }, { leak: true }, { days: 28 as const, missing: 'sifir' as const, stock: 'satis' as const, leak: true },
    ];
    sc.steps.forEach((_s, i) => {
      const plain = JSON.stringify(deriveCrispView(i, sc.defaults, false));
      for (const c of choices) {
        expect(JSON.stringify(deriveCrispView(i, { ...sc.defaults, ...c }, false)), `step ${i + 1}`).toBe(plain);
      }
    });
  });

  it('the step 5 strip says that a missing record is not a zero sale', () => {
    for (const lab of [false, true]) {
      const strip = at('eksik-sifir-degil', {}, lab).strip;
      expect(strip).not.toContain('sıfır olmaz');
      expect(strip).toContain('fillna(0) eksik kaydı sıfır satışa çevirir: eksik ≠ sıfır');
    }
  });

  it('the first decision card carries its answer as a boolean', () => {
    expect(at('veri-yeterli', { scan: 3 }).summary!.enough).toBeNull();
    expect(at('veri-yeterli', { scan: 4 }).summary!.enough).toBe(true);
    expect(at('veri-yeterli', { days: 4 }, true).summary!.enough).toBe(false);
  });
});
