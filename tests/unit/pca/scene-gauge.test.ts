// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach } from 'vitest';
import { GaugeLayer } from '../../../src/concepts/pca/scene-gauge';
import { derivePcaView, type SideView } from '../../../src/concepts/pca/view';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';

const SVGNS = 'http://www.w3.org/2000/svg';
const RECT = { left: 640, top: 10, width: 560, height: 520 };
const side = (i: number, over: Partial<PcaParams> = {}): SideView =>
  derivePcaView(i, { ...pcaScenario.defaults, ...pcaScenario.steps[i].params, ...over }).scatter!.side!;

let made: { svg: SVGSVGElement; layer: GaugeLayer }[] = [];
function setup(ds = 0): { svg: SVGSVGElement; layer: GaugeLayer } {
  const svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  document.body.append(svg);
  const layer = new GaugeLayer(svg, ds);
  layer.layout(RECT, 'ders');
  const m = { svg, layer };
  made.push(m);
  return m;
}
afterEach(() => { made.forEach((m) => { m.layer.destroy(); m.svg.remove(); }); made = []; });

const q = (svg: Element, sel: string): SVGElement => svg.querySelector<SVGElement>(sel)!;
const all = (svg: Element, sel: string): SVGElement[] => [...svg.querySelectorAll<SVGElement>(sel)];
const cmds = (d: string): number => (d.match(/[ML]/g) ?? []).length;
const visible = (el: Element): boolean => el.getAttribute('display') !== 'none' && el.getAttribute('opacity') !== '0';

describe('pca GaugeLayer', () => {
  it('gauge label and bar height follow the value', () => {
    const { svg, layer } = setup();
    layer.update(side(1), 0);
    expect(q(svg, 'text.gauge-label').textContent).toBe('varyans 1,00');
    const h1 = Number(q(svg, 'rect.gauge-bar').getAttribute('height'));
    expect(Number(q(svg, 'rect.gauge-bar').getAttribute('data-value'))).toBeCloseTo(1, 2);
    layer.update(side(2, { theta: 45 }), 0);
    expect(q(svg, 'text.gauge-label').textContent).toBe('varyans 1,83');
    const h2 = Number(q(svg, 'rect.gauge-bar').getAttribute('height'));
    expect(h2 / h1).toBeGreaterThan(1.82 / 1.0);
    expect(h2 / h1).toBeLessThan(1.84 / 1.0);
    const track = q(svg, 'rect.gauge-track');
    expect(Number(track.getAttribute('height'))).toBeGreaterThan(h2);
  });

  it('curve upTo grows with the sweep', () => {
    const { svg, layer } = setup();
    layer.update(side(2, { theta: 30 }), 0);
    const c30 = q(svg, 'path.var-curve');
    expect(c30.getAttribute('data-upto')).toBe('30');
    const n30 = cmds(c30.getAttribute('d')!);
    expect(q(svg, 'circle.var-marker').getAttribute('data-theta')).toBe('30');
    expect(visible(q(svg, 'text.var-peak'))).toBe(false);
    layer.update(side(2, { theta: 90 }), 0);
    expect(q(svg, 'path.var-curve').getAttribute('data-upto')).toBe('90');
    expect(cmds(q(svg, 'path.var-curve').getAttribute('d')!)).toBeGreaterThan(n30);
    expect(visible(q(svg, 'text.var-peak'))).toBe(false);
    layer.update(side(2, { theta: 180 }), 0);
    const peak = q(svg, 'text.var-peak');
    expect(visible(peak)).toBe(true);
    expect(peak.textContent).toBe('en büyük: θ = 45°');
    expect(peak.getAttribute('data-peak')).toBe('45');
  });

  it('axes: degree ticks, titles, and the curve is hidden before it starts', () => {
    const { svg, layer } = setup();
    layer.update(side(1), 0);
    expect(visible(q(svg, 'path.var-curve'))).toBe(false);
    const xt = all(svg, 'g.var-axis.x g.tick text').map((t) => t.textContent);
    expect(xt).toEqual(['0°', '45°', '90°', '135°', '180°']);
    expect(q(svg, 'text.var-axis-title.x').textContent).toBe('θ (derece)');
    expect(q(svg, 'text.var-axis-title.y').textContent).toBe('izdüşüm varyansı');
  });

  it('×1000 rescales gauge and curve; ticks use thousands separators', () => {
    const { svg, layer } = setup();
    layer.update(side(7), 0);
    expect(q(svg, 'text.var-peak').textContent).toBe('en büyük: θ = 90°');
    expect(q(svg, 'text.gauge-label').textContent).toBe('varyans 1.002.005');
    const yt = all(svg, 'g.var-axis.y g.tick text').map((t) => t.textContent!);
    expect(yt.some((t) => t.includes('.'))).toBe(true);
    const texts = all(svg, 'text').map((t) => t.textContent!);
    expect(texts.some((t) => t.includes('NaN'))).toBe(false);
    expect(svg.innerHTML).not.toContain('NaN');
  });

  it('animated rescale between ×1 and ×1000 ends on the final state', async () => {
    const { svg, layer } = setup(0.02);
    layer.update(side(3), 0);
    layer.update(side(7), 1);
    await new Promise((r) => setTimeout(r, 120));
    expect(q(svg, 'text.gauge-label').textContent).toBe('varyans 1.002.005');
    expect(svg.innerHTML).not.toContain('NaN');
    const bar = Number(q(svg, 'rect.gauge-bar').getAttribute('height'));
    expect(bar).toBeGreaterThan(0);
  });

  it('hidden when side is null', () => {
    const { svg, layer } = setup();
    layer.update(side(1), 0);
    layer.update(null, 0);
    expect(q(svg, 'g.pca-gauge').style.display).toBe('none');
  });
});
