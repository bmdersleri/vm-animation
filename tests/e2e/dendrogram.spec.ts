import { test, expect } from '@playwright/test';
import { gotoStep, labelCollisions, open, outsideStage, pageOverflow, stepCount } from './helpers';

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
  for (const step of [2, 6, 8, 9]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 2500);
    expect(await outsideStage(page, TEXTS), `step ${step}`).toEqual([]);
    expect(await labelCollisions(page, 'svg.dg-scatter'), `step ${step}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
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

test('narrow layout: the scatter keeps its height and the panel sits below it', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  for (const mode of ['ders', 'lab'] as const) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, 5, STEPS, 2500);
    const m = await page.evaluate(() => {
      const plot = document.querySelector('svg.dg-scatter')!.getBoundingClientRect();
      const panel = document.querySelector('.dg-params')?.getBoundingClientRect();
      return { h: plot.height, panelTop: panel ? panel.top : plot.bottom, bottom: plot.bottom, left: plot.left, right: plot.right, pl: panel?.left ?? 0 };
    });
    expect(m.h, mode).toBeGreaterThanOrEqual(200);
    expect(await labelCollisions(page, 'svg.dg-scatter'), mode).toEqual([]);
    expect(await outsideStage(page, TEXTS), mode).toEqual([]);
  }
});
