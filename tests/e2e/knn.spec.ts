import { test, expect, type Page } from '@playwright/test';

/*
 * The teacher's two red lines, checked in a real browser at 1280×720:
 * text readable from the back row, and animations that never stutter.
 * Performance budgets here are fixed; a miss is fixed in the code, never here.
 */

const stepCount = (page: Page) => page.locator('.step-count');

/** Jump to a step by its dot (index 0-based) and let the transitions settle. */
async function gotoStep(page: Page, index: number, settleMs = 1500): Promise<void> {
  await page.locator('.step-dot').nth(index).click();
  await expect(stepCount(page)).toHaveText(`Adım ${index + 1} / 12`);
  await page.waitForTimeout(settleMs);
}

async function open(page: Page, mode: 'ders' | 'lab'): Promise<void> {
  await page.goto(`/knn/?mod=${mode}`);
  await expect(page.locator(`[data-mode="${mode}"]`)).toBeVisible();
  await expect(page.locator('svg.plot circle.pt').first()).toBeAttached();
}

/** Computed font sizes (px) of every rendered, visible element matching the selector. */
function fontSizes(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const out: number[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ((el as HTMLElement).closest('[hidden]')) continue;
      out.push(parseFloat(cs.fontSize));
    }
    return out;
  }, selector);
}

function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}

const round = (x: number): number => Math.round(x * 100) / 100;

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, 'ders');
  await expect(stepCount(page)).toHaveText('Adım 1 / 12');
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);
  }
  await expect(stepCount(page)).toHaveText('Adım 12 / 12');
  await expect(page.locator('.prediction')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText('Adım 11 / 12');
});

test('ders: Escape closes params and the step keys work at once', async ({ page }) => {
  await open(page, 'ders');
  await page.locator('.params-toggle').click();
  await page.locator('.params input[type=range]').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.params')).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText('Adım 2 / 12');
  await page.keyboard.press(' ');
  await expect(stepCount(page)).toHaveText('Adım 3 / 12');
  await expect(page.locator('.params')).toBeHidden();
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, 'ders');
  const measured: Record<string, Record<string, number[]>> = {};
  for (const step of [0, 4, 11]) {
    if (step > 0) await gotoStep(page, step);
    const m: Record<string, number[]> = {
      '.step-title': await fontSizes(page, '.step-title'),
      '.prediction': await fontSizes(page, '.prediction'),
      '.axis-title': await fontSizes(page, '.axis-title'),
      '.tick text': await fontSizes(page, '.tick text'),
      '.step-text': await fontSizes(page, '.step-text'),
      // other plot labels share the tick size
      'labels': await fontSizes(page, '.vote-label, .query-label, .rank text'),
    };
    measured[`step ${step}`] = m;
    expect(m['.step-title'].length, 'step title shown').toBeGreaterThan(0);
    expect(m['.axis-title'].length, 'axis titles shown').toBeGreaterThan(0);
    expect(m['.tick text'].length, 'tick labels shown').toBeGreaterThan(0);
    if (step >= 4) expect(m['.prediction'].length, 'prediction shown').toBeGreaterThan(0);
    for (const fs of [...m['.step-title'], ...m['.prediction']]) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of [...m['.axis-title'], ...m['.tick text'], ...m.labels]) expect(fs).toBeGreaterThanOrEqual(18);
    for (const fs of m['.step-text']) expect(fs).toBeGreaterThanOrEqual(22);
  }
  const summary = Object.fromEntries(Object.entries(measured).map(([k, m]) => [
    k, Object.fromEntries(Object.entries(m).map(([sel, xs]) => [sel, xs.length ? Math.min(...xs) : null])),
  ]));
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(summary) });
  console.log('ders min font-size px', JSON.stringify(summary));
});

test('lab readability', async ({ page }, info) => {
  await open(page, 'lab');
  const text = await fontSizes(page, '.step-text');
  const labels = await fontSizes(page, '.params label');
  expect(text.length).toBeGreaterThan(0);
  expect(labels.length).toBeGreaterThan(0);
  for (const fs of [...text, ...labels]) expect(fs).toBeGreaterThanOrEqual(16);
  const d = `step-text ${Math.min(...text)} px, params label min ${Math.min(...labels)} px`;
  info.annotations.push({ type: 'lab font-size', description: d });
  console.log('lab font-size', d);
});

test('fullscreen keeps step', async ({ page }, info) => {
  await open(page, 'ders');
  await gotoStep(page, 5, 1000);
  const widths = () => page.evaluate(() => ({
    svg: document.querySelector('svg.plot')!.getBoundingClientRect().width,
    stage: document.querySelector('.stage')!.getBoundingClientRect().width,
  }));
  const isFs = () => page.evaluate(() => document.fullscreenElement !== null);

  await page.keyboard.press('f');
  await page.waitForTimeout(800);
  const entered = await isFs();
  if (entered) {
    const w = await widths();
    expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const escExited = entered && !(await isFs());
  if (await isFs()) await page.evaluate(() => document.exitFullscreen());
  await page.waitForTimeout(500);
  expect(await isFs()).toBe(false);
  await expect(stepCount(page)).toHaveText('Adım 6 / 12');
  let w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);

  // The same layout path with a real size change, in case fullscreen was denied.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(500);
  w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  expect(w.stage).toBeGreaterThan(1280 - 1);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  w = await widths();
  expect(Math.abs(w.svg - w.stage)).toBeLessThanOrEqual(1);
  await expect(stepCount(page)).toHaveText('Adım 6 / 12');
  const how = entered ? `entered; exited by ${escExited ? 'Escape' : 'document.exitFullscreen()'}` : 'denied; resize path only';
  info.annotations.push({ type: 'fullscreen', description: how });
  console.log('fullscreen', how);
});

test('regions redraw under 16 ms', async ({ page }, info) => {
  await open(page, 'lab');
  await gotoStep(page, 5);
  await expect(page.getByLabel('k (komşu sayısı)')).toBeVisible();
  const durations = await page.evaluate(async () => {
    const k = [...document.querySelectorAll<HTMLInputElement>('input[type=range]')]
      .find((e) => document.querySelector(`label[for="${e.id}"]`)?.textContent === 'k (komşu sayısı)')!;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const up = [1, 3, 5, 7, 9, 11, 13, 15];
    const sweep = [...up, ...up.slice(0, -1).reverse()];
    performance.clearMeasures('regions');
    for (let pass = 0; pass < 3; pass++) {
      for (const v of sweep) {
        k.value = String(v);
        k.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        await frame();
      }
    }
    return performance.getEntriesByName('regions').map((e) => e.duration);
  });
  expect(durations.length).toBeGreaterThanOrEqual(40);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'regions', description: d });
  console.log('regions', d);
  expect(p).toBeLessThan(16);
});

test('drag stays smooth', async ({ page }, info) => {
  await open(page, 'lab');
  await gotoStep(page, 4, 1000);
  const q = (await page.locator('svg.plot rect.query').boundingBox())!;
  const start = { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  // stay inside the data extent: the query is clamped to the data domain,
  // which can be narrower than the plot (equal-aspect scales)
  const data = await page.evaluate(() => {
    const rs = [...document.querySelectorAll('svg.plot .pt')].map((e) => e.getBoundingClientRect());
    const xs = rs.map((r) => r.x + r.width / 2);
    const ys = rs.map((r) => r.y + r.height / 2);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const end = { x: data.x0 + (data.x1 - data.x0) * 0.85, y: data.y0 + (data.y1 - data.y0) * 0.2 };

  // rAF timestamps plus the page-side times of pointer down / up
  await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean; __down: number; __up: number };
    w.__ts = [];
    w.__rec = true;
    w.__down = w.__up = NaN;
    window.addEventListener('pointerdown', () => { w.__down = performance.now(); }, { capture: true, once: true });
    window.addEventListener('pointerup', () => { w.__up = performance.now(); }, { capture: true, once: true });
    const tick = (t: number) => {
      w.__ts.push(t);
      if (w.__rec) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(100);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const t0 = Date.now();
  const N = 60;
  for (let i = 1; i <= N; i++) {
    const f = i / N;
    await page.mouse.move(start.x + (end.x - start.x) * f, start.y + (end.y - start.y) * f, { steps: 1 });
    const wait = t0 + (i * 1000) / N - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
  const { ts, down, up } = await page.evaluate(() => {
    const w = window as unknown as { __ts: number[]; __rec: boolean; __down: number; __up: number };
    w.__rec = false;
    return { ts: w.__ts, down: w.__down, up: w.__up };
  });
  // frame intervals that end between pointer down and one frame after pointer up
  const during: number[] = [];
  for (let i = 1; i < ts.length; i++) if (ts[i] > down && ts[i] <= up + 17) during.push(ts[i] - ts[i - 1]);
  expect(Number.isFinite(down) && Number.isFinite(up)).toBe(true);
  await expect(stepCount(page)).toHaveText('Adım 5 / 12');
  // the query followed the pointer to the end of the drag
  const qEnd = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(qEnd.x + qEnd.width / 2 - end.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(qEnd.y + qEnd.height / 2 - end.y)).toBeLessThanOrEqual(2);
  const p = p95(during);
  const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
  info.annotations.push({ type: 'drag', description: d });
  console.log('drag', d);
  expect(during.length).toBeGreaterThanOrEqual(30);
  expect(p).toBeLessThan(25);
});

test('lab click moves query', async ({ page }) => {
  await open(page, 'lab');
  const plot = (await page.locator('svg.plot rect.hit').boundingBox())!;
  await page.mouse.click(plot.x + plot.width * 0.3, plot.y + plot.height * 0.4);
  await expect(stepCount(page)).toHaveText('Adım 2 / 12');
  await page.waitForTimeout(800);
  // the query sits where the plot was clicked
  const q = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(q.x + q.width / 2 - (plot.x + plot.width * 0.3))).toBeLessThanOrEqual(2);
  expect(Math.abs(q.y + q.height / 2 - (plot.y + plot.height * 0.4))).toBeLessThanOrEqual(2);

  // a click in the plot's side margin (outside the data, inside the visible axes) lands where clicked
  const mx = plot.x + plot.width * 0.03;
  const my = plot.y + plot.height * 0.5;
  await page.mouse.click(mx, my);
  await page.waitForTimeout(800);
  const qm = (await page.locator('svg.plot rect.query').boundingBox())!;
  expect(Math.abs(qm.x + qm.width / 2 - mx)).toBeLessThanOrEqual(2);
  expect(Math.abs(qm.y + qm.height / 2 - my)).toBeLessThanOrEqual(2);

  await page.getByLabel('Anında sonuç').check();
  await page.mouse.click(plot.x + plot.width * 0.7, plot.y + plot.height * 0.6);
  await expect(stepCount(page)).toHaveText('Adım 5 / 12');
  await expect(page.locator('.prediction')).toBeVisible();
});
