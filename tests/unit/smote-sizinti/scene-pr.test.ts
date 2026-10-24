// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { labelBox, overlap, type Box } from '../../../src/core/plot/label-place';
import { BODY_FALLBACK } from '../../../src/core/plot/text-measure';
import { concepts } from '../../../src/concepts/registry';
import { COMPARE, KOD05, LEAK } from '../../../src/concepts/dengesiz/data';
import { matchCaught, positiveRate, staircase } from '../../../src/concepts/smote-sizinti/model';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';
import { PrScene } from '../../../src/concepts/smote-sizinti/scene-pr';
import { deriveLeakView } from '../../../src/concepts/smote-sizinti/view';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLeakScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const num = (e: Element, a: string) => Number(e.getAttribute(a));
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(sel)].map((t) => t.textContent);

/** Boxes of the plot's text labels (width from the character count at jsdom's 16 px). */
function labelBoxes(el: HTMLElement): { name: string; box: Box }[] {
  const out: { name: string; box: Box }[] = [];
  for (const t of el.querySelectorAll('text.lc-pin-label, text.legend-label, text.score-name, text.score-big, text.score-book')) {
    // jsdom resolves every font to its 16 px default (no theme CSS), so tick and title sizes are equal here
    out.push({
      name: t.textContent!,
      box: labelBox(num(t, 'x'), num(t, 'y'), t.textContent!.length * 0.88, t.getAttribute('text-anchor') as 'start', 16),
    });
  }
  return out;
}

/** The step-8 link text: the Bölüm 6 page title, as page 1 names it. */
const THRESHOLD_TEXT = `Bölüm 6: ${concepts.find((c) => c.id === 'roc-esik')!.title}`;

/** The strip height the scene host takes from the stage when no layout is available (one strip line). */
const stripH = (mode: Mode): number => Math.ceil(BODY_FALLBACK[mode] * 1.35 + 12 + 10);

/** Tick, axis and title sizes (px) of the theme at 390 px. */
const FONTS_390: Record<Mode, [number, number, number]> = { lab: [13, 14, 22], ders: [18, 18, 32] };

const sameCaught = () => matchCaught(COMPARE.base.scores, KOD05.matrix.tp);

/**
 * Draws step 8 straight into a PR scene of 390 px × `h` px (the area the stage leaves above the strip) and
 * returns the SVG height, the chart height and the lowest panel text (baseline plus descender).
 */
function narrowPanel(mode: Mode, h: number): { svg: number; chartH: number; h: number; last: { text: string; bottom: number } } {
  // the theme's type sizes at 390 px (theme.css: Lab 13/14/22, Ders clamped to 18/18/32), read by the measurer's probe
  const [tick, axis, title] = FONTS_390[mode];
  const style = document.createElement('style');
  style.textContent = `.probe.tick { font-size:${tick}px } .probe.axis-title { font-size:${axis}px } .probe.prediction { font-size:${title}px }`;
  document.head.append(style);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = new PrScene(host);
  clean.push(() => {
    scene.destroy();
    style.remove();
  });
  scene.resize(390, h, mode);
  scene.update(deriveLeakView(stepIndex(sc, 'esik'), sc.defaults), 0);
  const svg = host.querySelector('svg')!;
  const all = [...svg.querySelectorAll('text.panel-line, text.panel-link')];
  const lowest = all.reduce((a, t) => (num(t, 'y') > num(a, 'y') ? t : a));
  const tahmin = svg.querySelector('text.matrix-title')!;
  return {
    svg: num(svg, 'height'),
    // the panel starts at the chart's bottom; its "tahmin" title sits one axis size lower
    chartH: num(tahmin, 'y') - axis,
    h,
    last: { text: lowest.textContent!, bottom: num(lowest, 'y') + tick * 0.35 },
  };
}

describe('PR scene', () => {
  it('step 4 draws two curves with dashed baselines at the positive rates', () => {
    const { el, player } = setup();
    go(player, 'pr-taban');
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('pr');
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(2);
    const lines = [...el.querySelectorAll('line.baseline')];
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.getAttribute('stroke-dasharray')).toBeTruthy();
    }
    expect(texts(el, 'text.lc-pin-label')).toEqual(['sızıntılı', 'sızıntısız', 'taban 0,470', 'taban 0,062']);
    const frame = el.querySelector('.leak-pr-host rect.frame')!;
    const top = num(frame, 'y');
    const height = num(frame, 'height');
    const run = LEAK.bySeed[0];
    const want = [positiveRate(run.leaky.scores), positiveRate(run.honest.scores)];
    lines.forEach((l, i) => {
      expect(num(l, 'y1')).toBeCloseTo(top + height * (1 - want[i]), 0);
    });
    expect(lines[0].getAttribute('class')).toContain('is-leaky');
  });

  it('step 5 shows both scores', () => {
    const { el, player } = setup();
    go(player, 'iki-skor');
    expect(texts(el, 'text.score-big')).toEqual(['0,704', '0,178']);
    expect(texts(el, 'text.score-name')).toEqual(['sızıntılı', 'sızıntısız']);
    expect(texts(el, 'text.score-book')).toEqual(['kitap 0,724 / 0,147']);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['sızıntılı 0,704', 'sızıntısız 0,178', 'taban 0,470', 'taban 0,062']);
  });

  it('curve points start at recall 0 and end at recall 1', () => {
    const sets = [
      ...LEAK.bySeed.flatMap((r) => [r.leaky.scores, r.honest.scores]),
      COMPARE.base.scores,
      COMPARE.smote.scores,
      COMPARE.weighted.scores,
    ];
    for (const s of sets) {
      const st = staircase(s);
      expect(st[0][0]).toBe(0);
      expect(st[st.length - 1][0]).toBe(1);
      for (let i = 1; i < st.length; i++) {
        expect(st[i][0]).toBeGreaterThanOrEqual(st[i - 1][0]);
      }
    }
    const { el, player } = setup();
    go(player, 'pr-taban');
    const frame = el.querySelector('.leak-pr-host rect.frame')!;
    const d = el.querySelector('path.lc-series')!.getAttribute('d')!;
    expect(Number(/^M([\d.]+),/.exec(d)![1])).toBeCloseTo(num(frame, 'x'), 0);
    const last = /([\d.]+),[\d.]+$/.exec(d)!;
    expect(Number(last[1])).toBeCloseTo(num(frame, 'x') + num(frame, 'width'), 0);
  });

  it('the curve names and floor labels do not overlap at 1280 and 390 px', () => {
    for (const [w, h] of [[1280, 540], [390, 520]] as const) {
      for (const id of ['pr-taban', 'iki-skor', 'smote-agirlik']) {
        const { el, player } = setup(w, h);
        go(player, id);
        const boxes = labelBoxes(el);
        expect(boxes.length).toBeGreaterThan(2);
        for (let a = 0; a < boxes.length; a++) {
          for (let b = a + 1; b < boxes.length; b++) {
            expect(overlap(boxes[a].box, boxes[b].box), `${id} ${w}: ${boxes[a].name} / ${boxes[b].name}`).toBe(0);
          }
        }
        for (const { name, box } of boxes) {
          expect(box.l, `${id} ${w}: ${name}`).toBeGreaterThanOrEqual(-1);
          expect(box.r, `${id} ${w}: ${name}`).toBeLessThanOrEqual(w + 1);
        }
        clean.pop()!();
        document.body.replaceChildren();
      }
    }
  });

  it('step 8 at 390 px: the panel fits the Lab stage, its last line included', () => {
    // 439 px is the Lab stage area of smote-sizinti at 390 x 844 in Chrome (stage minus the strip)
    const { svg, last, h } = narrowPanel('lab', 439);
    expect(svg).toBeLessThanOrEqual(h);
    expect(last.bottom).toBeLessThanOrEqual(svg);
    expect(last.text).toBe(THRESHOLD_TEXT);
    const lines = texts(document.body, 'text.panel-line').join(' ');
    expect(lines).toContain(`kesinliği ${f(sameCaught().precision, 3)}.`);
    // a short chart names its curve in the legend, not with a pin on the curve
    expect(texts(document.body, 'text.legend-label')).toEqual([`SMOTE ${f(COMPARE.smote.ap, 3)}`]);
    expect(texts(document.body, 'text.lc-pin-label')).toEqual([`taban ${f(positiveRate(COMPARE.base.scores), 3)}`]);
  });

  it('step 8 at 390 px in Ders: the panel fits a tall stage and stays whole (scrollable) on a short one', () => {
    const tall = narrowPanel('ders', 640);
    expect(tall.svg).toBeLessThanOrEqual(640);
    expect(tall.last.bottom).toBeLessThanOrEqual(tall.svg);
    document.body.replaceChildren();
    const short = narrowPanel('ders', 425);
    // the chart is shrunk before anything scrolls, and nothing is drawn past the drawing's own height
    expect(short.chartH).toBeLessThan(Math.round(425 * 0.58));
    expect(short.last.bottom).toBeLessThanOrEqual(short.svg);
  });

  it('a host taller than the stage shows a bottom shadow that its scrolling cover hides at the end', async () => {
    const { readFileSync } = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const css = readFileSync('src/concepts/smote-sizinti/smote-sizinti.css', 'utf8');
    const rule = /\.leak-host \{\s*background:([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/no-repeat local,/);
    expect(rule![1]).toMatch(/no-repeat scroll;/);
  });

  it('step 8 at 1280 px keeps the panel beside the chart, the link named by the page title', () => {
    const { el, player } = setup();
    go(player, 'esik');
    const svg = el.querySelector<SVGSVGElement>('.leak-pr-host svg')!;
    expect(num(svg, 'height')).toBe(540 - stripH('ders'));
    const link = el.querySelector('a.op-link')!;
    expect(link.getAttribute('href')).toBe('../roc-esik/');
    expect(link.textContent).toBe(THRESHOLD_TEXT);
    expect(num(el.querySelector('text.panel-line')!, 'x')).toBeGreaterThan(640);
  });

  it('text and stroke classes stay apart in the CSS', async () => {
    const { readFileSync } = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const css = readFileSync('src/concepts/smote-sizinti/smote-sizinti.css', 'utf8');
    expect(css).toMatch(/text\.is-leaky \{ fill:/);
    expect(css).toMatch(/line\.baseline \{/);
    expect(css).not.toMatch(/\n\.leak-plot \.baseline \{/);
    const { el, player } = setup();
    go(player, 'pr-taban');
    const floors = [...el.querySelectorAll('text.lc-pin-label')].filter((t) => t.textContent!.startsWith('taban'));
    expect(floors).toHaveLength(2);
    for (const t of floors) {
      expect(t.getAttribute('class')).toMatch(/is-(leaky|honest)/);
      expect(t.getAttribute('class')).not.toContain('baseline');
    }
  });
});
