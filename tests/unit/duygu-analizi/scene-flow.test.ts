// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { go, num, setup, texts } from './harness';

describe('flow scene', () => {
  it('step 1 counts both classes', () => {
    const { el } = setup();
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('flow');
    expect(texts(el, '.flow-stage')).toEqual(['yorum', 'temizle', 'TF-IDF', 'lojistik regresyon', 'olumlu / olumsuz']);
    const bars = [...el.querySelectorAll('.count-bar')];
    expect(bars.map((b) => b.querySelector('.bar-name')!.textContent)).toEqual(['olumlu', 'olumsuz']);
    expect(bars.map((b) => b.querySelector('.bar-value')!.textContent)).toEqual(['200', '200']);
    const w = bars.map((b) => num(b.querySelector('rect.bar')!, 'width'));
    expect(w[0]).toBeGreaterThan(0);
    expect(w[0]).toBe(w[1]);
    expect(el.querySelectorAll('.sample').length).toBe(4);
    expect(el.querySelector('.flow-warning')!.textContent).toBe('Duygu etiketi, müşteri kaybı etiketi değildir.');
  });

  it('step 2 splits train and test', () => {
    const { el, player } = setup();
    go(player, 'boru-hatti');
    const bars = [...el.querySelectorAll('.count-bar')];
    expect(bars.map((b) => b.getAttribute('data-split'))).toEqual(['train', 'train', 'test', 'test']);
    expect(bars.map((b) => b.querySelector('.bar-value')!.textContent)).toEqual(['150', '150', '50', '50']);
    const w = (i: number) => num(bars[i].querySelector('rect.bar')!, 'width');
    expect(w(0) / w(2)).toBeCloseTo(3, 1);
    expect(el.querySelector('.code-text')!.textContent).toContain('LogisticRegression(max_iter=1000)');
    expect(el.querySelectorAll('.flow-stage.is-active').length).toBe(3);
    expect(el.querySelector('.flow-warning')!.hasAttribute('hidden')).toBe(true);
  });
});
