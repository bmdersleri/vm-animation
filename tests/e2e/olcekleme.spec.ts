import { test, expect, type Locator } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the olcekleme page, checked in a real
 * browser at 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Performance budgets live in olcekleme.perf.spec.ts.
 */

const PAGE = '/olcekleme/';
const READY = 'svg.scale-plot circle.pt.cust';
const STEPS = 13;
/** 3 × 1800 ms sweep plus the 900 ms transition after the last unit. */
const SWEEP_DONE_MS = 5000;
const LABELS = '.cust-label, .query-label, .mu-label, .pt-label, .z-label, .row-label';

const centre = async (loc: Locator) => {
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('.flow-box')).toHaveCount(3);
  await expect(page.locator('.formula')).toContainText('önce ayır, sonra öğren, sonra uygula');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const min: Record<string, number> = {};
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 1200);
    const m: Record<string, number[]> = {
      big: [...(await fontSizes(page, '.formula')), ...(await fontSizes(page, '.flow-box')), ...(await fontSizes(page, '.line-name'))],
      title: await fontSizes(page, '.step-title'),
      term: await fontSizes(page, '.step-term'),
      small: await fontSizes(page, '.tick text, .axis-title, .cust-label, .query-label, .mu-label, .pt-label, .z-label, .row-label'),
    };
    expect(m.title.length, `step ${step + 1} title`).toBeGreaterThan(0);
    expect(m.term.length, `step ${step + 1} term`).toBeGreaterThan(0);
    expect(m.big.length, `step ${step + 1} formula`).toBeGreaterThan(0);
    expect(m.small.length, `step ${step + 1} labels`).toBeGreaterThan(0);
    for (const fs of [...m.big, ...m.term]) expect(fs, `step ${step + 1} text`).toBeGreaterThanOrEqual(22);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.small) expect(fs, `step ${step + 1} label`).toBeGreaterThanOrEqual(18);
    for (const k of Object.keys(m)) if (m[k].length) min[`${step + 1}.${k}`] = Math.min(...m[k]);
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(min) });
  console.log('ders min font-size px', JSON.stringify(min));
});

test('ders: no page scroll and nothing offscreen', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 1200);
    const o = await pageOverflow(page);
    expect(o.x, `step ${step + 1} x overflow`).toBeLessThanOrEqual(0);
    expect(o.y, `step ${step + 1} y overflow`).toBeLessThanOrEqual(0);
    expect(await outsideStage(page, '.olc-scene text, .olc-scene .formula, .flow-box'), `step ${step + 1}`).toEqual([]);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.formula')].filter((f) => f.scrollWidth > f.clientWidth).map((f) => f.textContent));
    expect(wide, `step ${step + 1} formula clipped`).toEqual([]);
  }
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: labels never overlap`, async ({ page }) => {
    await open(page, PAGE, mode, READY);
    for (let step = 0; step < STEPS; step++) {
      if (step > 0) await gotoStep(page, step, STEPS, 1200);
      expect(await overlaps(page, LABELS), `step ${step + 1}`).toEqual([]);
      // a customer label stays next to its own dot: no other dot is closer to it, and none is covered
      const stray = await page.evaluate(() => {
        const out: string[] = [];
        const led = new Set([...document.querySelectorAll('line.leader')].map((l) => l.getAttribute('data-id')));
        const dots = [...document.querySelectorAll<SVGCircleElement>('circle.pt.cust')].map((c) => ({ id: c.dataset.id!, r: c.getBoundingClientRect() }));
        const gap = (b: DOMRect, d: DOMRect) => Math.hypot(
          Math.max(b.left - (d.left + d.width / 2), 0, d.left + d.width / 2 - b.right),
          Math.max(b.top - (d.top + d.height / 2), 0, d.top + d.height / 2 - b.bottom));
        for (const t of document.querySelectorAll<SVGTextElement>('text.cust-label')) {
          const b = t.getBoundingClientRect();
          if (b.width === 0 || getComputedStyle(t).opacity === '0') continue;
          const own = dots.find((d) => d.id === t.textContent);
          if (!own) continue;
          const g0 = gap(b, own.r);
          for (const d of dots) {
            // a displaced label is tied to its own dot by a leader line, so only unled labels must be nearest to their dot
            if (d.id !== own.id && !led.has(own.id) && gap(b, d.r) < g0 - 1) out.push(`${t.textContent} nearer to ${d.id}`);
            if (Math.min(b.right, d.r.right) - Math.max(b.left, d.r.left) > 1 && Math.min(b.bottom, d.r.bottom) - Math.max(b.top, d.r.top) > 1) {
              out.push(`${t.textContent} covers ${d.id}`);
            }
          }
        }
        return out;
      });
      expect(stray, `step ${step + 1} label vs dots`).toEqual([]);
    }
  });
}

test('ders: day unit keeps tick labels apart', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 2, STEPS, SWEEP_DONE_MS);
  const sizes = await fontSizes(page, '.axis.y .tick text');
  expect(sizes.length).toBeGreaterThanOrEqual(2);
  for (const fs of sizes) expect(fs).toBeGreaterThanOrEqual(18);
  expect(await overlaps(page, '.axis.y .tick text')).toEqual([]);
  expect(await overlaps(page, '.axis.x .tick text')).toEqual([]);
});

test('ders: the iso-distance curve is an ellipse in months and a circle in z', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  const radii = () => page.locator('ellipse.iso').evaluate((e) => ({ rx: Number(e.getAttribute('rx')), ry: Number(e.getAttribute('ry')) }));
  await gotoStep(page, 1, STEPS, 1500);
  const a = await radii();
  expect(Math.abs(a.rx / a.ry - 1)).toBeGreaterThan(0.1);
  await gotoStep(page, 5, STEPS, 1500);
  const b = await radii();
  expect(Math.abs(b.rx - b.ry)).toBeLessThanOrEqual(1);
});

test('ders: unit sweep changes the nearest neighbour M3 → M2 → M5', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 1, STEPS, 800);
  // the nearest customer is marked on its dot (circle.pt.cust.nearest[data-id]); its label carries the same id
  const nearest = () => page.locator('circle.pt.cust.nearest').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  await expect.poll(nearest).toEqual(['M3']);
  await page.locator('.step-dot').nth(2).click();
  for (const id of ['M3', 'M2', 'M5']) {
    await expect.poll(nearest, { timeout: 8000, intervals: [50] }).toEqual([id]);
  }
  await page.waitForTimeout(SWEEP_DONE_MS - 3000);
  await expect(page.locator('.formula')).toContainText('gün: en yakın M5, d = 188,22');
});

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 5, STEPS);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const box = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return {
      params: box(document.querySelector('.params')!),
      stage: box(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll('.olc-scene :is(text, .formula, .flow-box)')]
        .filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]')).map(box),
    };
  });
  expect(r.marks.length).toBeGreaterThan(0);
  expect(r.stage.r).toBeLessThanOrEqual(r.params.l + 1);
  for (const m of r.marks) {
    expect(m.r <= r.params.l || m.l >= r.params.r || m.b <= r.params.t || m.t >= r.params.b, JSON.stringify(m)).toBe(true);
    expect(m.r).toBeLessThanOrEqual(r.stage.r + 1);
  }
});

test('lab readability', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  const text = await fontSizes(page, '.step-text');
  const labels = await fontSizes(page, '.params label');
  expect(text.length).toBeGreaterThan(0);
  expect(labels.length).toBeGreaterThan(0);
  for (const fs of [...text, ...labels]) expect(fs).toBeGreaterThanOrEqual(16);
  const d = `step-text ${Math.min(...text)} px, params label min ${Math.min(...labels)} px`;
  info.annotations.push({ type: 'lab font-size', description: d });
  console.log('lab font-size', d);
});

test('lab drag moves the new customer and updates distances', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  const diamond = page.locator('svg.scale-plot path.query');
  const start = await centre(diamond);
  const plot = (await page.locator('svg.scale-plot rect.hit').boundingBox())!;
  const end = { x: plot.x + plot.width * 0.7, y: plot.y + plot.height * 0.3 };
  const formula = await page.locator('.formula').textContent();
  const dists = await page.locator('.cust-table tbody td:last-child').allTextContents();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(start.x + ((end.x - start.x) * i) / 20, start.y + ((end.y - start.y) * i) / 20);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const moved = await centre(diamond);
  expect(Math.abs(moved.x - end.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(moved.y - end.y)).toBeLessThanOrEqual(2);
  expect(await page.locator('.formula').textContent()).not.toBe(formula);
  expect(await page.locator('.cust-table tbody td:last-child').allTextContents()).not.toEqual(dists);
});

test('lab drag stops at the axis bounds', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  const diamond = page.locator('svg.scale-plot path.query');
  const start = await centre(diamond);
  const plot = (await page.locator('svg.scale-plot rect.hit').boundingBox())!;
  const far = { x: plot.x + plot.width + 150, y: plot.y - 150 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(start.x + ((far.x - start.x) * i) / 10, start.y + ((far.y - start.y) * i) / 10);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const c = await centre(diamond);
  const f = (await page.locator('svg.scale-plot rect.frame').boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(f.x - 1);
  expect(c.x).toBeLessThanOrEqual(f.x + f.width + 1);
  expect(c.y).toBeGreaterThanOrEqual(f.y - 1);
  expect(c.y).toBeLessThanOrEqual(f.y + f.height + 1);
  // months: the drag limit is the plot frame, so no extra outline
  await expect(page.locator('svg.scale-plot rect.drag-box')).toHaveAttribute('opacity', '0');

  // z (step 9): the plot runs wider than the data box; the ◆ stops at the visible dashed drag box
  await gotoStep(page, 8, STEPS, 1200);
  const box = page.locator('svg.scale-plot rect.drag-box');
  await expect(box).toHaveAttribute('opacity', '1');
  const b = (await box.boundingBox())!;
  const plotZ = (await page.locator('svg.scale-plot rect.hit').boundingBox())!;
  expect(b.x + b.width).toBeLessThan(plotZ.x + plotZ.width - 20);
  const s2 = await centre(diamond);
  const far2 = { x: plotZ.x + plotZ.width + 150, y: plotZ.y - 150 };
  await page.mouse.move(s2.x, s2.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(s2.x + ((far2.x - s2.x) * i) / 10, s2.y + ((far2.y - s2.y) * i) / 10);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const c2 = await centre(diamond);
  const b2 = (await box.boundingBox())!;
  // top-right corner of the drag box: 64 months, 210 TL
  expect(Math.abs(c2.x - (b2.x + b2.width))).toBeLessThanOrEqual(2);
  expect(Math.abs(c2.y - b2.y)).toBeLessThanOrEqual(2);
});

test('lab table highlights the nearest row and shows z when scaled', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS, 1000);
  await expect(page.locator('tr.nearest')).toContainText('M3');
  await expect(page.locator('th.z')).toHaveCount(0);
  await page.keyboard.press('S');
  await page.waitForTimeout(1200);
  await expect(page.locator('th.z')).toHaveCount(2);
  await expect(page.locator('tr.nearest')).toContainText('M3');
  await expect(page.locator('text.query-label')).toHaveText('Yeni (−0,57; −0,31)');
});

test('lab: the params card shows only the current controls and fits without scrolling', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, step === 2 ? SWEEP_DONE_MS : 300);
    expect(await shownDisabledGroups(page), `step ${step + 1} disabled group shown`).toEqual([]);
    expect(await paramsOutside(page), `step ${step + 1} control outside the side column`).toEqual([]);
  }
});

/**
 * Max allowed empty height (px) between the split content and the formula strip in Lab.
 * Measured: old 221, new 148 (the block is centred, so ~the same space sits above it); 120 would need a stretched plot.
 */
const LAB_BAND_MAX = 160;

test('lab: no large empty band under the split plot', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  const gaps: Record<number, number> = {};
  for (const step of [9, 10, 11, 12]) {
    await gotoStep(page, step, STEPS, 1200);
    const gap = await page.evaluate(() => {
      const f = document.querySelector('.formula')!.getBoundingClientRect();
      const visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).display !== 'none'; };
      const flow = document.querySelector('.split-wrap .flow');
      if (flow && visible(flow)) return f.top - flow.getBoundingClientRect().bottom;
      let bottom = 0;
      for (const t of document.querySelectorAll('.split-plot .axis-title')) {
        if (visible(t)) bottom = Math.max(bottom, t.getBoundingClientRect().bottom);
      }
      return f.top - bottom;
    });
    gaps[step + 1] = Math.round(gap);
    expect(gap, `step ${step + 1} gap`).toBeLessThanOrEqual(LAB_BAND_MAX);
  }
  info.annotations.push({ type: 'lab gaps px', description: JSON.stringify(gaps) });
  console.log('olc lab gaps px', JSON.stringify(gaps));
});

test('help lists U, S and T', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.keyboard.press('?');
  await expect(page.locator('.help')).toBeVisible();
  const items = await page.locator('.help li').allTextContents();
  for (const key of ['U', 'S', 'T']) {
    expect(items.some((t) => t.startsWith(`${key}:`)), key).toBe(true);
  }
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [
    ['ders', 2], ['ders', 3], ['ders', 6], ['ders', 8], ['ders', 12], ['ders', 13], ['lab', 2], ['lab', 11],
  ];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, step === 3 ? SWEEP_DONE_MS : 1800);
    await expect(page).toHaveScreenshot(`olcekleme-${mode}-${step}.png`);
  }
});
