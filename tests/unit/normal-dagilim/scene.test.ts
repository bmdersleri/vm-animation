// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { normalScenario } from '../../../src/concepts/normal-dagilim/scenario';
import { mountNormalScene } from '../../../src/concepts/normal-dagilim/scene';
import { deriveNormalView } from '../../../src/concepts/normal-dagilim/view';

const clean: (() => void)[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup() {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(normalScenario);
  const scene = mountNormalScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(1280, 540);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player, scene };
}

/** Ghost labels of the current scene, each checked to sit 4px above its own curve, 6px off the anchor point. */
function ghostLabels(el: HTMLElement) {
  const svg = el.querySelector('svg')!;
  const w = Number(svg.getAttribute('width'));
  const paths = [...el.querySelectorAll('path.ghost')].map((p) =>
    p
      .getAttribute('d')!
      .slice(1)
      .split('L')
      .map((pt) => pt.split(',').map(Number)),
  );
  const labels = [...el.querySelectorAll('text.ghost-label')];
  expect(labels).toHaveLength(2);
  return labels.map((label, i) => {
    const tspan = label.querySelector('tspan')!;
    const x = Number(tspan.getAttribute('x'));
    const y = Number(tspan.getAttribute('y'));
    const anchor = label.getAttribute('text-anchor')!;
    const anchorX = anchor === 'start' ? x - 6 : x + 6;
    // Curve height at anchorX, interpolated between its two neighbouring samples.
    const pts = paths[i];
    const j = pts.findIndex((pt) => pt[0] >= anchorX);
    expect(j).toBeGreaterThan(0);
    const [[x0, y0], [x1, y1]] = [pts[j - 1], pts[j]];
    const curveY = y0 + ((y1 - y0) * (anchorX - x0)) / (x1 - x0 || 1);
    expect(Math.abs(y + 4 - curveY)).toBeLessThan(1);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(w);
    return { sigma: Number(label.textContent!.replace('σ = ', '')), anchor };
  });
}

describe('normal scene', () => {
  it('step 1 draws one bar sub-path per bin', () => {
    const { el, player } = setup();
    const d = el.querySelector('path.hist-bar')!.getAttribute('d')!;
    expect(d.match(/Z/g)).toHaveLength(deriveNormalView(0, player.state.params).bins.length);
    expect(el.querySelectorAll('.mark')).toHaveLength(2);
    expect(el.querySelector('svg')!.getAttribute('viewBox')).toBeNull();
  });

  it('step 2 draws curve', () => {
    const { el, player } = setup();
    player.goto(1);
    expect(el.querySelector('path.curve')!.getAttribute('d')).toMatch(/^M/);
    expect(el.querySelector('svg')!.getAttribute('data-view')).toBe('egri');
  });

  it('step 3 draws two labelled ghost curves', () => {
    const { el, player } = setup();
    player.goto(2);
    expect(el.querySelectorAll('path.ghost')).toHaveLength(2);
    expect(el.textContent).toContain('σ = 5');
    expect(el.textContent).toContain('σ = 15');
  });

  it('ghost labels sit on their own curves', () => {
    const { el, player, scene } = setup();
    player.goto(2);
    expect(ghostLabels(el).map((g) => [g.sigma, g.anchor])).toEqual([
      [5, 'start'],
      [15, 'start'],
    ]);
    // Near the right edge the labels move to the mirrored left flank; near the left edge they stay right.
    player.setParams({ mu: 110 });
    expect(ghostLabels(el).map((g) => g.anchor)).toEqual(['end', 'end']);
    player.setParams({ mu: 30 });
    expect(ghostLabels(el).map((g) => g.anchor)).toEqual(['start', 'start']);
    // A narrow, tall main curve and a phone-width scene keep every label on its curve too.
    player.setParams({ mu: 70, sigma: 3 });
    ghostLabels(el);
    scene.resize(390, 540);
    player.setParams({ mu: 70, sigma: 10 });
    ghostLabels(el);
  });

  it('ghost labels keep finite positions in a scene too short for the label lane', () => {
    // The Ders theme's 18 px ticks (jsdom reports 16 px) leave no room between the mark lane and the axis.
    const real = window.getComputedStyle.bind(window);
    vi.stubGlobal('getComputedStyle', (e: Element) => {
      const style = real(e);
      return new Proxy(style, {
        get: (t, k) => {
          if (k === 'fontSize') return '18px';
          const v: unknown = Reflect.get(t, k, t);
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    });
    const { el, player, scene } = setup();
    player.goto(2);
    scene.resize(1280, 200);
    const spans = [...el.querySelectorAll('text.ghost-label tspan')];
    expect(spans).toHaveLength(2);
    for (const t of spans) {
      expect(Number.isFinite(Number(t.getAttribute('x')))).toBe(true);
      expect(Number.isFinite(Number(t.getAttribute('y')))).toBe(true);
    }
  });

  it('step 4 shades area', () => {
    const { el, player } = setup();
    player.goto(3);
    expect(el.querySelector('path.area')!.getAttribute('d')).toMatch(/Z$/);
    player.setParam('a', 80);
    player.setParam('b', 80);
    expect(el.querySelector('path.area')!.getAttribute('d')).toBe('');
  });

  it('step 5 draws three bands labels', () => {
    const { el, player } = setup();
    player.goto(4);
    expect(el.querySelectorAll('path.band')).toHaveLength(3);
    for (const k of [1, 2, 3]) expect(el.querySelector(`.band-label.k${k}`)!.textContent).toContain(`±${k}σ`);
  });

  it('step 6 marks 85 and aligns z axis', () => {
    const { el, player } = setup();
    player.goto(5);
    expect(el.querySelector('line.marker')).not.toBeNull();
    expect(el.querySelector('.marker-label')!.textContent).toContain('85');
    expect(el.querySelectorAll('.z-axis .tick')).toHaveLength(7);
    const titleY = Number(el.querySelector('.z-axis .axis-title')!.getAttribute('y'));
    const tickY = Number(el.querySelector('.z-axis .tick text')!.getAttribute('y'));
    expect(titleY - tickY).toBeGreaterThanOrEqual(27);
  });

  it('step 7 highlights one-sigma and separates mean median', () => {
    const { el, player } = setup();
    player.goto(6);
    expect(el.querySelector('path.band.k1')!.classList.contains('selected')).toBe(true);
    expect(el.querySelectorAll('path.band')).toHaveLength(1);
    expect(el.querySelectorAll('.mark')).toHaveLength(2);
    expect(el.querySelector('.mark.mean')!.getAttribute('transform')).not.toBe(
      el.querySelector('.mark.median')!.getAttribute('transform'),
    );
  });

  it('step 8 uses one z axis and three links, and standardizes mean to zero without signed zero', () => {
    const { el, player } = setup();
    player.goto(7);
    expect(el.querySelectorAll('.number-line')).toHaveLength(1);
    expect(el.querySelectorAll('a.scene-link')).toHaveLength(3);
    expect(el.textContent).toContain('StandardScaler');
    const sinavLabel = el.querySelector('.mark.mean .mark-label')!.textContent!;
    expect(sinavLabel).toBe('ortalama 0');
    expect(sinavLabel).not.toContain('−0');
    expect(sinavLabel).not.toContain('-0');
    player.setParam('seri', 'cagri');
    const cagriLabel = el.querySelector('.mark.mean .mark-label')!.textContent!;
    expect(cagriLabel).toBe('ortalama 0');
    expect(cagriLabel).not.toContain('−0');
    expect(cagriLabel).not.toContain('-0');
  });

  it('parameter changes render instantly with full opacity even when animation is enabled', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(normalScenario);
    const scene = mountNormalScene(el, player, 'ders');
    clean.push(() => {
      scene.destroy();
      player.destroy();
    });
    scene.resize(1280, 540);
    player.goto(2);
    await new Promise((r) => setTimeout(r, 500));
    expect(el.querySelector('.density-layer')!.getAttribute('opacity')).toBe('1');
    const oldD = el.querySelector('path.curve')!.getAttribute('d');
    player.setParam('sigma', 18);
    await new Promise((r) => setTimeout(r, 20));
    expect(el.querySelector('path.curve')!.getAttribute('d')).not.toBe(oldD);
    expect(el.querySelector('.density-layer')!.getAttribute('opacity')).toBe('1');
  });

  it('Lab renders only the selected band', () => {
    const { el, player, scene } = setup();
    player.goto(4);
    scene.setMode('lab');
    player.setParam('k', 3);
    expect(el.querySelectorAll('path.band')).toHaveLength(1);
    expect(el.querySelector('path.band.k3')).not.toBeNull();
  });

  it('reduced motion commits final geometry immediately', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(normalScenario);
    const scene = mountNormalScene(el, player, 'ders');
    clean.push(() => {
      scene.destroy();
      player.destroy();
    });
    scene.resize(900, 390);
    player.goto(7);
    expect(el.querySelector('svg')!.getAttribute('data-view')).toBe('olcekleme');
    expect(el.querySelector('.density-layer')!.getAttribute('opacity')).toBe('1');
  });

  it('coalesces rapid animated steps and interrupts final state', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(normalScenario);
    const scene = mountNormalScene(el, player, 'ders', { durationScale: 0.01 });
    clean.push(() => {
      scene.destroy();
      player.destroy();
    });
    scene.resize(900, 390);
    player.goto(2);
    player.goto(7);
    player.goto(5);
    await new Promise((r) => setTimeout(r, 75));
    expect(el.querySelector('svg')!.getAttribute('data-view')).toBe('z-skor');
    expect(el.querySelectorAll('.ghost,.band,.scene-link')).toHaveLength(0);
    expect(el.querySelector('.density-layer')!.getAttribute('opacity')).toBe('1');
  });

  it('parameter updates and rapid steps settle in final state', () => {
    const { el, player, scene } = setup();
    player.goto(2);
    const old = el.querySelector('path.curve')!.getAttribute('d');
    player.setParam('sigma', 20);
    expect(el.querySelector('path.curve')!.getAttribute('d')).not.toBe(old);
    for (const i of [7, 3, 6, 1]) player.goto(i);
    scene.setMode('lab');
    scene.resize(900, 390);
    expect(el.querySelector('svg')!.getAttribute('data-view')).toBe('egri');
    expect(el.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(el.querySelectorAll('.ghost,.band,.scene-link')).toHaveLength(0);
  });
});
