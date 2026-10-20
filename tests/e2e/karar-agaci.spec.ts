import { test, expect, type Page } from '@playwright/test';
import { fontSizes, gotoStep, open, stepCount } from './helpers';

/*
 * The teacher's red line "text never too small", checked in a real browser at
 * 1280×720, plus the decision-tree page's functional behaviour. Performance
 * budgets live in karar-agaci.perf.spec.ts.
 *
 * "Adım N" in test names and screenshots means the N-th step, i.e.
 * `gotoStep(page, N - 1, 12)` (the same convention as knn.spec.ts).
 */

const PAGE = '/karar-agaci/';
const READY = 'svg.tree-plot circle.pt, .card';
const STEPS = 12;
/** Step 11 ("ezber") sweeps the depth up to unlimited; the sweep takes ~4.5 s. */
const SWEEP_DONE_MS = 6000;

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 2} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const min: Record<string, Record<string, number | null>> = {};
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, step === 10 ? SWEEP_DONE_MS : 1500);
    const m: Record<string, number[]> = {
      '.card *': await fontSizes(page, '.card *'),
      '.formula': await fontSizes(page, '.formula'),
      '.axis-title': await fontSizes(page, '.axis-title'),
      '.tick text': await fontSizes(page, '.tick text'),
      '.node text': await fontSizes(page, '.node text'),
    };
    const part2 = step >= 6 && step <= 10;
    if (step <= 5 || step === 8 || step === 11) {
      expect(m['.card *'].length, `step ${step + 1}: cards shown`).toBeGreaterThan(0);
    }
    if ((step >= 2 && step <= 5) || step === 8 || step === 11) expect(m['.formula'].length, `step ${step + 1}: formula shown`).toBeGreaterThan(0);
    if (part2) {
      expect(m['.axis-title'].length, `step ${step + 1}: axis titles`).toBeGreaterThan(0);
      expect(m['.tick text'].length, `step ${step + 1}: ticks`).toBeGreaterThan(0);
      expect(m['.node text'].length, `step ${step + 1}: tree nodes`).toBeGreaterThan(0);
    }
    for (const fs of [...m['.card *'], ...m['.formula']]) expect(fs, `step ${step + 1} card/formula`).toBeGreaterThanOrEqual(22);
    for (const sel of ['.axis-title', '.tick text', '.node text']) {
      for (const fs of m[sel]) expect(fs, `step ${step + 1} ${sel}`).toBeGreaterThanOrEqual(18);
    }
    min[`adım ${step + 1}`] = Object.fromEntries(Object.entries(m).map(([k, xs]) => [k, xs.length ? Math.min(...xs) : null]));
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(min) });
  console.log('karar-agaci ders min font-size px', JSON.stringify(min));
});

/** Boxes of the scene parts the params panel must not cover. */
function sceneBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const sel = [
      'svg.tree-plot :is(.axis-title, .legend)',
      '.card', '.formula', '.cards-legend',
      '.tree-col', '.tree-col .node', '.tree-col .tree-acc',
    ].join(', ');
    const col = document.querySelector('.tree-col') as HTMLElement | null;
    return {
      params: box(document.querySelector('.params')!),
      stage: box(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll(sel)]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]'); })
        .map((e) => ({ ...box(e), name: e.getAttribute('class') ?? e.tagName })),
      col: col && col.offsetParent !== null ? { sw: col.scrollWidth, cw: col.clientWidth } : null,
    };
  });
}

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  for (let step = 0; step < STEPS; step++) {
    await gotoStep(page, step, STEPS, step === 10 ? SWEEP_DONE_MS : 1500);
    const r = await sceneBoxes(page);
    expect(r.marks.length, `step ${step + 1}: scene shown`).toBeGreaterThan(0);
    expect(r.stage.r, `step ${step + 1}: stage ends at the panel`).toBeLessThanOrEqual(r.params.l + 1);
    for (const m of r.marks) {
      expect(m.r <= r.params.l || m.l >= r.params.r || m.b <= r.params.t || m.t >= r.params.b,
        `step ${step + 1} ${JSON.stringify(m)}`).toBe(true);
      expect(m.r, `step ${step + 1} ${m.name} inside the stage`).toBeLessThanOrEqual(r.stage.r + 1);
    }
    // the tree column does not scroll sideways, even for the unlimited tree
    if (r.col) expect(r.col.sw, `step ${step + 1}: tree column overflows sideways`).toBeLessThanOrEqual(r.col.cw);
  }
});

test('ders: unlimited depth keeps tree text readable', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 10, STEPS, SWEEP_DONE_MS);
  await expect(page.locator('input[data-param=depth]')).toHaveValue('7');
  const sizes = await fontSizes(page, '.node text');
  expect(sizes.length).toBeGreaterThan(8);
  for (const fs of sizes) expect(fs).toBeGreaterThanOrEqual(18);
  // the tree column scrolls rather than clipping
  const col = await page.locator('div.tree-col').evaluate((e) => {
    const cs = getComputedStyle(e);
    return { overflowY: cs.overflowY, overflowX: cs.overflowX };
  });
  expect(col.overflowY).toBe('auto');
  expect(col.overflowX).toBe('auto');

  await page.setViewportSize({ width: 1024, height: 640 });
  await page.waitForTimeout(800);
  await expect(stepCount(page)).toHaveText(`Adım 11 / ${STEPS}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(800);
  await expect(stepCount(page)).toHaveText(`Adım 11 / ${STEPS}`);
  await expect(page.locator('input[data-param=depth]')).toHaveValue('7');
  for (const fs of await fontSizes(page, '.node text')) expect(fs).toBeGreaterThanOrEqual(18);
});

/** Centre and orientation of a threshold line. */
async function lineBox(page: Page, sel: string) {
  return page.locator(`svg.tree-plot ${sel}`).first().evaluate((e) => {
    const b = e.getBoundingClientRect();
    const vertical = e.getAttribute('x1') === e.getAttribute('x2');
    return { vertical, x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
}

test('lab threshold drag changes leaf counts', async ({ page }) => {
  // Lab adım 7: depth 0, both root handles are shown; grab the contract one
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, STEPS, 1000);
  await expect(page.locator('svg.tree-plot line.handle.x')).toBeAttached();
  await expect(page.locator('svg.tree-plot line.handle.y')).toBeAttached();
  const leaves = () => page.locator('.tree-col .node.leaf').allTextContents();
  const before = await leaves();
  expect(before.length).toBeGreaterThanOrEqual(1);

  const ln = await lineBox(page, 'line.handle.x');
  expect(ln.vertical).toBe(true);
  const plot = (await page.locator('svg.tree-plot rect.hit').boundingBox())!;
  // press a quarter down the plot, away from the complaint handle (it crosses mid-height)
  const from = { x: ln.x, y: plot.y + plot.height * 0.25 };
  const to = { x: ln.x + plot.width * 0.3, y: from.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(1200);

  const after = await leaves();
  expect(after.join('|'), 'leaf counts follow the dragged line').not.toBe(before.join('|'));
  // the dragged (user) line moved to where the pointer was released
  const moved = await lineBox(page, 'line.scan');
  expect(moved.vertical).toBe(true);
  expect(Math.abs(moved.x - to.x)).toBeLessThanOrEqual(2);
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [['ders', 3], ['ders', 5], ['ders', 9], ['ders', 11], ['lab', 8]];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, step === 11 ? SWEEP_DONE_MS : step === 8 ? 3000 : 1500);
    await expect(page).toHaveScreenshot(`karar-agaci-${mode}-${step}.png`);
  }
});
