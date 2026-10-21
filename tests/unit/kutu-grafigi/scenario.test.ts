import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  kutuScenario, kutuShortcuts, K_STEPS, SIXTH_STEPS, THIRD_STEPS, DOTS_STEPS, type KutuParams,
} from '../../../src/concepts/kutu-grafigi/scenario';

function make(): StepPlayer<KutuParams> {
  return new StepPlayer<KutuParams>(kutuScenario);
}

function press(p: StepPlayer<KutuParams>, key: string): void {
  const sc = kutuShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = ['iki-grup', 'medyan', 'ceyrekler', 'kutu', 'biyik', 'aykiri', 'ucuncu-grup', 'sinir'];

describe('kutuScenario', () => {
  it('8 adım ve benzersiz kimlikler', () => {
    expect(kutuScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(8);
  });

  it('her adımda başlık, metin ve terim var', () => {
    for (const s of kutuScenario.steps) {
      expect(s.title.trim(), s.id).not.toBe('');
      expect(s.text.trim(), s.id).not.toBe('');
      expect(s.term, s.id).toBeTruthy();
    }
  });

  it('varsayılanlar: k 1,5, 6. öğrenci kapalı, üçüncü grup kapalı, noktalar görünür', () => {
    expect(kutuScenario.defaults).toEqual({ k: 1.5, sixth: false, third: false, dots: true });
  });

  it('3. adım iki grup, 7. adım üçüncü grubu açar', () => {
    const p = make();
    expect(p.state.index).toBe(0);
    p.goto(2);
    expect(p.state.params.third).toBe(false);
    p.goto(6);
    expect(p.state.params.third).toBe(true);
    p.goto(7);
    expect(p.state.params.third).toBe(true);
  });

  it('6. öğrenci 2–8. adımlarda açık kalır, adım değişince sıfırlanmaz', () => {
    const p = make();
    p.goto(1);
    press(p, 'a');
    expect(p.state.params.sixth).toBe(true);
    for (let i = 2; i < 8; i++) {
      p.goto(i);
      expect(p.state.params.sixth, `adım ${i + 1}`).toBe(true);
    }
  });

  it('kısayollar yalnız sahibi oldukları adımlarda çalışır', () => {
    const p = make();
    p.goto(0);
    press(p, 'k');
    expect(p.state.params.k).toBe(1.5);
    press(p, 'a');
    expect(p.state.params.sixth).toBe(false);
    press(p, 'n');
    expect(p.state.params.dots).toBe(false);
    press(p, 'n');
    expect(p.state.params.dots).toBe(true);

    p.goto(3);
    press(p, 'K');
    expect(p.state.params.k).toBe(1.5);
    p.goto(4);
    press(p, 'K');
    expect(p.state.params.k).toBe(3);
    press(p, 'k');
    expect(p.state.params.k).toBe(1.5);
    p.goto(7);
    press(p, 'K');
    expect(p.state.params.k).toBe(3);

    p.goto(1);
    press(p, 'A');
    expect(p.state.params.sixth).toBe(true);

    // üçüncü grubun anahtarı yok: 7–8. adımlar onu adım parametresiyle açar
    p.goto(6);
    expect(p.state.params.third).toBe(true);
  });

  it('adım aralıkları spec ile aynı', () => {
    expect(K_STEPS).toEqual([4, 5, 6, 7]);
    expect(SIXTH_STEPS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(THIRD_STEPS).toEqual([6, 7]);
    expect(DOTS_STEPS).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('kısayol bilgisi', () => {
    expect(kutuShortcuts(make()).map((s) => [s.keys, s.display, s.label])).toEqual([
      [['k', 'K'], 'K', 'IQR katsayısı: 1,5 ↔ 3,0'],
      [['a', 'A'], 'A', '6. öğrenci: kapalı / açık'],
      [['n', 'N'], 'N', 'Noktalar: görünür / gizli'],
    ]);
  });
});
