// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { MODEL, customerByRow } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const f3 = (v: number) => f(v, 3);

describe('card scene', () => {
  it('step 1 shows the book customer and p', () => {
    const { el, player } = setup();
    go(player, 'kara-kutu');
    const c = customerByRow(301);
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('card');
    const card = el.querySelector('.customer-card')!;
    expect(card.textContent).toContain('301');
    expect(texts(card, 'code.feature-name')).toEqual(['tenure', 'MonthlyCharges', 'TotalCharges']);
    expect(texts(card, '.feature-value')).toEqual(['51', '51,06', '2366,05']);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f3(c.p));
    expect(num(el.querySelector('.prob-fill')!, 'data-ratio')).toBeCloseTo(c.p, 6);
    expect(el.querySelector('.acc-note')!.textContent).toContain('%94,0');
    expect(el.querySelector('.formula')!.textContent).toContain('predict_proba');
  });

  it('step 1 follows the chosen customer', () => {
    const { el, player } = setup();
    go(player, 'kara-kutu');
    player.setParam('customer', 77);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f3(customerByRow(77).p));
    expect(el.querySelector('.customer-card')!.textContent).toContain('77');
  });

  it('step 2 bars read the importances', () => {
    const { el, player } = setup();
    go(player, 'genel-onem');
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('bars');
    const bars = [...el.querySelectorAll('.imp-bar')];
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.querySelector('.bar-value')!.textContent)).toEqual(MODEL.importances.map(f3));
    expect(bars.map((b) => b.querySelector('.bar-name')!.textContent)).toEqual(['tenure', 'MonthlyCharges', 'TotalCharges']);
    const w = bars.map((b) => num(b.querySelector('rect.bar')!, 'width'));
    expect(w[0] / w[1]).toBeCloseTo(MODEL.importances[0] / MODEL.importances[1], 1);
    expect(el.querySelectorAll('.mean-shap-bar')).toHaveLength(0);
  });

  it('step 8 draws two bar groups side by side', () => {
    const { el, player } = setup();
    go(player, 'global');
    expect(el.querySelectorAll('.imp-bar')).toHaveLength(3);
    const shap = [...el.querySelectorAll('.mean-shap-bar')];
    expect(shap.map((b) => b.querySelector('.bar-value')!.textContent)).toEqual(MODEL.meanAbsShap.map(f3));
    expect(el.querySelector('.customer-card')!.hasAttribute('hidden') || !el.querySelector('.customer-card')!.isConnected).toBe(true);
  });
});
