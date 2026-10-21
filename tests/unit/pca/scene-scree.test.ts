// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach } from 'vitest';
import { ScreeLayer } from '../../../src/concepts/pca/scene-scree';
import { derivePcaView, type ScreeView } from '../../../src/concepts/pca/view';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';

const SVGNS = 'http://www.w3.org/2000/svg';
const RECT = { left: 0, top: 0, width: 1200, height: 520 };
const scree = (i: number, over: Partial<PcaParams> = {}): ScreeView =>
  derivePcaView(i, { ...pcaScenario.defaults, ...pcaScenario.steps[i].params, ...over }).scree!;

let made: { svg: SVGSVGElement; layer: ScreeLayer }[] = [];
function setup(ds = 0): { svg: SVGSVGElement; layer: ScreeLayer } {
  const svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  document.body.append(svg);
  const layer = new ScreeLayer(svg, ds);
  layer.layout(RECT, 'ders');
  const m = { svg, layer };
  made.push(m);
  return m;
}
afterEach(() => { made.forEach((m) => { m.layer.destroy(); m.svg.remove(); }); made = []; });

const q = (svg: Element, sel: string): SVGElement => svg.querySelector<SVGElement>(sel)!;
const all = (svg: Element, sel: string): SVGElement[] => [...svg.querySelectorAll<SVGElement>(sel)];
const visible = (el: Element): boolean => el.getAttribute('display') !== 'none' && el.getAttribute('opacity') !== '0';
const num = (el: Element, a: string): number => Number(el.getAttribute(a));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('pca ScreeLayer', () => {
  it('step 9: twelve bars with labels', () => {
    const { svg, layer } = setup();
    layer.update(scree(8), 0);
    expect(all(svg, 'rect.bar')).toHaveLength(12);
    const labels = all(svg, 'text.bar-label').map((t) => t.textContent);
    expect(labels).toHaveLength(12);
    expect(labels[0]).toBe('%44,1');
    expect(labels[3]).toBe('%2,0');
    expect(all(svg, 'rect.bar.kept')).toHaveLength(0);
    expect(visible(q(svg, 'path.cum-line'))).toBe(false);
    expect(visible(q(svg, 'line.threshold'))).toBe(false);
    expect(all(svg, 'g.scree g.x-axis g.tick text').map((t) => t.textContent)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)));
    expect(q(svg, 'text.scree-title.x').textContent).toBe('Bileşen');
    expect(q(svg, 'text.scree-title.y').textContent).toBe('Açıklanan varyans oranı');
    const yt = all(svg, 'g.y-axis g.tick text').map((t) => t.textContent);
    expect(yt[0]).toBe('%0');
    expect(yt[yt.length - 1]).toBe('%100');
  });

  it('bar labels sit 12 px above the bar tops', () => {
    const { svg, layer } = setup();
    layer.update(scree(8), 0);
    const bar = q(svg, 'rect.bar');
    expect(num(q(svg, 'text.bar-label'), 'y')).toBeCloseTo(num(bar, 'y') - 12, 0);
  });

  it('step 10: cumulative line, dashed threshold, three kept bars', () => {
    const { svg, layer } = setup();
    layer.update(scree(9), 0);
    expect(q(svg, 'g.scree').getAttribute('data-k')).toBe('3');
    expect(all(svg, 'rect.bar.kept')).toHaveLength(3);
    expect(all(svg, 'rect.bar.kept').map((r) => r.getAttribute('data-i'))).toEqual(['0', '1', '2']);
    expect(visible(q(svg, 'path.cum-line'))).toBe(true);
    expect(all(svg, 'circle.cum-pt')).toHaveLength(12);
    const th = q(svg, 'line.threshold[data-t="90"]');
    expect(th.getAttribute('stroke-dasharray')).toBeTruthy();
    const tick90 = all(svg, 'g.y-axis g.tick').find((g) => g.querySelector('text')!.textContent === '%90')!;
    const ty = /translate\(0,([-\d.]+)\)/.exec(tick90.getAttribute('transform')!)![1];
    expect(num(th, 'y1')).toBeCloseTo(Number(ty), 5);
    expect(num(th, 'y2')).toBeCloseTo(Number(ty), 5);
    expect(q(svg, 'text.cum-label').textContent).toBe('%93,8');
    expect(q(svg, 'text.threshold-label').textContent).toBe('%90 eşik');
  });

  it('threshold 50 and 99', () => {
    const { svg, layer } = setup();
    layer.update(scree(9, { threshold: 50 }), 0);
    expect(q(svg, 'g.scree').getAttribute('data-k')).toBe('2');
    expect(all(svg, 'rect.bar.kept')).toHaveLength(2);
    layer.update(scree(9, { threshold: 99 }), 0);
    expect(q(svg, 'g.scree').getAttribute('data-k')).toBe('9');
    expect(all(svg, 'rect.bar.kept')).toHaveLength(9);
    expect(q(svg, 'line.threshold').getAttribute('data-t')).toBe('99');
  });

  it('labels never overlap', () => {
    const { svg, layer } = setup();
    for (let t = 50; t <= 99; t++) {
      layer.update(scree(9, { threshold: t }), 0);
      const boxes = all(svg, 'text.bar-label, text.cum-label, text.threshold-label').map((el) => {
        const w = el.textContent!.length * 18 * 0.62; // jsdom: TextMeasure estimate
        const x = num(el, 'x');
        const a = el.getAttribute('text-anchor');
        const l = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x;
        return { l, r: l + w, y: num(el, 'y'), t };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (Math.abs(boxes[i].y - boxes[j].y) > 0.01) continue;
          expect(boxes[i].r <= boxes[j].l || boxes[j].r <= boxes[i].l, `threshold ${t}`).toBe(true);
        }
      }
    }
  });

  it('bars grow and the line draws with real durations, then snap on interrupt', async () => {
    const { svg, layer } = setup(0.05);
    layer.update(scree(9), 100);
    layer.interrupt();
    const bar = q(svg, 'rect.bar');
    expect(num(bar, 'height')).toBeGreaterThan(50);
    expect(q(svg, 'path.cum-line').getAttribute('d')!.match(/[ML]/g)).toHaveLength(12);
    await sleep(60);
    expect(num(q(svg, 'rect.bar'), 'height')).toBeGreaterThan(50);
  });
});
