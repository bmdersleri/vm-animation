import { test, expect, type Page } from '@playwright/test';
import { fontSizes, gotoStep, open, stepCount } from './helpers';

/*
 * The teacher's red line "text never too small", checked in a real browser at
 * 1280×720, plus the Naive Bayes page's functional behaviour. Performance
 * budgets live in naive-bayes.perf.spec.ts.
 *
 * "Adım N" in test names and screenshots means the N-th step, i.e.
 * `gotoStep(page, N - 1, 13)` (the same convention as knn.spec.ts).
 */

const PAGE = '/naive-bayes/';
const READY = 'canvas.icons[data-cell-px]';
const STEPS = 13;
/** Steps 9 and 10 sweep the words (3 × 900 ms) and α (2 × 1500 ms); wait until the sweep has ended. */
const SWEEP_DONE_MS = 3600;
const settle = (index: number): number => (index === 8 || index === 9 ? SWEEP_DONE_MS : 1500);

/** Body-size text of the probability bar: chips, class names, the big label and the trail values. */
const BAR_TEXT = 'svg.bar-plot :is(.chip-text, .chip-arrow, .bar-class, .bar-pct, .trail-label)';
/** Tick-size text: axis ticks, the trail's %-grid and word labels, the class key and the ◆ label. */
const TICK_TEXT = '.tick text, text.tick, .gauss-plot .legend text, .query-label';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 2} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  // the last step paints the decision regions and shows the new customer with its bar
  await expect(page.locator('.nb-scene')).toHaveAttribute('data-part', '3');
  await expect(page.locator('svg.gauss-plot g.q')).toBeVisible();
  await expect(page.locator('.gauss-bar .bar-pct')).toHaveText('P(Ayrıldı) = %18,5');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const min: Record<string, Record<string, number | null>> = {};
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, settle(step));
    const m: Record<string, number[]> = {
      '.formula': await fontSizes(page, '.formula'),
      'text.icon-count': await fontSizes(page, 'text.icon-count'),
      'bar labels': await fontSizes(page, BAR_TEXT),
      '.prediction': await fontSizes(page, '.prediction'),
      '.axis-title': await fontSizes(page, '.axis-title'),
      'ticks': await fontSizes(page, TICK_TEXT),
    };
    const at = `step ${step + 1}`;
    expect(m['.formula'].length, `${at}: strip shown`).toBeGreaterThan(0);
    if (step <= 3) expect(m['text.icon-count'].length, `${at}: icon legend`).toBeGreaterThan(0);
    // part 2 always shows the bar; part 3 in Ders from the new customer on (adım 12)
    if ((step >= 4 && step <= 9) || step >= 11) expect(m['bar labels'].length, `${at}: bar labels`).toBeGreaterThan(0);
    if (step >= 4 && step <= 9) expect(m['ticks'].length, `${at}: trail labels`).toBeGreaterThan(0);
    if (step >= 10) {
      expect(m['.axis-title'].length, `${at}: axis titles`).toBeGreaterThan(0);
      expect(m['ticks'].length, `${at}: ticks`).toBeGreaterThan(0);
    }
    for (const sel of ['.formula', 'text.icon-count', 'bar labels']) {
      for (const fs of m[sel]) expect(fs, `${at} ${sel}`).toBeGreaterThanOrEqual(22);
    }
    for (const fs of m['.prediction']) expect(fs, `${at} .prediction`).toBeGreaterThanOrEqual(32);
    for (const sel of ['.axis-title', 'ticks']) {
      for (const fs of m[sel]) expect(fs, `${at} ${sel}`).toBeGreaterThanOrEqual(18);
    }
    min[`adım ${step + 1}`] = Object.fromEntries(Object.entries(m).map(([k, xs]) => [k, xs.length ? Math.min(...xs) : null]));
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(min) });
  console.log('naive-bayes ders min font-size px', JSON.stringify(min));
});

/** CSS px of one icon cell (set by IconsLayer) and the grid canvas box. */
function iconGrid(page: Page) {
  return page.locator('canvas.icons').evaluate((c) => {
    const b = c.getBoundingClientRect();
    return { cell: Number((c as HTMLElement).dataset.cellPx), w: b.width, h: b.height };
  });
}

test('ders: icons are at least 12 px', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const seen: Record<string, number> = {};
  for (let step = 0; step <= 3; step++) {
    if (step > 0) await gotoStep(page, step, STEPS);
    const g = await iconGrid(page);
    expect(g.cell, `adım ${step + 1}: cell px`).toBeGreaterThanOrEqual(12);
    // the canvas is the 50 × 20 grid of those cells
    expect(Math.abs(g.w - 50 * g.cell), `adım ${step + 1}: grid width`).toBeLessThanOrEqual(1);
    expect(Math.abs(g.h - 20 * g.cell), `adım ${step + 1}: grid height`).toBeLessThanOrEqual(1);
    seen[`adım ${step + 1}`] = g.cell;
  }
  info.annotations.push({ type: 'icon cell px', description: JSON.stringify(seen) });
  console.log('naive-bayes icon cell px', JSON.stringify(seen));
});

/** Boxes of the scene parts the params panel must not cover. */
function sceneBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    const sel = [
      '.nb-scene .formula', 'canvas.icons', '.icon-legend .legend-item',
      'svg.bar-plot :is(.chip, .bar-class, .bar-pct, .bar-frame, .trail-dot, .trail-label, text.tick)',
      'svg.gauss-plot :is(.axis-title, .tick, .legend, rect.hit, g.q)',
    ].join(', ');
    return {
      params: box(document.querySelector('.params')!),
      stage: box(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll(sel)]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]'); })
        .map((e) => ({ ...box(e), name: e.getAttribute('class') ?? e.tagName })),
    };
  });
}

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  for (let step = 0; step < STEPS; step++) {
    await gotoStep(page, step, STEPS, settle(step));
    const r = await sceneBoxes(page);
    const at = `step ${step + 1}`;
    expect(r.marks.length, `${at}: scene shown`).toBeGreaterThan(0);
    expect(r.stage.r, `${at}: stage ends at the panel`).toBeLessThanOrEqual(r.params.l + 1);
    for (const m of r.marks) {
      expect(m.r <= r.params.l || m.l >= r.params.r || m.b <= r.params.t || m.t >= r.params.b,
        `${at} ${JSON.stringify(m)}`).toBe(true);
      expect(m.r, `${at} ${m.name} inside the stage`).toBeLessThanOrEqual(r.stage.r + 1);
      expect(m.b, `${at} ${m.name} above the stage bottom`).toBeLessThanOrEqual(r.stage.b + 1);
    }
  }
});

test('lab word buttons move the bar', async ({ page }) => {
  // Lab adım 5: the spam prior, no words yet
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 4, STEPS, 1000);
  const pctText = page.locator('.nb-bar .bar-pct');
  const spamW = () => page.locator('.nb-bar rect.bar-spam').evaluate((r) => r.getBoundingClientRect().width);
  const btn = (w: string) => page.locator(`.nb-params button.word-btn[data-word="${w}"]`);
  await expect(page.locator('.nb-params button.word-btn')).toHaveCount(8);
  await expect(pctText).toHaveText('P(spam) = %40,0');
  await expect(btn('bedava')).toHaveAttribute('aria-pressed', 'false');
  const w0 = await spamW();

  await btn('bedava').click();
  await expect(btn('bedava')).toHaveAttribute('aria-pressed', 'true');
  await expect(pctText).toHaveText('P(spam) = %90,9');
  await expect.poll(spamW).toBeGreaterThan(w0 * 2);
  const w1 = await spamW();
  await expect(page.locator('.nb-bar .chip .chip-text')).toHaveText(['bedava']);

  // "toplantı" is evidence for normal: the bar slides back
  await btn('toplantı').click();
  await expect(btn('toplantı')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.nb-bar .chip .chip-text')).toHaveText(['bedava', 'toplantı']);
  await expect.poll(spamW).toBeLessThan(w1 - 1);

  // both off again: back at the prior
  await btn('bedava').click();
  await btn('toplantı').click();
  await expect(btn('bedava')).toHaveAttribute('aria-pressed', 'false');
  await expect(pctText).toHaveText('P(spam) = %40,0');
  await expect.poll(async () => Math.abs((await spamW()) - w0)).toBeLessThanOrEqual(1);
  await expect(stepCount(page)).toHaveText(`Adım 5 / ${STEPS}`);
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [
    ['ders', 3], ['ders', 7], ['ders', 9], ['ders', 12], ['ders', 13], ['lab', 6],
  ];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, settle(step - 1));
    await expect(page).toHaveScreenshot(`naive-bayes-${mode}-${step}.png`);
  }
});
