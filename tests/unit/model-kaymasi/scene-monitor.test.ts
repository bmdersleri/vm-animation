// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNumber as f, formatTrim } from '../../../src/core/plot/format';
import { META, REFERENCE, scenarioById } from '../../../src/concepts/model-kaymasi/data';
import { ORDER_THRESHOLDS, readout } from '../../../src/concepts/model-kaymasi/scenario';
import { go, num, setup, texts } from './harness';

const months = (el: ParentNode, sel: string): number[] => [...el.querySelectorAll(sel)].map((e) => num(e, 'data-month'));
const pathPoints = (el: Element): number => (el.getAttribute('d') ?? '').split(/(?=[ML])/).length;

describe('monitoring chart (steps 5-6)', () => {
  it('step 5 ani alarms first at month 15', () => {
    const { el, player } = setup();
    go(player, 'aylik-izleme');
    const alarms = months(el, '.alarm-mark');
    expect(alarms[0]).toBe(readout('ani', 'mean', 8).alarms[0]);
    expect(alarms[0]).toBe(15);
    expect(alarms).toEqual(readout('ani', 'mean', 8).alarms);
    // UYARI is written once, on the first alarm month
    expect(texts(el, '.alarm-label')).toEqual(['UYARI']);
    // monitored months without an alarm carry the hollow mark
    expect(el.querySelectorAll('.ok-mark')).toHaveLength(META.months - META.refMonths - alarms.length);
    expect(el.querySelector('.ref-band')).not.toBeNull();
    expect(texts(el, '.lc-ref-label')[0]).toBe('8,0');
  });

  it('step 5 sweep shows accuracy three months late', () => {
    const { el, player } = setup();
    go(player, 'aylik-izleme', false);
    player.setParams({ today: 10 });
    expect(pathPoints(el.querySelector('.monitor-line')!)).toBe(10);
    expect(el.querySelector('.today-line')).not.toBeNull();
    const known = months(el, '.acc-dot');
    expect(Math.max(...known)).toBe(10 - META.labelDelay);
    expect(el.querySelectorAll('.acc-pending')).toHaveLength(1);
    expect(el.querySelector('.acc-pending-label')!.textContent).toContain('etiket bekleniyor');
    expect(el.querySelector('.acc-floor')).not.toBeNull();
    player.setParams({ today: 24 });
    expect(Math.max(...months(el, '.acc-dot'))).toBe(24 - META.labelDelay);
    // accuracy under the floor reads as low
    const low = months(el, '.acc-dot.is-low');
    const floor = REFERENCE.accuracy - META.accMargin;
    const expected = scenarioById('ani').months.filter((m) => m.month + META.labelDelay <= 24 && m.accuracy < floor).map((m) => m.month);
    expect(low).toEqual(expected);
    expect(low.length).toBeGreaterThan(0);
  });

  it('step 6 table reads false alarms and delays from data', () => {
    const { el, player } = setup();
    go(player, 'esik-secimi');
    expect(el.querySelectorAll('.monitor')).toHaveLength(2);
    expect([...el.querySelectorAll('.monitor')].map((m) => m.getAttribute('data-scenario'))).toEqual(['yok', 'yavas']);
    const rows = [...el.querySelectorAll('.threshold-table tbody tr')];
    expect(rows).toHaveLength(ORDER_THRESHOLDS.length);
    ORDER_THRESHOLDS.forEach((t, i) => {
      const cells = [...rows[i].querySelectorAll('td')].map((c) => c.textContent);
      expect(cells).toEqual([formatTrim(t, 2), String(readout('yok', 'mean', t).falseAlarms), readout('yavas', 'mean', t).delayText]);
    });
    // the sweep ended on the last threshold
    expect(rows.map((r) => r.classList.contains('is-current'))).toEqual([false, false, true]);
    expect(el.querySelector('.fluct-note')!.textContent).toContain(f(REFERENCE.maxMonthlyDiff, 2));
  });

  it('lab threshold drives the line after the step 6 sweep', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'esik-secimi');
    const lineY = (): number => num(el.querySelector('.threshold-line')!, 'y1');
    const before = lineY();
    const slider = host.querySelector<HTMLInputElement>('input[data-param="threshold"]')!;
    slider.value = '12';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.threshold).toBe(12);
    expect(lineY()).toBeLessThan(before);
    const rows = [...el.querySelectorAll('.threshold-table tbody tr')];
    expect(rows.filter((r) => r.classList.contains('is-current')).map((r) => r.querySelector('td')!.textContent)).toEqual(['12']);
    const r = readout('ani', 'mean', 12);
    expect(el.querySelector('[data-read="false"]')!.textContent).toContain(String(r.falseAlarms));
    expect(el.querySelector('[data-read="delay"]')!.textContent).toContain(r.delayText);
    // a stale Ders sweep does not come back
    expect(el.querySelectorAll('.monitor')).toHaveLength(1);
  });

  it('alarms read UYARI in text and shape', () => {
    const { el, player } = setup();
    go(player, 'aylik-izleme');
    const first = el.querySelector('.alarm-mark')!;
    expect(first.querySelector('path')!.getAttribute('d')).toMatch(/^M0,/);
    expect(el.querySelector('.alarm-label')!.textContent).toBe('UYARI');
    // the hollow mark is a circle without fill
    expect(el.querySelector('.ok-mark')!.tagName.toLowerCase()).toBe('circle');
  });

  it('the Lab readout writes the alarms, false alarms, delay and the performance alarm', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'aylik-izleme');
    const r = readout('ani', 'mean', 8);
    expect(el.querySelector('[data-read="alarms"]')!.textContent).toContain(`ay ${r.alarms[0]}`);
    expect(el.querySelector('[data-read="acc"]')!.textContent).toContain(r.accuracy.month);
    expect(el.querySelector('[data-read="acc"]')!.textContent).toContain(r.accuracy.known);
    // Lab keeps today fixed at month 24: the three newest months wait for their labels
    expect(el.querySelector('.today-line')).toBeNull();
    expect(Math.max(...months(el, '.acc-dot'))).toBe(META.months - META.labelDelay);
  });
});
