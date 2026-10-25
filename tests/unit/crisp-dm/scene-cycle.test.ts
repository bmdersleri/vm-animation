// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPercent } from '../../../src/core/plot/format';
import { labelBox, overlap, type Anchor, type Box } from '../../../src/core/plot/label-place';
import { META, cellOf } from '../../../src/concepts/crisp-dm/data';
import { go, num, setup, texts } from './harness';

afterEach(() => {
  vi.unstubAllGlobals();
});

const edgeClasses = (el: Element, id: string): string => el.querySelector(`path.flow-edge[data-edge="${id}"]`)!.getAttribute('class')!;
const point = (t: string): [number, number] => {
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(t)!;
  return [Number(m[1]), Number(m[2])];
};
const current = (el: Element): string | undefined => el.querySelector('.flow-node.is-current')?.getAttribute('data-node') ?? undefined;

describe('cycle scene', () => {
  it('step 1 draws six phases and two decisions', () => {
    const { el, player } = setup();
    go(player, 'sorun');
    expect(el.querySelectorAll('.flow-node')).toHaveLength(8);
    expect(el.querySelectorAll('.flow-node[data-kind="phase"]')).toHaveLength(6);
    expect(el.querySelectorAll('.flow-node[data-kind="decision"]')).toHaveLength(2);
    expect(current(el)).toBe('ia');
    expect(el.querySelectorAll('circle.flow-token')).toHaveLength(1);
    expect(texts(el, '.flow-node[data-node="ya"] tspan').join('')).toBe('Yaygınlaştırma');
    expect(el.querySelector('.crisp-stage')!.getAttribute('data-step')).toBe('sorun');
  });

  it('step 4 sends the project back from the first decision', () => {
    const { el, player } = setup();
    go(player, 'veri-yeterli', false);
    player.setParams({ scan: 2 });
    expect(edgeClasses(el, 'd1-ia')).toContain('is-path');
    expect(edgeClasses(el, 'd1-ia')).toContain('kind-back');
    expect(current(el)).toBe('ia');
  });

  it('step 8 evaluation goes back to data understanding', () => {
    const { el, player } = setup();
    go(player, 'degerlendirme');
    expect(edgeClasses(el, 'd2-va')).toContain('is-path');
    expect(current(el)).toBe('va');
  });

  it('step 9 second tour reaches deployment and loops back', () => {
    const { el, player } = setup();
    go(player, 'ikinci-tur', false);
    player.setParams({ scan: 6 });
    expect(current(el)).toBe('ya');
    expect(edgeClasses(el, 'd2-ya')).toContain('is-path');
    player.setParams({ scan: 7 });
    expect(current(el)).toBe('ia');
    expect(edgeClasses(el, 'ya-ia')).toContain('is-path');
    expect(edgeClasses(el, 'ya-ia')).toContain('kind-outer');
  });

  it('step 10 draws the plain cycle: no current node, no token', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    expect(el.querySelectorAll('.flow-node')).toHaveLength(8);
    expect(current(el)).toBeUndefined();
    expect(el.querySelectorAll('circle.flow-token')).toHaveLength(0);
  });

  it('reduced motion puts the token on its node at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { el, player } = setup();
    go(player, 'veri-anlama');
    // the token rests on the node's upper right corner, away from the label text
    const [nx, ny] = point(el.querySelector('.flow-node[data-node="va"]')!.getAttribute('transform')!);
    const shape = el.querySelector('.flow-node[data-node="va"] .flow-shape')!;
    const [tx, ty] = point(el.querySelector('circle.flow-token')!.getAttribute('transform')!);
    expect(tx).toBeCloseTo(nx + Number(shape.getAttribute('width')) / 2, 1);
    expect(ty).toBeCloseTo(ny - Number(shape.getAttribute('height')) / 2, 1);
    // a sweep step lands on its last value when entered
    go(player, 'veri-yeterli', false);
    expect(player.state.params.scan).toBe(4);
    expect(current(el)).toBe('d1');
  });

  it('the Lab reason line names the failed decision with numbers from the data', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'veri-yeterli');
    player.setParams({ days: 14 });
    const short = cellOf(14, 'cikar', 'soran', false);
    const r = el.querySelector('.path-reason')!;
    expect(r.textContent).toBe(`Veri yeterli mi? Hayır: sınav günü ${short.usable.sinav} < ${META.minGroup}`);
    expect(r.getAttribute('data-node')).toBe('d1');
    expect(current(el)).toBe('d1');
    player.setParams({ days: 56, missing: 'cikar', stock: 'satis' });
    const lost = cellOf(56, 'cikar', 'satis', false).eval.lostShare!;
    expect(el.querySelector('.path-reason')!.textContent).toBe(
      `Sonuç uygun mu? Hayır: kaçan talep ${formatPercent(lost)} > ${formatPercent(META.criteria.service, 0)}`,
    );
    expect(el.querySelector('.path-reason')!.getAttribute('data-node')).toBe('d2');
    player.setParams({ stock: 'soran' });
    expect(el.querySelector('.path-reason')).toBeNull();
  });

  it('Ders draws no reason line', () => {
    const { el, player } = setup();
    go(player, 'degerlendirme');
    expect(el.querySelector('.path-reason')).toBeNull();
  });

  /** Boxes of the drawn nodes (a rhombus: its bounding box), from the DOM. */
  const nodeBoxes = (el: Element): Box[] => [...el.querySelectorAll('.flow-node')].map((n) => {
    const [x, y] = point(n.getAttribute('transform')!);
    const shape = n.querySelector('.flow-shape')!;
    const d = shape.getAttribute('d') ?? '';
    const rect = shape.tagName === 'rect';
    const hw = rect ? num(shape, 'width') / 2 : Math.max(...[...d.matchAll(/(-?[\d.]+),0/g)].map((m) => Math.abs(Number(m[1]))));
    const hh = rect ? num(shape, 'height') / 2 : Math.abs(Number(/M0,(-?[\d.]+)/.exec(d)![1]));
    return { l: x - hw, t: y - hh, r: x + hw, b: y + hh };
  });

  /** The reason box as the scene placed it: `left` / `top` are its centre (the CSS translates it by half its size). */
  const reasonBox = (r: HTMLElement): Box => {
    const w = parseFloat(r.style.width);
    const h = parseFloat(r.style.height);
    const x = parseFloat(r.style.left);
    const y = parseFloat(r.style.top);
    return { l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 };
  };

  const ENDS = [
    ['yetersiz', { days: 4 as const }, 'd1'],
    ['uygun-degil', { stock: 'satis' as const }, 'd2'],
    ['sahada-dustu', { leak: true }, 'ya'],
  ] as const;

  // the Lab stage of a 1280 x 720 and a 1280 x 740 window, a phone, and a wide Lab stage
  for (const [w, h] of [[745, 530], [745, 550], [390, 520], [1280, 540]] as const) {
    it(`the Lab reason box keeps clear of the edge labels and the nodes at ${w} x ${h}`, () => {
      // jsdom has no theme: give the cycle text the sizes the CSS gives it in the Lab (a narrow stage: --fs-cell)
      const style = document.createElement('style');
      style.textContent = '.flow-label, .flow-edge-label { font-size:13px; } .crisp-stage[data-narrow] .flow-label, .crisp-stage[data-narrow] .flow-edge-label { font-size:12px; }';
      document.head.append(style);
      const { el, player } = setup(w, h, 'lab');
      const fs = w < 900 ? 12 : 13;
      const svg = el.querySelector('svg.crisp-cycle')!;
      for (const id of ['veri-yeterli', 'degerlendirme', 'ikinci-tur']) {
        for (const [end, over, node] of ENDS) {
          go(player, id);
          player.setParams({ days: 56, missing: 'cikar', stock: 'soran', leak: false, ...over });
          const name = `${id} ${end}`;
          const r = el.querySelector<HTMLElement>('.path-reason')!;
          expect(r.getAttribute('data-node'), name).toBe(node);
          const box = reasonBox(r);
          // the grid row holds the whole cycle: a phone's cycle grows by the reason band, a stacked or wide one keeps its height
          const stage = el.querySelector<HTMLElement>('.crisp-stage')!;
          expect(parseFloat(stage.style.getPropertyValue('--cycle-h')), name).toBe(num(svg, 'height'));
          if (w === 390) {
            expect(num(svg, 'height'), name).toBeGreaterThan(340);
            expect(box.t, `${name} band under the cycle`).toBeGreaterThanOrEqual(340);
          } else {
            expect(num(svg, 'height'), name).toBeLessThanOrEqual(h);
          }
          // inside the cycle's svg
          expect(box.l, name).toBeGreaterThanOrEqual(0);
          expect(box.t, name).toBeGreaterThanOrEqual(0);
          expect(box.r, name).toBeLessThanOrEqual(num(svg, 'width'));
          expect(box.b, name).toBeLessThanOrEqual(num(svg, 'height'));
          // every line of the reason fits the box (jsdom measures 0.62 em per character at the 13 px tick size)
          for (const line of texts(r, '.reason-line')) {
            expect(line.trim().length * 13 * 0.62 + 20, `${name} "${line}"`).toBeLessThanOrEqual(box.r - box.l);
          }
          expect(texts(r, '.reason-line').length * 13 * 1.3 + 12, name).toBeLessThanOrEqual(box.b - box.t + 0.5);
          const nodes = nodeBoxes(el);
          for (const n of nodes) {
            expect(overlap(box, n), `${name} node`).toBe(0);
            expect(n.t, `${name} node inside`).toBeGreaterThanOrEqual(0);
          }
          // the cycle may move up to make room for the box: its nodes still keep apart
          for (let i = 0; i < nodes.length; i += 1) {
            for (let j = i + 1; j < nodes.length; j += 1) {
              expect(overlap(nodes[i], nodes[j]), `${name} nodes ${i} / ${j}`).toBe(0);
            }
          }
          for (const t of el.querySelectorAll('text.flow-edge-label')) {
            const lb = labelBox(num(t, 'x'), num(t, 'y'), (t.textContent ?? '').length, t.getAttribute('text-anchor') as Anchor, fs);
            expect(overlap(box, { l: lb.l + 0.5, t: lb.t + 0.5, r: lb.r - 0.5, b: lb.b - 0.5 }), `${name} label ${t.getAttribute('data-edge')}`).toBe(0);
          }
        }
      }
      style.remove();
    });
  }
});
