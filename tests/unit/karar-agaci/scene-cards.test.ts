// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { CardsLayer } from '../../../src/concepts/karar-agaci/scene-cards';
import { deriveTreeView } from '../../../src/concepts/karar-agaci/view';
import { treeScenario, type TreeParams } from '../../../src/concepts/karar-agaci/scenario';
import { train } from '../../../src/concepts/karar-agaci/data';

const D = treeScenario.defaults;
const view = (i: number, over: Partial<TreeParams> = {}) => deriveTreeView(i, { ...D, ...over });
let layers: CardsLayer[] = [];

function setup(): { host: HTMLElement; layer: CardsLayer } {
  const host = document.createElement('div');
  document.body.append(host);
  const layer = new CardsLayer(host);
  layers.push(layer);
  return { host, layer };
}

const all = (el: Element, sel: string): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(sel)];
const text = (el: Element | null): string => (el?.textContent ?? '').trim();
const layerEl = (host: HTMLElement): HTMLElement => host.querySelector<HTMLElement>('.cards-layer')!;

afterEach(() => {
  for (const l of layers) l.destroy();
  layers = [];
  document.body.replaceChildren();
});

describe('CardsLayer', () => {
  it('four cards in part 1, filled ones show their counts', () => {
    const { host, layer } = setup();
    layer.update(view(2, { shown: 1 }), 0);
    expect(layerEl(host).hidden).toBe(false);
    const cards = all(host, '.cards .card');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => text(c.querySelector('h3.card-title')))).toEqual(['Hava?', 'Sıcaklık?', 'Nem?', 'Rüzgâr?']);

    const hava = cards[0];
    const branches = all(hava, '.branch');
    expect(branches).toHaveLength(3);
    expect(branches.map((b) => text(b.querySelector('.branch-label')))).toEqual(['Güneşli', 'Bulutlu', 'Yağmurlu']);
    expect(branches.map((b) => text(b.querySelector('.branch-count')))).toEqual(['2/3', '4/0', '3/2']);
    expect(text(hava.querySelector('p.card-score'))).toBe('Gini 0,343 · azalma 0,116');
    // bar width is the branch's share of the card's samples (5, 4, 5 of 14)
    const fills = branches.map((b) => parseFloat(b.querySelector<HTMLElement>('.fill')!.style.width));
    expect(fills[0]).toBeCloseTo((5 / 14) * 100, 3);
    expect(fills[1]).toBeCloseTo((4 / 14) * 100, 3);
    // the two class segments split the bar by the branch's counts
    const segs = all(branches[0], '.seg');
    expect(segs.map((s) => s.className)).toEqual(['seg c0', 'seg c1']);
    expect(parseFloat(segs[0].style.width)).toBeCloseTo(40, 3);
    expect(parseFloat(segs[1].style.width)).toBeCloseTo(60, 3);

    for (const empty of cards.slice(1)) {
      expect(empty.classList.contains('empty')).toBe(true);
      expect(all(empty, '.branch-count').every((c) => text(c) === '')).toBe(true);
      expect(all(empty, '.fill').every((f) => parseFloat(f.style.width) === 0)).toBe(true);
      expect(text(empty.querySelector('p.card-score'))).toBe('');
    }
  });

  it('winner has .win only from step 4', () => {
    const { host, layer } = setup();
    layer.update(view(3, { shown: 4 }), 0);
    expect(all(host, '.card.win')).toHaveLength(0);
    layer.update(view(4, { shown: 4 }), 0);
    const cards = all(host, '.card');
    expect(cards.map((c) => c.classList.contains('win'))).toEqual([true, false, false, false]);
    // Bulutlu 4/0 is marked as a pure leaf on the winning card
    const pure = all(cards[0], '.branch.pure').map((b) => text(b.querySelector('.branch-label')));
    expect(pure).toEqual(['Bulutlu']);
    layer.update(view(5, { shown: 4, criterion: 'entropi' }), 0);
    expect(all(host, '.card').map((c) => c.classList.contains('win'))).toEqual([true, false, false, false]);
    expect(text(host.querySelector('.card.win p.card-score'))).toBe('Entropi 0,694 · bilgi kazancı 0,247 bit');
    layer.update(view(2, { shown: 1 }), 0);
    expect(all(host, '.card.win')).toHaveLength(0);
  });

  it('formula strip text equals view.strip', () => {
    const { host, layer } = setup();
    for (const v of [view(2, { shown: 1 }), view(3, { shown: 3 }), view(5, { shown: 4, criterion: 'entropi' }), view(11)]) {
      layer.update(v, 0);
      const strip = host.querySelector<HTMLElement>('p.formula')!;
      expect(strip.hidden).toBe(false);
      expect(text(strip)).toBe(v.strip);
    }
    const v0 = view(0, { shown: 0 });
    expect(v0.strip).toBeNull();
    layer.update(v0, 0);
    expect(host.querySelector<HTMLElement>('p.formula')!.hidden).toBe(true);
  });

  it('step 8 renders two threshold cards', () => {
    const { host, layer } = setup();
    const v = view(8, { depth: 1 });
    layer.update(v, 0);
    expect(layerEl(host).hidden).toBe(false);
    const cards = all(host, '.card');
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => text(c.querySelector('h3.card-title')))).toEqual(v.cards.map((c) => `${c.title}?`));
    for (const [i, c] of cards.entries()) {
      const labels = all(c, '.branch-label').map(text);
      expect(labels).toHaveLength(2);
      expect(labels[0]).toMatch(/^≤ \d+(,\d)?$/);
      expect(labels[1]).toBe(labels[0].replace('≤', '>'));
      expect(c.classList.contains('win')).toBe(v.cards[i].win);
    }
    expect(text(host.querySelector('p.formula'))).toBe(v.strip);

    layer.update(view(11), 0);
    expect(all(host, '.card')).toHaveLength(1);
    expect(text(host.querySelector('h3.card-title'))).toBe('Kitabın örneği');
    expect(all(host, '.branch-count').map(text)).toEqual(['15/35', '45/5']);
  });

  it('part 2 non-card steps hide the layer', () => {
    const { host, layer } = setup();
    layer.update(view(2, { shown: 1 }), 0);
    for (const [i, over] of [[6, {}], [7, { scan: 4 }], [9, { depth: 2 }], [10, { depth: 4, showTest: true }]] as const) {
      layer.update(view(i, over), 0);
      expect(layerEl(host).hidden).toBe(true);
    }
    layer.update(view(8, { depth: 1 }), 0);
    expect(layerEl(host).hidden).toBe(false);
  });

  it('root row: hidden at step 1, the 9/5 bar and its Gini from step 2 on', () => {
    const { host, layer } = setup();
    const row = () => host.querySelector<HTMLElement>('.root-row')!;
    layer.update(view(0, { shown: 0 }), 0);
    expect(row().hidden).toBe(true);
    layer.update(view(1, { shown: 0 }), 0);
    expect(row().hidden).toBe(false);
    expect(text(row().querySelector('.root-label'))).toBe('Kök: 14 gün');
    expect(text(row().querySelector('.root-count'))).toBe('9/5');
    expect(text(row().querySelector('.root-score'))).toBe('Gini 0,459');
    expect(parseFloat(row().querySelector<HTMLElement>('.fill')!.style.width)).toBe(100);
    const segs = all(row(), '.seg');
    expect(parseFloat(segs[0].style.width)).toBeCloseTo((9 / 14) * 100, 3);
    expect(parseFloat(segs[1].style.width)).toBeCloseTo((5 / 14) * 100, 3);
    // the root step's strip shows the root formula
    expect(text(host.querySelector('p.formula'))).toBe('1 − (9/14)² − (5/14)² = 0,459');
    layer.update(view(5, { shown: 4, criterion: 'entropi' }), 0);
    expect(text(row().querySelector('.root-score'))).toBe('Entropi 0,940');
    layer.update(view(8, { depth: 1 }), 0);
    expect(row().hidden).toBe(true);
  });

  it('book step: root 0,480 / 0,971 and the card shows both criteria', () => {
    const { host, layer } = setup();
    layer.update(view(11), 0);
    const row = host.querySelector<HTMLElement>('.root-row')!;
    expect(row.hidden).toBe(false);
    expect(text(row.querySelector('.root-label'))).toBe('Kök: 100 müşteri');
    expect(text(row.querySelector('.root-count'))).toBe('60/40');
    expect(text(row.querySelector('.root-score'))).toBe('Gini 0,480 · Entropi 0,971');
    const scores = all(host, '.card p.card-score').filter((p) => !p.hidden).map(text);
    expect(scores).toEqual(['Gini 0,300 · azalma 0,180', 'Entropi 0,675 · bilgi kazancı 0,296 bit']);
    // part 1 cards have no second score line
    layer.update(view(4, { shown: 4 }), 0);
    expect(all(host, '.card p.card-score.alt').every((p) => p.hidden)).toBe(true);
  });

  it('user split card: no question mark, "0 müşteri" for an empty branch, no rebuild while dragging', () => {
    const { host, layer } = setup();
    layer.update(view(6, { userSplit: { feature: 0, threshold: 20 } }), 0);
    const cards = all(host, '.card');
    expect(cards.map((c) => text(c.querySelector('h3.card-title')))).toEqual([
      'Senin eşiğin: Sözleşme ≤ 20', 'Ağacın seçimi: Şikâyet ≤ 2,5',
    ]);
    const first = cards[0];
    const max = Math.max(...train.map((r) => r.t));
    const v = view(6, { userSplit: { feature: 0, threshold: max } });
    layer.update(v, 0);
    expect(all(host, '.card')[0]).toBe(first); // same element: the drag never rebuilds the cards
    expect(text(first.querySelector('h3.card-title'))).toBe(`Senin eşiğin: Sözleşme ≤ ${max}`);
    expect(all(first, '.branch-count').map(text)[1]).toBe('0 müşteri');
    expect(text(host.querySelector('p.formula'))).toBe(v.strip);
  });

  it('rapid updates cancel running fills and end in the final state', async () => {
    const { host, layer } = setup();
    layer.update(view(1, { shown: 0 }), 0);
    layer.update(view(2, { shown: 1 }), 40); // Hava starts filling...
    layer.update(view(1, { shown: 0 }), 0); // ...and is sent back at once
    await new Promise((r) => setTimeout(r, 150));
    const fills = all(host, '.card .fill');
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((f) => parseFloat(f.style.width) === 0)).toBe(true);
  });

  it('destroy removes the layer', () => {
    const { host, layer } = setup();
    layer.update(view(2, { shown: 1 }), 0);
    layer.destroy();
    expect(host.querySelector('.cards-layer')).toBeNull();
  });

  it('card and strip text sizes are never below the body token', () => {
    const css = fs.readFileSync('src/concepts/karar-agaci/karar-agaci.css', 'utf8');
    // only the cards layer's rules (the file also holds the rest of the page's styles)
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => m[1].includes('.cards-layer'));
    const sizes = rules.flatMap((m) => [...m[2].matchAll(/font-size:\s*([^;]+);/g)].map((s) => s[1].trim()));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((s) => s === 'var(--fs-body)' || s === 'var(--fs-title)')).toBe(true);
  });
});
