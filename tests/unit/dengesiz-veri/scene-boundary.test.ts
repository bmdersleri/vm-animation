// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { labelBox, overlap, type Box } from '../../../src/core/plot/label-place';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { MODELS2D } from '../../../src/concepts/dengesiz/data';
import { boundarySegment, METHODS, outsideNote, resultFor } from '../../../src/concepts/dengesiz-veri/boundary';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { mountImbScene } from '../../../src/concepts/dengesiz-veri/scene';
import { deriveImbView } from '../../../src/concepts/dengesiz-veri/view';

/** The page's stylesheet text (vitest's CSS pipeline would return an empty string for `?raw`). */
const cssText = (
  globalThis as unknown as { process: { getBuiltinModule(n: string): { readFileSync(p: string, enc: string): string } } }
).process
  .getBuiltinModule('node:fs')
  .readFileSync('src/concepts/dengesiz-veri/dengesiz-veri.css', 'utf8');

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540, mode: 'ders' | 'lab' = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountImbScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const count = (el: ParentNode, sel: string) => el.querySelectorAll(sel).length;
const num = (e: Element, a: string) => Number(e.getAttribute(a));
const GENERATED = { yok: MODELS2D.base, smote: MODELS2D.smote, agirlik: MODELS2D.weighted } as const;
const dengeli = { ...sc.defaults, weight: 'dengeli' as const };

describe('step 9: decision boundaries', () => {
  it('step 9 draws smote and weighted lines and the outside note for the base model', () => {
    const { el, player } = setup();
    go(player, 'sinir');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('boundary');
    const lines = [...el.querySelectorAll('line.boundary-line')].map((l) => l.getAttribute('data-method'));
    expect(lines.sort()).toEqual(['agirlik', 'smote']);
    const note = el.querySelector('.outside-note')!;
    expect(note.getAttribute('data-method')).toBe('yok');
    expect(note.textContent).toContain("sınır alan dışında: kimse 'ayrılır' denmiyor");
    expect([...el.querySelectorAll('text.boundary-label')].map((t) => t.textContent).sort()).toEqual(['SMOTE', 'ağırlıklı']);
    // the three test matrices
    expect(el.querySelector('.bs-item[data-method="yok"] [data-cell="tp"] .cell-count')!.textContent).toBe('0');
    expect(el.querySelector('.bs-item[data-method="smote"] [data-cell="tp"] .cell-count')!.textContent).toBe('25');
    expect(el.querySelector('.bs-item[data-method="smote"] [data-cell="fp"] .cell-count')!.textContent).toBe('202');
    expect(el.querySelector('.bs-item[data-method="agirlik"] [data-cell="fp"] .cell-count')!.textContent).toBe('205');
    expect(count(el, '.imb-boundary-host circle.pt')).toBe(600);
    // the line styles differ: plain, dashed, dotted
    const css = cssText;
    expect(css).toMatch(/boundary-line\[data-method='yok'\][^}]*stroke:/);
    expect(css).not.toMatch(/boundary-line\[data-method='yok'\][^}]*dasharray/);
    expect(css).toMatch(/boundary-line\[data-method='smote'\][^}]*dasharray:12 7/);
    expect(css).toMatch(/boundary-line\[data-method='agirlik'\][^}]*dasharray:0\.1 8/);
  });

  it('ts models reproduce the generator matrices', () => {
    for (const m of METHODS) {
      const r = resultFor(m.id, dengeli, 0.5);
      expect(r.matrix).toEqual(GENERATED[m.id].matrix);
      expect(Math.abs(r.ap! - GENERATED[m.id].ap)).toBeLessThan(1e-3);
    }
  });

  it('an off-plot boundary shows the outside note', () => {
    expect(boundarySegment({ coef: [0.1, 0.1], intercept: -20 }, 0.5)).toBeNull();
    expect(boundarySegment({ coef: [0, 0], intercept: 1 }, 0.5)).toBeNull();
    expect(boundarySegment({ coef: [0.4, 0.4], intercept: 0 }, 0.5)).not.toBeNull();
    expect(outsideNote({ tn: 563, fp: 0, fn: 37, tp: 0 })).toBe("sınır alan dışında: kimse 'ayrılır' denmiyor");
    expect(outsideNote({ tn: 0, fp: 563, fn: 0, tp: 37 })).toBe("sınır alan dışında: herkese 'ayrılır' deniyor");
    // the base model's line is on the plot at a low threshold: the note goes, the line comes
    const { el, player } = setup();
    go(player, 'sinir');
    expect(count(el, '.outside-note')).toBe(1);
    player.setParams({ threshold: 0.1 });
    expect(count(el, '.outside-note')).toBe(0);
    expect(count(el, 'line.boundary-line')).toBe(3);
  });

  it('every line ends on the plot frame and its label sits clear of the other labels', () => {
    for (const [w, h] of [
      [1280, 540],
      [390, 520],
    ]) {
      const { el, player } = setup(w, h);
      go(player, 'sinir');
      player.setParams({ threshold: 0.1 });
      const frame = el.querySelector('.imb-boundary-host rect.frame')!;
      const fr = { l: num(frame, 'x'), t: num(frame, 'y'), r: num(frame, 'x') + num(frame, 'width'), b: num(frame, 'y') + num(frame, 'height') };
      for (const l of el.querySelectorAll('line.boundary-line')) {
        for (const [x, y] of [
          [num(l, 'x1'), num(l, 'y1')],
          [num(l, 'x2'), num(l, 'y2')],
        ]) {
          expect(x).toBeGreaterThanOrEqual(fr.l - 0.6);
          expect(x).toBeLessThanOrEqual(fr.r + 0.6);
          expect(y).toBeGreaterThanOrEqual(fr.t - 0.6);
          expect(y).toBeLessThanOrEqual(fr.b + 0.6);
        }
      }
      const fs = 18;
      const boxes: Box[] = [...el.querySelectorAll('text.boundary-label')].map((t) =>
        labelBox(num(t, 'x'), num(t, 'y'), t.textContent!.length, t.getAttribute('text-anchor') as 'start', fs),
      );
      expect(boxes).toHaveLength(3);
      boxes.forEach((b, i) => {
        for (let j = i + 1; j < boxes.length; j++) expect(overlap(b, boxes[j])).toBe(0);
        expect(b.l).toBeGreaterThanOrEqual(fr.l - 12);
        expect(b.r).toBeLessThanOrEqual(fr.r + 12);
        expect(b.t).toBeGreaterThanOrEqual(fr.t - 12);
        expect(b.b).toBeLessThanOrEqual(fr.b + 12);
      });
    }
  });

  it('the outside note stays above the plot frame and inside the scatter width', () => {
    const { el, player } = setup(390, 520);
    go(player, 'sinir');
    const frame = el.querySelector('.imb-boundary-host rect.frame')!;
    const note = el.querySelector('.outside-note')!;
    const spans = [...note.querySelectorAll('tspan')];
    expect(spans.length).toBeGreaterThanOrEqual(1);
    const lastBaseline = num(note, 'y') + (spans.length - 1) * (spans.length > 1 ? num(spans[1], 'dy') : 0);
    expect(lastBaseline).toBeLessThan(num(frame, 'y'));
    expect(note.textContent).toContain("sınır alan dışında: kimse 'ayrılır' denmiyor");
    expect(num(el.querySelector('svg.imb-plot:not([style*="none"])')!, 'width')).toBeLessThanOrEqual(390);
  });
});

describe('step 9 and 8 side panels fit the stage', () => {
  it.each([
    ['ders', 1280, 410],
    ['lab', 750, 540],
    ['ders', 900, 380],
  ] as const)('%s %i x %i: the three matrices stack without overlap inside the stage', (mode, w, h) => {
    const { el, player } = setup(w, h, mode);
    go(player, 'sinir');
    const svg = el.querySelector('.imb-boundary-host svg')!;
    const H = num(svg, 'height');
    expect(H).toBeGreaterThan(h - 140);
    const items = [...el.querySelectorAll('.bs-item')].map((item) => {
      const bgs = [...item.querySelectorAll('rect.cell-bg')];
      const top = Math.min(...bgs.map((r) => num(r, 'y')));
      const bottom = Math.max(...bgs.map((r) => num(r, 'y') + num(r, 'height')));
      const name = item.querySelector('.bs-name')!;
      return { top, bottom, nameY: num(name, 'y') };
    });
    expect(items).toHaveLength(3);
    items.forEach((it, i) => {
      expect(it.nameY).toBeLessThan(it.top);
      expect(it.bottom).toBeLessThanOrEqual(H + 1);
      if (i > 0) expect(it.nameY - 20).toBeGreaterThanOrEqual(items[i - 1].bottom - 6);
    });
    // the side panel sits right of the scatter
    const frame = el.querySelector('.imb-boundary-host rect.frame')!;
    const side = el.querySelector('.bs-item rect.cell-bg')!;
    expect(num(frame, 'x') + num(frame, 'width')).toBeLessThanOrEqual(num(side, 'x'));
  });

  it('step 8 side panel keeps the title, bars and note inside the stage', () => {
    const { el, player } = setup(1280, 410);
    go(player, 'agirlik');
    const ys = [...el.querySelectorAll('.imb-weight-host .sp-title, .imb-weight-host .imb-bar, .imb-weight-host .note-line')].map((e) =>
      e.tagName === 'g' ? Number(/translate\([^,]+,([\d.]+)/.exec(e.getAttribute('transform')!)![1]) : num(e, 'y'),
    );
    expect(ys.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...ys)).toBeLessThan(num(el.querySelector('.imb-weight-host svg')!, 'height'));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});

describe('step 9 labels and cells stay apart', () => {
  it.each([
    ['ders', 1280, 540],
    ['lab', 750, 540],
    ['lab', 900, 420],
  ] as const)('%s %i x %i: tag and count of every matrix cell never intersect', (mode, w, h) => {
    const { el, player } = setup(w, h, mode);
    go(player, 'sinir');
    const fs = mode === 'ders' ? 18 : 13;
    for (const cell of el.querySelectorAll('.bs-item [data-cell]')) {
      const tag = cell.querySelector('.cell-tag')!;
      const cnt = cell.querySelector('.cell-count')!;
      const bg = cell.querySelector('.cell-bg')!;
      const tagText = tag.textContent!;
      const cntText = cnt.textContent!;
      const width = (t: string) => t.length * 0.62 * fs;
      const cntX = num(cnt, 'x');
      const cntRight = cnt.getAttribute('text-anchor') === 'end' ? cntX : cntX + width(cntText) / 2;
      const cntLeft = cntRight - width(cntText);
      if (tagText) {
        const tagRight = num(tag, 'x') + width(tagText);
        const sameLine = Math.abs(num(tag, 'y') - num(cnt, 'y')) < fs;
        if (sameLine) expect(tagRight + 8, `${tagText} / ${cntText}`).toBeLessThanOrEqual(cntLeft);
        expect(tagRight).toBeLessThanOrEqual(num(bg, 'x') + num(bg, 'width'));
      }
      expect(cntRight).toBeLessThanOrEqual(num(bg, 'x') + num(bg, 'width'));
      expect(cntText).not.toBe('');
    }
  });

  it.each([
    ['ders', 1280, 540, 0.5],
    ['ders', 1280, 540, 0.1],
    ['lab', 750, 540, 0.5],
    ['lab', 750, 540, 0.2],
    ['lab', 750, 540, 0.15],
  ] as const)('%s %i x %i threshold %f: line labels clear of each other and of every line', (mode, w, h, thr) => {
    const { el, player } = setup(w, h, mode);
    go(player, 'sinir');
    player.setParams({ threshold: thr });
    const fs = mode === 'ders' ? 18 : 13;
    const boxes = [...el.querySelectorAll('text.boundary-label')].map((t) =>
      labelBox(num(t, 'x'), num(t, 'y'), t.textContent!.length, t.getAttribute('text-anchor') as 'start', fs),
    );
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    boxes.forEach((b, i) => {
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(b, boxes[j])).toBe(0);
      for (const l of el.querySelectorAll('line.boundary-line')) {
        const n = 60;
        for (let t = 0; t <= n; t++) {
          const x = num(l, 'x1') + ((num(l, 'x2') - num(l, 'x1')) * t) / n;
          const y = num(l, 'y1') + ((num(l, 'y2') - num(l, 'y1')) * t) / n;
          const inside = x > b.l && x < b.r && y > b.t && y < b.b;
          expect(inside, `label ${i} on line ${l.getAttribute('data-method')}`).toBe(false);
        }
      }
    });
  });
});

describe('step 10: what changed', () => {
  it('step 10 table has three rows with nearly equal pr auc', () => {
    const { el, player } = setup();
    go(player, 'karsilastirma');
    const rows = [...el.querySelectorAll('.imb-table tbody tr')];
    expect(rows.map((r) => r.getAttribute('data-row'))).toEqual(['yok', 'smote', 'agirlik']);
    const cell = (r: Element, k: string) => r.querySelector(`td[data-col="${k}"]`)!.textContent;
    const aps = rows.map((r) => cell(r, 'ap'));
    expect(aps).toEqual([MODELS2D.base.ap, MODELS2D.smote.ap, MODELS2D.weighted.ap].map((a) => f(a, 3)));
    const values = [MODELS2D.base.ap, MODELS2D.smote.ap, MODELS2D.weighted.ap];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.01);
    expect(rows.map((r) => cell(r, 'caught'))).toEqual(['0 / 37', '25 / 37', '25 / 37']);
    expect(rows.map((r) => cell(r, 'falseAlarm'))).toEqual(['0', '202', '205']);
    expect(cell(rows[0], 'precision')).toBe(UNDEFINED_TEXT);
    expect(cell(rows[0], 'recall')).toBe('0,000');
    expect([...el.querySelectorAll('.imb-table thead th')].map((t) => t.textContent)).toEqual([
      'yöntem',
      'yakalanan',
      'yanlış alarm',
      'kesinlik',
      'duyarlılık',
      'PR-AUC',
    ]);
    expect(el.querySelector('.imb-compare-note')!.textContent).toContain('Dengeleme sıralamayı değil eşiği kaydırdı');
    expect(el.querySelector('.formula')!.textContent).toContain('PR-AUC');
    // Ders: no fourth row, the table is visible and the scatter is not
    expect(count(el, '.imb-table tr.is-selection')).toBe(0);
    expect((el.querySelector('.imb-compare') as HTMLElement).hidden).toBe(false);
    expect((el.querySelector('.imb-boundary-host svg') as SVGElement).style.display).toBe('none');
  });

  it('step 10 links point to smote-sizinti and roc-esik', () => {
    const { el, player } = setup();
    go(player, 'karsilastirma');
    const links = [...el.querySelectorAll('.imb-links a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['../smote-sizinti/', '../roc-esik/']);
    for (const a of links) expect(a.getAttribute('aria-label')).toBeTruthy();
  });

  it('the Lab adds the chosen configuration as a fourth row', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'karsilastirma');
    player.setParams({ method: 'smote', threshold: 0.3 });
    const rows = [...el.querySelectorAll('.imb-table tbody tr')];
    expect(rows).toHaveLength(4);
    const last = rows[3];
    expect(last.classList.contains('is-selection')).toBe(true);
    expect(last.querySelector('td')!.textContent).toBe('seçim: SMOTE, eşik 0,30');
    const r = resultFor('smote', player.state.params, 0.3);
    expect(last.querySelector('td[data-col="caught"]')!.textContent).toBe(`${r.matrix.tp} / ${r.matrix.tp + r.matrix.fn}`);
    // back to the lesson view: no fourth row without the Lab flag
    const v = deriveImbView(stepIndex(sc, 'karsilastirma'), player.state.params, false);
    expect(v.table!.rows).toHaveLength(3);
  });

  it('the table is plain HTML: no fixed widths that could clip', () => {
    const css = cssText;
    expect(css).toMatch(/\.imb-table \{ width:100%/);
    expect(css).toMatch(/\.imb-boundary-host \{ overflow-x:hidden; overflow-y:auto/);
  });
});
