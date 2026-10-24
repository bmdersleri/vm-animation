// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BOOK } from '../../../src/concepts/metin/data';
import { go, num, setup, texts } from './harness';

const shaft = (e: Element): { dx: number; dy: number } => {
  const l = e.querySelector('line.vec-shaft')!;
  return { dx: num(l, 'x2') - num(l, 'x1'), dy: num(l, 'y2') - num(l, 'y1') };
};

describe('vector scene', () => {
  it('step 8 ranks the query comments', () => {
    const { el, player } = setup();
    go(player, 'kosinus');
    expect(el.querySelector('.tf-stage')!.getAttribute('data-view')).toBe('vectors');
    const rows = [...el.querySelectorAll('.sim-row')];
    expect(rows.map((r) => r.querySelector('.sim-score')!.textContent)).toEqual(['1,000', '0,143', '0,000']);
    expect(rows.map((r) => r.querySelector('.sim-label')!.textContent)).toEqual(BOOK.kod03.order.map((i) => BOOK.kod03.docs[i]));
    expect(rows[0].classList.contains('is-query')).toBe(true);
    expect(rows[1].querySelector('.sim-note')!.textContent).toBe('ortak terim: internet');
    expect(el.querySelectorAll('.vec-arrow')).toHaveLength(2);
    expect(el.querySelectorAll('path.angle-arc')).toHaveLength(1);
    expect(texts(el, '.axis-title')).toEqual(['internet', 'bağlantı']);
    expect(texts(el, 'text.angle-label')[0]).toMatch(/^açı \d+°$/);
    expect(el.querySelector('.formula')!.textContent).toContain('0,402 · 0,355 = 0,143');
  });

  it('step 9 draws two arrows on one direction', () => {
    const { el, player } = setup();
    go(player, 'uzunluk-yon');
    const arrows = [...el.querySelectorAll('.vec-arrow')];
    expect(arrows.map((a) => a.getAttribute('data-id'))).toEqual(['query', 'double']);
    const [q, d] = arrows.map(shaft);
    // same direction, the doubled arrow reaches twice as far from the origin
    expect(Math.abs(Math.atan2(q.dy, q.dx) - Math.atan2(d.dy, d.dx))).toBeLessThan(0.01);
    const lenQ = Math.hypot(q.dx, q.dy);
    const lenD = Math.hypot(d.dx, d.dy);
    expect(lenD).toBeGreaterThan(lenQ * 1.6);
    expect(lenD).toBeLessThan(lenQ * 2.4);
    expect(el.querySelectorAll('path.angle-arc')).toHaveLength(0);
    expect(texts(el, 'text.angle-label')).toEqual(['açı 0°']);
    expect(texts(el, '.sim-label')).toEqual(['kosinüs benzerliği', 'Öklid uzaklığı']);
    expect(texts(el, '.sim-score')).toEqual(['1,000', '2,000']);
  });

  it('step 10 draws two cards and two links', () => {
    const { el, player } = setup();
    go(player, 'ortak-sozluk');
    expect(el.querySelector('.tf-stage')!.getAttribute('data-view')).toBe('cards');
    expect([...el.querySelectorAll('.text-card')].map((c) => c.getAttribute('data-kind'))).toEqual(['ayri-sozluk', 'anlam']);
    const links = [...el.querySelectorAll<HTMLAnchorElement>('.card-link')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['../duygu-analizi/', '../k-means/']);
    expect(el.querySelector('.text-card[data-kind="anlam"]')!.textContent).toContain('0,603');
    expect(el.querySelector('.text-card[data-kind="ayri-sozluk"]')!.textContent).toContain('1,000');
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('every step renders at 390 px and in the Lab mode without NaN', () => {
    const { el, player } = setup(390, 520);
    for (let i = 0; i < player.state.count; i += 1) {
      player.goto(i);
      expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
      expect(el.innerHTML).not.toMatch(/="NaN"/);
    }
  });
});
