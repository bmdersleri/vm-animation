import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { formatNumber as f, formatTrim } from '../../../src/core/plot/format';
import {
  BOOK, CURVES, META, REFERENCE, SCENARIO_IDS, SPREAD_MONTH, monthOf, scenarioById,
} from '../../../src/concepts/model-kaymasi/data';
import { BUGS, OUTPUT } from '../../../src/concepts/model-kaymasi/code-text';
import {
  END_LINKS, ESIK, NOTE_ADVICE, NOTE_DIFF, NOTE_THRESHOLD, NOTE_TRAP, ORDER_THRESHOLDS, SCAN_DONE, THRESHOLD, modelKaymasiScenario as sc,
  psiNote, readout, scenarioIdAt,
} from '../../../src/concepts/model-kaymasi/scenario';
import { labTextTests } from '../lab-text';

const step = (id: string) => sc.steps.find(s => s.id === id)!;

describe('model-kaymasi scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map(s => s.id)).toEqual([
      'alti-ay-sonra', 'iki-donem', 'fark-esik', 'veri-kavram', 'aylik-izleme', 'esik-secimi',
      'ortalama-yaniltir', 'psi', 'alarm-akisi', 'hata-ayiklama',
    ]);
    expect(sc.defaults).toEqual({
      esik: 8, scenario: 1, metric: 'mean', threshold: 8, month: SPREAD_MONTH, fixed: false, today: 24, scan: SCAN_DONE,
    });
    expect(SCENARIO_IDS[sc.defaults.scenario]).toBe('ani');
    expect(sc.defaults.esik).toBe(BOOK.esik);
    expect(sc.defaults.threshold).toBe(THRESHOLD.mean.def);
    expect(sc.defaults.today).toBe(META.months);
    expect(THRESHOLD).toEqual({ mean: { min: 1, max: 20, step: 0.5, def: 8 }, psi: { min: 0.05, max: 1, step: 0.05, def: 0.25 } });
    expect(ESIK).toEqual({ min: 0, max: 20, step: 0.5 });
    expect(ORDER_THRESHOLDS).toEqual([4, 8, 12]);
    expect(stepIndex(sc, 'alti-ay-sonra')).toBe(0);
  });

  it('step texts read numbers from data', () => {
    const ani = scenarioById('ani');
    const firstAlarm = readout('ani', 'mean', BOOK.esik).alarms[0];
    expect(firstAlarm).toBe(ani.changeMonth);
    const spread = monthOf('yayilim', SPREAD_MONTH);
    expect(step('alti-ay-sonra').text).toContain(`Ay 1–${META.refMonths}`);
    expect(step('alti-ay-sonra').text).toContain(`ay ${META.refMonths + 1}–${META.months}`);
    expect(step('iki-donem').text).toContain(`[${BOOK.reference.join(', ')}] ortalaması ${f(BOOK.refMean, 2)}`);
    expect(step('iki-donem').text).toContain(`[${BOOK.current.join(', ')}] ortalaması ${f(BOOK.curMean, 2)}`);
    expect(f(BOOK.refMean, 2)).toBe('55,80');
    expect(f(BOOK.curMean, 2)).toBe('70,20');
    expect(step('fark-esik').text).toContain(`|${f(BOOK.curMean, 2)} − ${f(BOOK.refMean, 2)}| = ${f(BOOK.diff, 2)}`);
    expect(step('fark-esik').text).toContain(`${f(BOOK.diff, 2)} > ${f(BOOK.esik, 1)}`);
    expect(step('fark-esik').text).toContain(`Kayma farkı: ${BOOK.diff.toFixed(2)} | Durum: UYARI`);
    expect(step('fark-esik').text).toContain(NOTE_DIFF);
    expect(step('veri-kavram').text).toContain(`katsayı ${f(REFERENCE.coef, 3)} → ${f(CURVES.kavram.coef, 3)}`);
    expect(step('veri-kavram').text).toContain(`katsayı ${f(REFERENCE.coef, 3)} → ${f(CURVES.ani.coef, 3)}`);
    expect(step('aylik-izleme').text).toContain(`Ay ${firstAlarm} alarm verir (fark ${f(monthOf('ani', firstAlarm).diff, 2)})`);
    expect(step('aylik-izleme').text).toContain(`doğruluk noktası ${META.labelDelay} ay sonra`);
    expect(step('aylik-izleme').text).toContain(`eşik ${f(BOOK.esik, 1)}`);
    expect(step('aylik-izleme').text).toContain(NOTE_ADVICE);
    // step 6: false alarms of yok and delays of yavas at 4 / 8 / 12, read through the same readout the Lab uses
    const fa = ORDER_THRESHOLDS.map(t => readout('yok', 'mean', t).falseAlarms).join(' / ');
    const delay = ORDER_THRESHOLDS.map(t => readout('yavas', 'mean', t).delayText).join(' / ');
    expect(step('esik-secimi').text).toContain(`yanlış alarm ${fa}`);
    expect(step('esik-secimi').text).toContain(`gecikme ${delay}`);
    expect(step('esik-secimi').text).toContain(`en büyüğü ${f(REFERENCE.maxMonthlyDiff, 2)}`);
    expect(step('esik-secimi').text).toContain(NOTE_THRESHOLD);
    expect(step('ortalama-yaniltir').text).toContain(`ay ${SPREAD_MONTH}: ortalama farkı ${f(spread.diff, 2)}`);
    expect(step('ortalama-yaniltir').text).toContain(`std ${f(REFERENCE.std, 2)} → ${f(spread.std, 2)}`);
    expect(spread.diff).toBeLessThan(BOOK.esik);
    expect(step('psi').text).toContain(`toplam ${f(spread.psi, 3)}`);
    expect(step('psi').text).toContain(psiNote());
    expect(psiNote()).toMatch(/^0,1 \/ 0,25 yaygın uygulamadır; kitap sınır vermez\./);
    expect(psiNote()).toContain(`${formatTrim(0.1, 2)} / ${formatTrim(0.25, 2)}`);
    expect(step('alarm-akisi').text).toContain(`ay ${firstAlarm} alarmını gerçek davranış değişimi dalından`);
    expect(step('alarm-akisi').text).toContain(NOTE_TRAP);
    expect(step('hata-ayiklama').text).toContain(`${BUGS.length} hata`);
    for (const line of OUTPUT) {
      expect(step('hata-ayiklama').text).toContain(`"${line}"`);
    }
    // the end-of-lesson links by their titles, as the scene links them, not by their slugs
    expect(END_LINKS.map(l => l.href)).toEqual(['../crisp-dm/', '../shap-degerleri/']);
    expect(step('hata-ayiklama').text).toContain(`Ders sonu bağlantıları: ${END_LINKS.map(l => l.text).join(' ve ')}.`);
    expect(step('hata-ayiklama').text).not.toMatch(/crisp-dm|shap-degerleri/);
    for (const s of sc.steps) {
      expect(s.text, s.id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('step 6 numbers are the ones the generator checks (yok quiet at 8, yavas misses at 12)', () => {
    expect(readout('yok', 'mean', 8).falseAlarms).toBe(0);
    expect(readout('yok', 'mean', 4).falseAlarms).toBeGreaterThanOrEqual(2);
    expect(readout('yavas', 'mean', 12).delayText).toBe('kaçırıldı');
    expect(readout('yok', 'mean', 8).delayText).toBe('—');
  });

  it('no computed number is followed by an apostrophe suffix', () => {
    for (const s of sc.steps) {
      expect(s.text, s.id).not.toMatch(/\d['’][a-zçğıöşü]/i);
    }
  });

  it('no step resets the lab choices', () => {
    for (const s of sc.steps) {
      for (const k of ['esik', 'scenario', 'metric', 'threshold', 'month', 'fixed']) {
        expect(Object.keys(s.params ?? {}), s.id).not.toContain(k);
      }
    }
  });

  it('sweeps use today (step 5) or scan with the stage counts', () => {
    const sweeps = Object.fromEntries(sc.steps.filter(s => s.sweep).map(s => [s.id, s.sweep!]));
    expect(Object.keys(sweeps)).toEqual(['iki-donem', 'aylik-izleme', 'esik-secimi', 'psi', 'alarm-akisi', 'hata-ayiklama']);
    expect(sweeps['iki-donem'].values).toEqual([1, 2]);
    expect(sweeps['aylik-izleme'].key).toBe('today');
    expect(sweeps['aylik-izleme'].values).toEqual(Array.from({ length: 18 }, (_v, i) => 7 + i));
    expect(sweeps['esik-secimi'].values).toEqual([1, 2, 3]);
    expect(sweeps['psi'].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(sweeps['alarm-akisi'].values).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sweeps['hata-ayiklama'].values).toEqual([1, 2, 3, 4, 5]);
    for (const [id, w] of Object.entries(sweeps)) {
      expect(w.key, id).toBe(id === 'aylik-izleme' ? 'today' : 'scan');
    }
  });

  it('scenarioIdAt maps the Lab index and clamps it', () => {
    expect(SCENARIO_IDS.map((_id, i) => scenarioIdAt(i))).toEqual([...SCENARIO_IDS]);
    expect(scenarioIdAt(-3)).toBe('yok');
    expect(scenarioIdAt(99)).toBe('kavram');
  });

  labTextTests(sc.steps, [3, 4, 5, 6, 7, 8, 10]);
});
