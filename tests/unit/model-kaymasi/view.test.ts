import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { psi, psiTerms } from '../../../src/concepts/model-kaymasi/calc';
import { BUGS, OUTPUT, RUN_ERROR } from '../../../src/concepts/model-kaymasi/code-text';
import {
  BOOK, CURVES, META, REFERENCE, SCENARIOS, SCENARIO_IDS, SPREAD_MONTH, monthOf, scenarioById,
} from '../../../src/concepts/model-kaymasi/data';
import { ALARM_PATH } from '../../../src/concepts/model-kaymasi/flow';
import {
  NOTE_CONCEPT, NOTE_INPUT, NOTE_THRESHOLD, ORDER_THRESHOLDS, THRESHOLD, modelKaymasiScenario as sc, psiNote,
  type KaymaParams,
} from '../../../src/concepts/model-kaymasi/scenario';
import { deriveKaymaView, readout, shownThreshold } from '../../../src/concepts/model-kaymasi/view';

const at = (id: string, over: Partial<KaymaParams> = {}, lab = false) =>
  deriveKaymaView(stepIndex(sc, id), { ...sc.defaults, ...over }, lab);
const idx = (id: string): number => stepIndex(sc, id);
const scenarioIndex = (id: (typeof SCENARIO_IDS)[number]): number => SCENARIO_IDS.indexOf(id);

describe('model-kaymasi view', () => {
  it('kinds follow the steps', () => {
    expect(sc.steps.map((_s, i) => deriveKaymaView(i, sc.defaults).kind)).toEqual([
      'timeline', 'line', 'line', 'drift', 'monitor', 'monitor', 'spread', 'psi', 'flow', 'code',
    ]);
    expect(sc.steps.map((_s, i) => deriveKaymaView(i, sc.defaults).stepId)).toEqual(sc.steps.map(s => s.id));
  });

  it('step 1 timeline marks the reference and the monitored months', () => {
    const v = at('alti-ay-sonra');
    expect(v.timeline).toEqual({ months: META.months, refMonths: META.refMonths });
  });

  it('step 2 draws the reference first and then the current period', () => {
    const v1 = at('iki-donem', { scan: 1 });
    expect(v1.line!.ref).toEqual(BOOK.reference);
    expect(v1.line!.showCurrent).toBe(false);
    expect(v1.line!.esik).toBeNull();
    const v2 = at('iki-donem', { scan: 2 });
    expect(v2.line!.cur).toEqual(BOOK.current);
    expect(v2.line!.showCurrent).toBe(true);
    expect(at('iki-donem').line!.showCurrent).toBe(true);
    expect(v2.strip).toContain('durum = "UYARI" if fark > esik else "NORMAL"');
  });

  it('step 3 compares the book difference with the threshold', () => {
    const v = at('fark-esik');
    expect(v.line!.diff).toBeCloseTo(BOOK.diff, 12);
    expect(v.line!.esik).toBe(BOOK.esik);
    expect(v.line!.status).toBe('UYARI');
    expect(v.strip).toBe(`fark = |X̄g − X̄r| = |${f(BOOK.curMean, 2)} − ${f(BOOK.refMean, 2)}| = ${f(BOOK.diff, 2)} > ${f(BOOK.esik, 1)} → UYARI`);
    // the Lab threshold moves the badge, at equality it is NORMAL
    expect(at('fark-esik', { esik: 20 }, true).line!.status).toBe('NORMAL');
    expect(at('fark-esik', { esik: 20 }, true).strip).toContain('≤ 20,0 → NORMAL');
    expect(at('fark-esik', { esik: BOOK.diff }, true).line!.status).toBe('NORMAL');
    expect(at('fark-esik', { esik: 8 }, true).line!.status).toBe('UYARI');
  });

  it('step 4 shows the data drift and the concept drift panels', () => {
    const v = at('veri-kavram');
    expect(v.drift!.panels.map(p => p.scenario)).toEqual(['ani', 'kavram']);
    const [a, c] = v.drift!.panels;
    expect(a.curCurve.coef).toBeCloseTo(CURVES.ani.coef, 12);
    expect(c.curCurve.coef).toBeCloseTo(CURVES.kavram.coef, 12);
    expect(a.refCurve.coef).toBeCloseTo(REFERENCE.coef, 12);
    expect(a.refShare).toHaveLength(22);
    expect(a.curShare).toHaveLength(22);
    expect(a.refShare.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
    expect(a.curShare.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
    // the data drift moves the histogram, the concept drift leaves it
    const mean = (xs: number[]) => xs.reduce((s, x, i) => s + x * i, 0);
    expect(mean(a.curShare) - mean(a.refShare)).toBeGreaterThan(1);
    expect(Math.abs(mean(c.curShare) - mean(c.refShare))).toBeLessThan(1);
    expect(a.coefText).toEqual({ ref: f(REFERENCE.coef, 3), cur: f(CURVES.ani.coef, 3) });
    expect(c.coefText.cur).toBe(f(CURVES.kavram.coef, 3));
    expect(v.strip).toBe(NOTE_INPUT);
    // the Lab shows the chosen scenario only
    const lab = at('veri-kavram', { scenario: scenarioIndex('yok') }, true);
    expect(lab.drift!.panels.map(p => p.scenario)).toEqual(['yok']);
    expect(lab.drift!.panels[0].curCurve.coef).toBeCloseTo(CURVES.yok.coef, 12);
    expect(lab.drift!.panels[0].verdict).toBe('kayma yok');
  });

  it('step 5 accuracy appears three months after today', () => {
    const v = at('aylik-izleme', { today: 15 });
    expect(v.monitor!.today).toBe(15);
    const s = v.monitor!.series[0];
    expect(s.scenario).toBe('ani');
    expect(s.accuracy.filter(a => a.known).map(a => a.month)).toEqual(Array.from({ length: 15 - META.labelDelay }, (_x, i) => i + 1));
    expect(s.accuracy[12].known).toBe(false);
    expect(s.accuracy[11].known).toBe(true);
    // the metric is drawn up to today; the alarm at the change month shows on that day
    expect(s.alarms).toEqual([15]);
    expect(at('aylik-izleme', { today: 14 }).monitor!.series[0].alarms).toEqual([]);
    expect(at('aylik-izleme', { today: 14 }).monitor!.series[0].shown).toBe(14);
    expect(v.monitor!.threshold).toBe(BOOK.esik);
    expect(v.monitor!.metric).toBe('mean');
    // the performance alarm (month 15) is known three months later
    expect(at('aylik-izleme', { today: 17 }).monitor!.series[0].accAlarmShown).toBe(false);
    expect(at('aylik-izleme', { today: 18 }).monitor!.series[0].accAlarmShown).toBe(true);
    // today is clamped to the monitored months
    expect(at('aylik-izleme', { today: 2 }).monitor!.today).toBe(7);
    expect(at('aylik-izleme', { today: 99 }).monitor!.today).toBe(24);
    expect(v.strip).toContain('Başarım etiketi gecikmeli geliyorsa');
    expect(v.monitor!.accThreshold).toBeCloseTo(REFERENCE.accuracy - META.accMargin, 12);
  });

  it('step 6 sweep shows 4, 8, 12', () => {
    const seen = [1, 2, 3].map(scan => at('esik-secimi', { scan }));
    expect(seen.map(v => v.monitor!.threshold)).toEqual([...ORDER_THRESHOLDS]);
    expect(seen.map(v => shownThreshold(idx('esik-secimi'), { ...sc.defaults, scan: [1, 2, 3][seen.indexOf(v)] }, false))).toEqual([4, 8, 12]);
    expect(seen[0].monitor!.series.map(s => s.scenario)).toEqual(['yok', 'yavas']);
    expect(seen.map(v => v.table!.rows.find(r => r.current)!.threshold)).toEqual([4, 8, 12]);
    // the table carries the false alarms of yok and the delay of yavas, read from the same readout as the Lab
    const rows = seen[2].table!.rows;
    expect(rows.map(r => r.threshold)).toEqual([4, 8, 12]);
    expect(rows.map(r => r.falseAlarms)).toEqual(ORDER_THRESHOLDS.map(t => readout('yok', 'mean', t).falseAlarms));
    expect(rows.map(r => r.delay)).toEqual(ORDER_THRESHOLDS.map(t => readout('yavas', 'mean', t).delayText));
    expect(rows[2].delay).toBe('kaçırıldı');
    // alarms follow the threshold line
    expect(seen[0].monitor!.series[0].alarms.length).toBeGreaterThanOrEqual(2);
    expect(seen[1].monitor!.series[0].alarms).toEqual([]);
    expect(seen[2].monitor!.series[1].alarms).toEqual([]);
    expect(at('esik-secimi').monitor!.threshold).toBe(12);
    expect(seen[0].strip).toBe(NOTE_THRESHOLD);
    expect(at('esik-secimi').monitor!.refBand.hi).toBeCloseTo(REFERENCE.maxMonthlyDiff, 12);
  });

  it('lab ignores the sweeps', () => {
    const m5 = at('aylik-izleme', { today: 10, scan: 2 }, true).monitor!;
    expect(m5.today).toBe(META.months);
    expect(m5.series).toHaveLength(1);
    expect(m5.series[0].shown).toBe(META.months);
    const m6 = at('esik-secimi', { scan: 1, threshold: 6 }, true).monitor!;
    expect(m6.threshold).toBe(6);
    expect(at('esik-secimi', { scan: 1, threshold: 6 }, true).table).toBeUndefined();
    expect(shownThreshold(idx('esik-secimi'), { ...sc.defaults, scan: 1, threshold: 6 }, true)).toBe(6);
    expect(at('psi', { scan: 3 }, true).psi!.shown).toBe(10);
    expect(at('iki-donem', { scan: 1 }, true).line!.showCurrent).toBe(true);
    expect(at('alarm-akisi', { scan: 1 }, true).graph!.path).toEqual([...ALARM_PATH]);
    expect(at('hata-ayiklama', { scan: 1 }, true).code!.marked).toBe(BUGS.length);
    expect(at('hata-ayiklama', { scan: 1 }, true).code!.fixed).toBe(false);
  });

  it('lab steps 5-6 follow the chosen scenario, measure and threshold', () => {
    const v = at('aylik-izleme', { scenario: scenarioIndex('yavas'), metric: 'psi', threshold: 0.3 }, true);
    expect(v.monitor!.series[0].scenario).toBe('yavas');
    expect(v.monitor!.metric).toBe('psi');
    expect(v.monitor!.series[0].values).toEqual(scenarioById('yavas').months.map(m => m.psi));
    expect(v.monitor!.series[0].alarms).toEqual(readout('yavas', 'psi', 0.3).alarms);
    expect(v.monitor!.readout).toEqual(readout('yavas', 'psi', 0.3));
    expect(v.monitor!.refBand.hi).toBeCloseTo(Math.max(...scenarioById('yok').months.slice(0, META.refMonths).map(m => m.psi)), 12);
  });

  it('metric change brings its own default threshold', () => {
    expect(THRESHOLD.mean.def).toBe(BOOK.esik);
    expect(THRESHOLD.psi.def).toBe(0.25);
    expect(readout('yayilim', 'psi', THRESHOLD.psi.def).delay).toBe(0);
    expect(readout('yayilim', 'mean', THRESHOLD.mean.def).delay).toBeNull();
    const psiView = at('esik-secimi', { scenario: scenarioIndex('yayilim'), metric: 'psi', threshold: THRESHOLD.psi.def }, true);
    expect(psiView.monitor!.threshold).toBe(0.25);
    expect(psiView.monitor!.series[0].alarms[0]).toBe(15);
    expect(shownThreshold(idx('esik-secimi'), { ...sc.defaults, metric: 'psi', threshold: 0.25 }, true)).toBe(0.25);
  });

  it('readout of kavram at the defaults', () => {
    const r = readout('kavram', 'mean', THRESHOLD.mean.def);
    expect(r.alarms).toEqual([]);
    expect(r.falseAlarms).toBe(0);
    expect(r.delay).toBeNull();
    expect(r.delayText).toBe('kaçırıldı');
    expect(r.acc).toEqual({ month: 15, knownAt: 18 });
    expect(r.accuracy).toEqual({ month: 'ay 15', known: 'ay 18' });
    const psiR = readout('kavram', 'psi', THRESHOLD.psi.def);
    expect(psiR.alarms).toEqual([]);
    const v = at('aylik-izleme', { scenario: scenarioIndex('kavram') }, true);
    expect(v.monitor!.note).toBe(NOTE_CONCEPT);
    expect(v.note).toBe(NOTE_CONCEPT);
    expect(at('aylik-izleme', { scenario: scenarioIndex('ani') }, true).monitor!.note).toBeNull();
    // a late performance alarm is not known on day 24
    const late = readout('ani', 'mean', 8);
    expect(late.accuracy.month).toBe('ay 15');
    expect(readout('yok', 'mean', 8).delayText).toBe('—');
  });

  it('step 7 shows the spread month: the mean stays, the std doubles', () => {
    const v = at('ortalama-yaniltir');
    const m = monthOf('yayilim', SPREAD_MONTH);
    expect(v.spread!.scenario).toBe('yayilim');
    expect(v.spread!.month).toBe(SPREAD_MONTH);
    expect(v.spread!.boxes).toEqual([
      { label: 'Ortalama farkı', value: f(m.diff, 2) },
      { label: 'Standart sapma', value: `${f(REFERENCE.std, 2)} → ${f(m.std, 2)}` },
    ]);
    expect(v.spread!.curShare.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(v.note).toContain('KS testi');
    const lab = at('ortalama-yaniltir', { scenario: scenarioIndex('ani'), month: 20 }, true).spread!;
    expect(lab.scenario).toBe('ani');
    expect(lab.month).toBe(20);
    expect(lab.boxes[0].value).toBe(f(monthOf('ani', 20).diff, 2));
    // the Lab month stays in the monitored months
    expect(at('ortalama-yaniltir', { month: 2 }, true).spread!.month).toBe(7);
    expect(at('ortalama-yaniltir', { month: 99 }, true).spread!.month).toBe(24);
  });

  it('step 8 fills the ten bars one by one and writes the formula strip from the terms', () => {
    const m = monthOf('yayilim', SPREAD_MONTH);
    const terms = psiTerms(m.psiCounts, META.perMonth, REFERENCE.psiCounts, REFERENCE.n);
    const done = at('psi');
    expect(done.psi!.bars).toHaveLength(10);
    expect(done.psi!.shown).toBe(10);
    expect(done.psi!.total).toBeCloseTo(m.psi, 6);
    expect(done.psi!.total).toBeCloseTo(psi(m.psiCounts, META.perMonth, REFERENCE.psiCounts, REFERENCE.n), 12);
    done.psi!.bars.forEach((b, i) => {
      expect(b.p).toBeCloseTo(terms[i].p, 12);
      expect(b.q).toBeCloseTo(terms[i].q, 12);
      expect(b.term).toBeCloseTo(terms[i].term, 12);
    });
    expect(done.strip).toBe(
      `PSI = Σ (qᵢ − pᵢ) ln(qᵢ / pᵢ) = ${terms.map(t => f(t.term, 3)).join(' + ')} = ${f(m.psi, 3)}`,
    );
    const partial = at('psi', { scan: 3 });
    expect(partial.psi!.shown).toBe(3);
    expect(partial.strip).toBe(`PSI = Σ (qᵢ − pᵢ) ln(qᵢ / pᵢ) = ${terms.slice(0, 3).map(t => f(t.term, 3)).join(' + ')} + …`);
    expect(partial.note).toBe(psiNote());
    expect(at('psi', { scan: 1 }).psi!.bars.filter(b => b.shown)).toHaveLength(1);
    // every bin of every scenario-month has a count, so no footnote appears; the footnote follows an empty bin when there is one
    const empties = SCENARIOS.flatMap(s => s.months).filter(mm => mm.psiCounts.includes(0));
    for (const mm of empties) {
      const lab = deriveKaymaView(idx('psi'), { ...sc.defaults, month: mm.month }, true);
      expect(lab.psi!.footnote).toContain(f(META.psiFloor, 4));
    }
    expect(done.psi!.footnote).toBeNull();
  });

  it('step 9 walks the alarm path edge by edge', () => {
    const stages = [1, 2, 3, 4, 5, 6].map(scan => at('alarm-akisi', { scan }).graph!);
    stages.forEach((g, i) => {
      expect(g.path).toEqual(ALARM_PATH.slice(0, i + 1));
      expect(g.token!.via).toBe(ALARM_PATH[i]);
    });
    expect(stages.map(g => g.token!.at)).toEqual(['esik', 'alarm', 'inceleme', 'neden', 'davranis', 'izleme']);
    expect(stages.map(g => g.current)).toEqual(['esik', 'alarm', 'inceleme', 'neden', 'davranis', 'izleme']);
    expect(at('alarm-akisi').graph!.path).toEqual([...ALARM_PATH]);
    expect(at('alarm-akisi').graph!.nodes).toHaveLength(9);
    expect(at('alarm-akisi').graph!.edges).toHaveLength(13);
    expect(at('alarm-akisi').strip).toContain('otomatik yeniden eğitim');
  });

  it('step 10 marks the four bugs, then shows the corrected code', () => {
    const marks = [1, 2, 3, 4, 5].map(scan => at('hata-ayiklama', { scan }).code!);
    expect(marks.map(c => c.marked)).toEqual([1, 2, 3, 4, 4]);
    expect(marks.map(c => c.fixed)).toEqual([false, false, false, false, true]);
    expect(marks[0].error).toBe(RUN_ERROR);
    expect(marks[3].error).toBe(RUN_ERROR);
    expect(marks[4].error).toBeNull();
    expect(marks[4].output).toEqual([...OUTPUT]);
    expect(marks[0].output).toBeNull();
    expect(at('hata-ayiklama').code!.fixed).toBe(true);
    expect(at('hata-ayiklama', { scan: 2 }).strip).toContain(`hata 2 / ${BUGS.length}`);
    expect(at('hata-ayiklama', {}, true).code!.fixed).toBe(false);
    expect(at('hata-ayiklama', { fixed: true }, true).code!.fixed).toBe(true);
    expect(at('hata-ayiklama', { fixed: true }, true).code!.output).toEqual([...OUTPUT]);
    expect(at('hata-ayiklama', { fixed: true }, true).code!.error).toBeNull();
  });

  it('Ders views ignore the Lab choices on every step', () => {
    const choices: Partial<KaymaParams>[] = [
      { esik: 20 }, { scenario: 4, metric: 'psi', threshold: 0.9 }, { scenario: 0, month: 7 }, { fixed: true, month: 24 }, { threshold: 1 },
    ];
    for (let i = 0; i < sc.steps.length; i += 1) {
      const base = JSON.stringify(deriveKaymaView(i, sc.defaults, false));
      for (const c of choices) {
        expect(JSON.stringify(deriveKaymaView(i, { ...sc.defaults, ...c }, false)), `${sc.steps[i].id} ${JSON.stringify(c)}`).toBe(base);
      }
    }
  });

  it('no view text carries NaN or Infinity in any Lab choice', () => {
    for (let s = 0; s < SCENARIO_IDS.length; s += 1) {
      for (const metric of ['mean', 'psi'] as const) {
        for (const month of [7, 15, 24]) {
          for (let i = 0; i < sc.steps.length; i += 1) {
            const v = deriveKaymaView(i, { ...sc.defaults, scenario: s, metric, threshold: THRESHOLD[metric].def, month, fixed: s % 2 === 0 }, true);
            expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|undefined/);
          }
        }
      }
    }
    for (let i = 0; i < sc.steps.length; i += 1) {
      for (const scan of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        expect(JSON.stringify(deriveKaymaView(i, { ...sc.defaults, scan }, false))).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it('shownThreshold follows the sweep in Ders and the slider in the Lab', () => {
    expect(shownThreshold(idx('aylik-izleme'), sc.defaults, false)).toBe(BOOK.esik);
    expect(shownThreshold(idx('esik-secimi'), { ...sc.defaults, scan: 2 }, false)).toBe(8);
    expect(shownThreshold(idx('esik-secimi'), { ...sc.defaults, scan: 99 }, false)).toBe(12);
    expect(shownThreshold(idx('fark-esik'), { ...sc.defaults, esik: 3 }, true)).toBe(3);
    expect(shownThreshold(idx('aylik-izleme'), { ...sc.defaults, threshold: 5 }, true)).toBe(5);
  });
});
