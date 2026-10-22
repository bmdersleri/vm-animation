import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  korelasyonScenario, korelasyonShortcuts, SET_STEPS, CHURN_STEPS, LEVERAGE_STEPS,
  type KorelParams,
} from '../../../src/concepts/korelasyon-isi-haritasi/scenario';

function make(): StepPlayer<KorelParams> {
  return new StepPlayer<KorelParams>(korelasyonScenario);
}

function press(p: StepPlayer<KorelParams>, key: string): void {
  const sc = korelasyonShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = [
  'iki-degisken', 'korelasyon', 'nedensellik', 'isi-haritasi', 'anscombe',
  'kaldirac', 'dogrusal-degil', 'kategori', 'sizinti', 'kural',
];

describe('korelasyon senaryosu', () => {
  it('10 adım ve benzersiz kimlikler', () => {
    expect(korelasyonScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(10);
  });

  it('her adımda başlık, metin ve terim var', () => {
    for (const s of korelasyonScenario.steps) {
      expect(s.title.trim(), s.id).not.toBe('');
      expect(s.text.trim(), s.id).not.toBe('');
      expect(s.term, s.id).toBeTruthy();
    }
  });

  it('varsayılanlar: set I, kaldıraç y 12,5, churn kapalı', () => {
    expect(korelasyonScenario.defaults).toEqual({ set: 1, noktaY: 12.5, churn: false });
  });

  it('adım 4 churn’ü kapatır, adım 6 set IV’ü, adım 7 set II’yi, adım 8 churn’ü açar', () => {
    const p = make();
    p.goto(3);
    expect(p.state.params.churn).toBe(false);
    p.goto(5);
    expect(p.state.params.set).toBe(4);
    expect(p.state.params.noktaY).toBe(12.5);
    p.goto(6);
    expect(p.state.params.set).toBe(2);
    p.goto(7);
    expect(p.state.params.churn).toBe(true);
    expect(p.state.params.set).toBe(2);
  });

  it('S seti I → II → III → IV → I döngüsünde gezdirir, yalnız 5–7. adımlarda', () => {
    const p = make();
    p.goto(0);
    press(p, 's');
    expect(p.state.params.set).toBe(1);
    p.goto(3);
    press(p, 'S');
    expect(p.state.params.set).toBe(1);

    p.goto(4);
    expect(p.state.params.set).toBe(1);
    press(p, 's');
    expect(p.state.params.set).toBe(2);
    press(p, 'S');
    expect(p.state.params.set).toBe(3);
    press(p, 's');
    expect(p.state.params.set).toBe(4);
    press(p, 'S');
    expect(p.state.params.set).toBe(1);
  });

  it('C churn’ü yalnız 4 ve 8. adımlarda açar', () => {
    const p = make();
    p.goto(0);
    press(p, 'c');
    expect(p.state.params.churn).toBe(false);

    p.goto(3);
    press(p, 'c');
    expect(p.state.params.churn).toBe(true);
    press(p, 'C');
    expect(p.state.params.churn).toBe(false);

    p.goto(7);
    expect(p.state.params.churn).toBe(true);
    press(p, 'c');
    expect(p.state.params.churn).toBe(false);
    press(p, 'c');
    expect(p.state.params.churn).toBe(true);
  });

  it('K kaldıraç y’sini 6 → 8 → 10 → 12,5 → 15 → 18 → 20 tablosunda gezdirir', () => {
    const p = make();
    p.goto(0);
    press(p, 'k');
    expect(p.state.params.noktaY).toBe(12.5);

    p.goto(5);
    expect(p.state.params.noktaY).toBe(12.5);
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      press(p, 'K');
      seen.push(p.state.params.noktaY);
    }
    expect(seen).toEqual([15, 18, 20, 6, 8, 10, 12.5]);

    // kaydırıcıdan gelen ara değer döngünün ilk basamağına döner
    p.setParam('noktaY', 11.3);
    press(p, 'K');
    expect(p.state.params.noktaY).toBe(6);
  });

  it('adım aralıkları spec ile aynı', () => {
    expect(SET_STEPS).toEqual([4, 5, 6]);
    expect(CHURN_STEPS).toEqual([3, 7]);
    expect(LEVERAGE_STEPS).toEqual([5]);
  });

  it('kısayol bilgisi', () => {
    expect(korelasyonShortcuts(make()).map((s) => [s.keys, s.display, s.label])).toEqual([
      [['s', 'S'], 'S', 'Set: I / II / III / IV'],
      [['c', 'C'], 'C', 'churn sütunu: kapalı / açık'],
      [['k', 'K'], 'K', 'Kaldıraç noktası y: 6 → 20'],
    ]);
  });
});
