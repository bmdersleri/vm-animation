import { test, expect } from '@playwright/test';
import { gotoStep, labelCollisions, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

const PAGE = '/dendrogram/';
const READY = 'svg.dg-scatter g.dg-point';
const STEPS = 10;
const TEXTS = '.dg-scatter text, .dg-tree text, .stage p, .stage li';

test('dendrogram: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Hiyerarşik kümeleme ve dendrogram');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  for (const step of [2, 6, 8, 9, 10]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 2500);
    expect(await outsideStage(page, TEXTS), `step ${step}`).toEqual([]);
    expect(await labelCollisions(page, 'svg.dg-scatter'), `step ${step}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    if (step === 10) expect(await overlaps(page, '.dg-tree-caption, .dg-tree text'), 'step 10').toEqual([]);
    await expect(page).toHaveScreenshot(`dendrogram-ders-${step}.png`);
  }
});

test('ders: the cut sweep ends on k = 6', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 6, STEPS, 9000);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
});

/** The cut label's box must lie inside the dendrogram's plot frame. */
const cutLabelOutsideFrame = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const f = document.querySelector('rect.dg-frame')!.getBoundingClientRect();
  const t = document.querySelector('text.dg-cut-label')!.getBoundingClientRect();
  return t.top < f.top - 0.5 || t.bottom > f.bottom + 0.5 || t.left < f.left - 0.5 || t.right > f.right + 0.5;
});

test('ders: the cut sweep starts on k = 1 with its label inside the plot', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  // the sweep holds k = 1 for 1,3 s; sample it after the transitions settle
  await gotoStep(page, 6, STEPS, 600);
  await expect(page.locator('[data-k]').first()).toHaveAttribute('data-k', '1');
  expect(await outsideStage(page, '.dg-tree text')).toEqual([]);
  expect(await cutLabelOutsideFrame(page)).toBe(false);
});

test('lab: k = 1 cut label stays inside the plot in every linkage', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  for (const l of ['ward', 'complete', 'average', 'single']) {
    await page.locator('select[data-param="linkage"]').selectOption(l);
    await page.locator('button[data-k="1"]').click();
    await expect(page.locator('button[data-k="1"]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(800);
    expect(await outsideStage(page, '.dg-tree text'), l).toEqual([]);
    expect(await cutLabelOutsideFrame(page), l).toBe(false);
  }
});

test('lab: a click on the centre of a branch bar picks that branch, not its parent', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  for (const l of ['single', 'ward']) {
    await page.locator('select[data-param="linkage"]').selectOption(l);
    await page.waitForTimeout(800);
    for (let m = 1; m <= 16; m++) {
      // centre of the bar in page coordinates, from the visible path "M x1,y1 V yb H x2 V y2"
      const c = await page.evaluate((merge) => {
        const p = document.querySelector<SVGPathElement>(`path.dg-branch[data-merge="${merge}"]`)!;
        const [, x1, , yb, x2] = /M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)H(-?[\d.]+)/.exec(p.getAttribute('d')!)!.map(Number);
        const pt = new DOMPoint((x1 + x2) / 2, yb).matrixTransform(p.getScreenCTM()!);
        return { x: pt.x, y: pt.y };
      }, m);
      await page.mouse.click(c.x, c.y);
      await expect(page.locator('.dg-picked-title'), `${l} merge ${m}`).toHaveText(`Dal ${m}`);
      await expect(page.locator(`path.dg-branch[data-merge="${m}"]`)).toHaveAttribute('data-picked', 'true');
    }
  }
});

test('lab: single linkage, cut at k = 3 and point click', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  await page.locator('select[data-param="linkage"]').selectOption('single');
  await page.locator('button[data-k="3"]').click();
  await expect(page.locator('button[data-k="3"]')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1200);
  await page.locator('svg.dg-scatter g.dg-point').nth(10).click({ force: true });
  await expect(page.locator('input[data-param="point"]')).toHaveValue('11');
  await page.waitForTimeout(800);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
  expect(await labelCollisions(page, 'svg.dg-scatter')).toEqual([]);
  await expect(page).toHaveScreenshot('dendrogram-lab-single-k3-point.png');
});

test('narrow layout: the panel sits below both plots, which keep their height', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  for (const mode of ['ders', 'lab'] as const) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, 5, STEPS, 2500);
    const m = await page.evaluate(() => {
      const r = (sel: string): DOMRect => document.querySelector(sel)!.getBoundingClientRect();
      const panel = r('.dg-panel');
      const stage = r('.stage');
      return {
        belowScatter: panel.top - r('.dg-scatter-host').bottom,
        belowTree: panel.top - r('.dg-tree-host').bottom,
        scatterH: r('svg.dg-scatter').height,
        treeH: r('svg.dg-tree').height,
        inStage: panel.left >= stage.left - 1 && panel.right <= stage.right + 1 && panel.bottom <= stage.bottom + 1,
      };
    });
    expect(m.belowScatter, mode).toBeGreaterThanOrEqual(-1);
    expect(m.belowTree, mode).toBeGreaterThanOrEqual(-1);
    expect(m.scatterH, mode).toBeGreaterThanOrEqual(200);
    expect(m.treeH, mode).toBeGreaterThanOrEqual(200);
    expect(m.inStage, mode).toBe(true);
    expect(await labelCollisions(page, 'svg.dg-scatter'), mode).toEqual([]);
    expect(await outsideStage(page, TEXTS), mode).toEqual([]);
  }
});

test('narrow layout: the k = 1 cut label sits inside the tree and does not cross the cut line', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  await page.locator('select[data-param="linkage"]').selectOption('ward');
  await page.locator('button[data-k="1"]').click();
  await expect(page.locator('button[data-k="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const f = document.querySelector('rect.dg-frame')!.getBoundingClientRect();
    const t = document.querySelector('text.dg-cut-label')!.getBoundingClientRect();
    const y = document.querySelector('line.dg-cut')!.getBoundingClientRect().top;
    // 1 px of slack: the text box includes the font's ascent padding, the glyphs sit inside the frame
    return { inside: t.top >= f.top - 1 && t.bottom <= f.bottom + 1 && t.left >= f.left - 1 && t.right <= f.right + 1, apart: t.bottom <= y + 1 || t.top >= y - 1 };
  });
  expect(m.inside).toBe(true);
  expect(m.apart).toBe(true);
  expect(await outsideStage(page, '.dg-tree text')).toEqual([]);
});

/** Branch segments ("M x1,y1 V yb H x2 V y2": two stems and the bar) whose box meets the cut label's box. */
const cutLabelHits = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const t = document.querySelector('text.dg-cut-label')!.getBoundingClientRect();
  const out: string[] = [];
  for (const p of document.querySelectorAll<SVGPathElement>('path.dg-branch')) {
    const [, x1, y1, yb, x2, y2] = /M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)/.exec(p.getAttribute('d')!)!.map(Number);
    const m = p.getScreenCTM()!;
    const pt = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(m);
    const segs: [DOMPoint, DOMPoint][] = [[pt(x1, y1), pt(x1, yb)], [pt(x1, yb), pt(x2, yb)], [pt(x2, yb), pt(x2, y2)]];
    for (const [a, b] of segs) {
      const dx = Math.min(t.right, Math.max(a.x, b.x)) - Math.max(t.left, Math.min(a.x, b.x));
      const dy = Math.min(t.bottom, Math.max(a.y, b.y)) - Math.max(t.top, Math.min(a.y, b.y));
      if (dx >= 0 && dy >= 0) out.push(`merge ${p.getAttribute('data-merge')}`);
    }
  }
  return out;
});

test('ders step 9: the cut label stays clear of the branch bars at its height', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 8, STEPS, 2500);
  expect(await cutLabelHits(page)).toEqual([]);
});

test('lab 1280x720: a larger scatter, a full-width tree with leaf labels 4 px apart, the cut label off the branches', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS);
  for (const l of ['ward', 'single']) {
    await page.locator('select[data-param="linkage"]').selectOption(l);
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const leaves = [...document.querySelectorAll('.dg-tree g.dg-leaf text')].map((t) => t.getBoundingClientRect()).sort((a, b) => a.left - b.left);
      const panel = document.querySelector('.dg-panel')!;
      return {
        plotH: document.querySelector('svg.dg-scatter rect.frame')!.getBoundingClientRect().height,
        treeH: document.querySelector('svg.dg-tree')!.getBoundingClientRect().height,
        minGap: Math.min(...leaves.slice(1).map((b, i) => b.left - leaves[i].right)),
        clipped: panel.scrollHeight > panel.clientHeight + 1,
      };
    });
    expect(m.plotH, l).toBeGreaterThanOrEqual(275); // side by side: 254
    expect(m.treeH, l).toBeGreaterThanOrEqual(220);
    expect(m.minGap, l).toBeGreaterThanOrEqual(4); // side by side: 1,1
    expect(m.clipped, l).toBe(false);
    expect(await cutLabelHits(page), l).toEqual([]);
    expect(await labelCollisions(page, 'svg.dg-scatter'), l).toEqual([]);
  }
  // no Lab step clips the panel; step 10 shows the table under a full-width tree
  for (let i = 0; i < STEPS; i++) {
    await gotoStep(page, i, STEPS, 700);
    expect(await page.evaluate(() => { const p = document.querySelector('.dg-panel')!; return p.scrollHeight > p.clientHeight + 1; }), `step ${i + 1}`).toBe(false);
    expect(await outsideStage(page, TEXTS), `step ${i + 1}`).toEqual([]);
  }
  expect(await page.locator('.dg-scatter-host').isVisible()).toBe(false);
});
