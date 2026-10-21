import { test, expect, type Locator, type Page } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the pca page, checked in a real browser at
 * 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Step numbers are 1-based (gotoStep takes N − 1). Performance
 * budgets live in pca.perf.spec.ts.
 */

const PAGE = '/pca/';
const READY = 'svg.pca-plot path.pts';
const STEPS = 13;
/** 61 × 50 ms sweep plus the transition after the last tick. */
const SWEEP_DONE_MS = 4200;
const LABELS = '.dir-label, .dir2-label, .gauge-label, .var-peak, .bar-label, .threshold-label, .cum-label, .panel-title, .legend-label, .newcust-label, .axis-title';

const step = (page: Page, n: number, settleMs = 1500) => gotoStep(page, n - 1, STEPS, settleMs);
const settleFor = (n: number, other = 1200) => (n === 3 ? SWEEP_DONE_MS : other);
const box = async (loc: Locator) => (await loc.boundingBox())!;
const attr = (loc: Locator, name: string) => loc.getAttribute(name);

/**
 * Exact on-screen size of an SVG shape, mapped through the screen CTM.
 * getBoundingClientRect() boxes the rotated local box, which is far too loose for
 * a shape inside the rotated `g.cloud`. A line is its two end points; a circles
 * path ("M x−r,y a r,r …" per dot, see dots-path.ts) is its dot centres, widened by r.
 */
const screenBox = (loc: Locator) => loc.evaluate((el) => {
  const m = (el as unknown as SVGGraphicsElement).getScreenCTM()!;
  const pts: { x: number; y: number }[] = [];
  let r = 0;
  if (el instanceof SVGLineElement) {
    pts.push({ x: el.x1.baseVal.value, y: el.y1.baseVal.value }, { x: el.x2.baseVal.value, y: el.y2.baseVal.value });
  } else {
    const d = el.getAttribute('d')!;
    r = Number(/a([\d.]+),/.exec(d)![1]);
    for (const q of d.matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)) pts.push({ x: Number(q[1]) + r, y: Number(q[2]) });
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const q of pts) {
    xs.push(m.a * q.x + m.c * q.y + m.e);
    ys.push(m.b * q.x + m.d * q.y + m.f);
  }
  return { width: Math.max(...xs) - Math.min(...xs) + 2 * r, height: Math.max(...ys) - Math.min(...ys) + 2 * r };
});

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(i + 1 === 3 ? SWEEP_DONE_MS : 500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('.rule-box')).toHaveCount(3);
  await expect(page.locator('.formula')).toContainText('PCA sıkıştırır');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const expected: Record<number, string[]> = {
    2: ['.gauge-label'], 4: ['.dir-label'], 9: ['.bar-label'], 10: ['.threshold-label', '.cum-label'], 11: ['.panel-title'],
  };
  const min: Record<string, number> = {};
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const m: Record<string, number[]> = {
      big: await fontSizes(page, '.formula, .formula *, .rule-box'),
      title: await fontSizes(page, '.step-title'),
      term: await fontSizes(page, '.step-term'),
      small: await fontSizes(page, `.tick text, ${LABELS}`),
    };
    expect(m.title.length, `step ${n} title`).toBeGreaterThan(0);
    expect(m.term.length, `step ${n} term`).toBeGreaterThan(0);
    expect(m.big.length, `step ${n} formula`).toBeGreaterThan(0);
    for (const sel of expected[n] ?? []) {
      expect((await fontSizes(page, sel)).length, `step ${n} ${sel}`).toBeGreaterThan(0);
    }
    for (const fs of [...m.big, ...m.term]) expect(fs, `step ${n} text`).toBeGreaterThanOrEqual(22);
    for (const fs of m.title) expect(fs, `step ${n} title size`).toBeGreaterThanOrEqual(32);
    for (const fs of m.small) expect(fs, `step ${n} label`).toBeGreaterThanOrEqual(18);
    for (const k of Object.keys(m)) if (m[k].length) min[`${n}.${k}`] = Math.min(...m[k]);
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(min) });
  console.log('ders min font-size px', JSON.stringify(min));
});

test('ders: no page scroll and nothing offscreen', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const o = await pageOverflow(page);
    expect(o.x, `step ${n} x overflow`).toBeLessThanOrEqual(0);
    expect(o.y, `step ${n} y overflow`).toBeLessThanOrEqual(0);
    expect(await outsideStage(page, '.pca-scene text, .pca-scene .formula, .rule-box'), `step ${n}`).toEqual([]);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.formula')].filter((f) => f.scrollWidth > f.clientWidth).map((f) => f.textContent));
    expect(wide, `step ${n} formula clipped`).toEqual([]);
  }
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: labels never overlap`, async ({ page }) => {
    await open(page, PAGE, mode, READY);
    for (let n = 1; n <= STEPS; n++) {
      if (n > 1) await step(page, n, settleFor(n));
      expect(await overlaps(page, LABELS), `step ${n}`).toEqual([]);
    }
  });
}

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 10);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const b4 = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return {
      params: b4(document.querySelector('.params')!),
      stage: b4(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll('.pca-scene :is(text, .formula, .rule-box)')]
        .filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]')).map(b4),
    };
  });
  expect(r.marks.length).toBeGreaterThan(0);
  expect(r.stage.r).toBeLessThanOrEqual(r.params.l + 1);
  for (const m of r.marks) {
    expect(m.r <= r.params.l || m.l >= r.params.r || m.b <= r.params.t || m.t >= r.params.b, JSON.stringify(m)).toBe(true);
    expect(m.r).toBeLessThanOrEqual(r.stage.r + 1);
  }
});

test('ders: step 3 sweep ends with the curve peak at 45°', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 3, SWEEP_DONE_MS);
  await expect(page.locator('text.var-peak')).toHaveText('en büyük: θ = 45°');
  await expect(page.locator('.formula')).toContainText('en büyük varyans θ = 45°’de: 1,83');
});

test('ders: step 4 shows PC1 at 45°', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 4);
  await expect(page.locator('line.dir')).toHaveAttribute('data-theta', '45');
  await expect(page.locator('text.dir-label')).toHaveText('PC1');
  const b = await screenBox(page.locator('line.dir'));
  expect(Math.abs(b.width - b.height)).toBeLessThanOrEqual(4);
});

test('ders: step 6 rotates the cloud so PC1 is horizontal', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 6);
  expect((await screenBox(page.locator('line.dir'))).height).toBeLessThanOrEqual(4);
  await expect(page.locator('text.axis-title.x', { hasText: 'PC1' })).toHaveText('PC1');
});

test('ders: step 7 flattens the cloud onto PC1', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 7);
  // 2 r + outline + rounding
  expect((await screenBox(page.locator('g.cloud path.pts'))).height).toBeLessThanOrEqual(12);
});

test('ders: step 8 PC1 sticks to the vertical axis', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 8);
  expect((await screenBox(page.locator('line.dir'))).width).toBeLessThanOrEqual(4);
  await expect(page.locator('text.var-peak')).toHaveText('en büyük: θ = 90°');
  const f = (await page.locator('.formula').textContent())!;
  expect(f).toContain('PC1 = (0,0008; 1,0000)');
  expect(f).toContain('%99,99997');
  expect(f).not.toContain('%100');
});

test('ders: step 12 PCA keeps every point, t-SNE map moves', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 11, 2500);
  const pcaD = await attr(page.locator('g.panel.pca path.pts.c0'), 'd');
  const first = (await attr(page.locator('g.panel.tsne'), 'data-first'))!;
  await step(page, 12, 2500);
  expect(await attr(page.locator('g.panel.pca path.pts.c0'), 'd')).toBe(pcaD);
  const now = (await attr(page.locator('g.panel.tsne'), 'data-first'))!;
  const [x0, y0] = first.split(',').map(Number);
  const [x1, y1] = now.split(',').map(Number);
  const frame = await box(page.locator('g.panel.tsne rect.frame'));
  expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(frame.width * 0.25);
  await expect(page.locator('g.panel.pca path.newcust')).toBeVisible();
  await expect(page.locator('g.panel.tsne path.newcust')).toBeVisible();
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

test('lab drag rotates the direction and updates the gauge', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 2, 1000);
  const hit = await box(page.locator('rect.hit'));
  const c = { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 };
  const gauge = await page.locator('text.gauge-label').textContent();
  const r = Math.min(hit.width, hit.height) * 0.3;
  await page.mouse.move(c.x + r, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    // an arc from 0° through 90° to 135° (counter-clockwise on screen)
    const a = (((135 * i) / 20) * Math.PI) / 180;
    await page.mouse.move(c.x + r * Math.cos(a), c.y - r * Math.sin(a));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  const theta = Number(await attr(page.locator('line.dir'), 'data-theta'));
  expect(theta).toBeGreaterThanOrEqual(120);
  expect(theta).toBeLessThanOrEqual(150);
  expect(await page.locator('text.gauge-label').textContent()).not.toBe(gauge);
  expect(Number(await page.locator('input[data-param=theta]').inputValue())).toBe(theta);
});

test('lab: ×1000 moves the curve peak to 90° and PC1’i bul follows', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 4, 1000);
  await page.locator('input[name=birim][value="1000"]').check();
  await page.waitForTimeout(1200);
  await expect(page.locator('text.var-peak')).toHaveText('en büyük: θ = 90°');
  await page.locator('button.find-pc1').click();
  await page.waitForTimeout(1200);
  await expect(page.locator('line.dir')).toHaveAttribute('data-theta', '90');
  await expect(page.locator('text.dir-label')).toHaveText('PC1');
});

test('lab: threshold slider 50 → 2, 90 → 3, 99 → 9', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 10, 1000);
  const slider = page.locator('input[data-param=threshold]');
  for (const [t, k] of [[50, 2], [90, 3], [99, 9]]) {
    await slider.evaluate((el, v) => {
      (el as HTMLInputElement).value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, t);
    await page.waitForTimeout(800);
    await expect(page.locator('g.scree')).toHaveAttribute('data-k', String(k));
    const out = (await page.locator('.params output').filter({ hasText: '%' }).first().textContent())!;
    expect(out).toContain(`%${t}`);
    expect(out).toContain(String(k));
  }
});

test('lab: perplexity 5 and 50 switch the t-SNE map', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 11, 1000);
  const pcaD = await attr(page.locator('g.panel.pca path.pts.c0'), 'd');
  await expect(page.locator('g.panel.tsne')).toHaveAttribute('data-embed', 'p30');
  for (const [p, key] of [['5', 'p5'], ['50', 'p50']]) {
    await page.locator(`input[name=perplexity][value="${p}"]`).check();
    await page.waitForTimeout(1500);
    await expect(page.locator('g.panel.tsne')).toHaveAttribute('data-embed', key);
    expect(await attr(page.locator('g.panel.pca path.pts.c0'), 'd')).toBe(pcaD);
  }
});

test('lab: the params card shows only the current controls and fits without scrolling', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n, 300));
    expect(await shownDisabledGroups(page), `step ${n} disabled group shown`).toEqual([]);
    expect(await paramsOutside(page), `step ${n} control outside the side column`).toEqual([]);
  }
});

/** Max allowed empty height (px) between the visible content and the stage top / the formula strip in Lab. */
const LAB_BAND_MAX = 160;

test('lab: no large empty band in the stage', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  const gaps: Record<number, { top: number; bottom: number }> = {};
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const g = await page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect();
      const f = document.querySelector('.formula')!.getBoundingClientRect();
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of document.querySelectorAll('.pca-scene :is(text, path.pts, rect.bar, rect.frame, .rule-box)')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.opacity === '0' || cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
        if (r.top >= f.top - 1) continue; // the strip itself
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      return { top: top - stage.top, bottom: f.top - bottom };
    });
    gaps[n] = { top: Math.round(g.top), bottom: Math.round(g.bottom) };
    expect(g.top, `step ${n} band above the content`).toBeLessThanOrEqual(LAB_BAND_MAX);
    expect(g.bottom, `step ${n} band below the content`).toBeLessThanOrEqual(LAB_BAND_MAX);
  }
  info.annotations.push({ type: 'lab gaps px', description: JSON.stringify(gaps) });
  console.log('pca lab gaps px', JSON.stringify(gaps));
});

test('help lists B, Y and T', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.keyboard.press('?');
  await expect(page.locator('.help')).toBeVisible();
  const items = await page.locator('.help li').allTextContents();
  for (const key of ['B', 'Y', 'T']) {
    expect(items.some((t) => t.startsWith(`${key}:`)), key).toBe(true);
  }
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [
    ['ders', 3], ['ders', 4], ['ders', 6], ['ders', 7], ['ders', 8], ['ders', 10], ['ders', 12], ['ders', 13],
    ['lab', 2], ['lab', 10], ['lab', 12],
  ];
  for (const [mode, n] of shots) {
    await open(page, PAGE, mode, READY);
    await step(page, n, n === 3 ? SWEEP_DONE_MS : 1800);
    await expect(page).toHaveScreenshot(`pca-${mode}-${n}.png`);
  }
});
