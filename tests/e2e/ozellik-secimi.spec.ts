import { test, expect, type Page } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, paramsOutside, shownDisabledGroups, stepCount } from './helpers';

/*
 * The teacher's two red lines for the ozellik-secimi page, checked in a real
 * browser at 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Step numbers are 1-based (gotoStep takes N − 1). Performance
 * budgets live in ozellik-secimi.perf.spec.ts.
 */

const PAGE = '/ozellik-secimi/';
const READY = 'svg.secim-plot g.row path.dots';
const STEPS = 10;
/** RFE sweeps: 3 × 1200 ms (step 7) and 4 × 900 ms (step 9) plus the transition after the last tick. */
const SWEEP_DONE_MS = 4500;
const LABELS = '.row-value, .elim-label, .zero-note, .sub-label, .cut-label, .legend-label';
/** Max allowed empty height (px) between the visible content and the stage top / the formula strip in Lab. */
const LAB_BAND_MAX = 160;

const step = (page: Page, n: number, settleMs = 1500) => gotoStep(page, n - 1, STEPS, settleMs);
const settleFor = (n: number, other = 1200) => (n === 7 || n === 9 ? SWEEP_DONE_MS : other);
const row = (page: Page, col: string) => page.locator(`g.row[data-col=${col}]`);
const selectedCols = (page: Page) => page.locator('g.row.selected').evaluateAll((els) => els.map((e) => e.getAttribute('data-col')));
const setRange = (page: Page, param: string, v: number) => page.locator(`input[data-param=${param}]`).evaluate((el, x) => {
  (el as HTMLInputElement).value = String(x);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, v);

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(settleFor(i + 1, 500));
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('ul.both li')).toHaveCount(3);
  await expect(page.locator('.formula')).toContainText('SelectKBest ∩ RFE');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const expected: Record<number, string[]> = { 2: ['.row-value'], 5: ['.sub-label'], 6: ['.elim-label'] };
  const min: Record<string, number> = {};
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const m: Record<string, number[]> = {
      big: await fontSizes(page, '.formula, .formula *, .col-name, .intersect li, .intersect h3, .rule'),
      title: await fontSizes(page, '.step-title'),
      term: await fontSizes(page, '.step-term'),
      small: await fontSizes(page, LABELS),
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
  console.log('secim ders min font-size px', JSON.stringify(min));
});

test('ders: no page scroll and nothing offscreen', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const o = await pageOverflow(page);
    expect(o.x, `step ${n} x overflow`).toBeLessThanOrEqual(0);
    expect(o.y, `step ${n} y overflow`).toBeLessThanOrEqual(0);
    expect(await outsideStage(page, '.secim-scene text, .secim-scene .formula, .intersect li, .rule'), `step ${n}`).toEqual([]);
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
      expect(await overlaps(page, '.col-name, ' + LABELS), `step ${n}`).toEqual([]);
    }
  });
}

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 4);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const b4 = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return {
      params: b4(document.querySelector('.params')!),
      stage: b4(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll('.secim-scene :is(text, .formula, .intersect li, .rule)')]
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

test('ders: step 7 shows four elimination labels in order', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 7, 0);
  const labels = () => page.locator('text.elim-label').evaluateAll((els) => els.map((e) => e.textContent!.trim()).filter(Boolean));
  await expect.poll(labels, { timeout: 5000 }).toEqual(['tur 1']);
  await expect.poll(labels, { timeout: 5000 }).toContain('tur 2');
  await page.waitForTimeout(SWEEP_DONE_MS);
  for (const [i, col] of ['toplamUcret', 'sabitDeger', 'aylikUcret', 'hizmetSayisi'].entries()) {
    await expect(row(page, col).locator('text.elim-label'), col).toHaveText(`tur ${i + 1}`);
  }
  expect(await labels()).toHaveLength(4);
});

test('ders: step 9 replays RFE and keeps gurultuluOznitelik', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await step(page, 9, SWEEP_DONE_MS);
  expect(await selectedCols(page)).toEqual(['hizmetSayisi', 'musteriKidemAy', 'gurultuluOznitelik', 'destekTaleplerinSayisi']);
});

test('lab readability', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 2, 800); // step 1 shows no control; the variance threshold card is the first
  const text = await fontSizes(page, '.step-text');
  const labels = await fontSizes(page, '.params label');
  expect(text.length).toBeGreaterThan(0);
  expect(labels.length).toBeGreaterThan(0);
  for (const fs of [...text, ...labels]) expect(fs).toBeGreaterThanOrEqual(16);
  const d = `step-text ${Math.min(...text)} px, params label min ${Math.min(...labels)} px`;
  info.annotations.push({ type: 'lab font-size', description: d });
  console.log('secim lab font-size', d);
});

test('lab: k slider 1 → 7 changes the filled bars live', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 4, 1000);
  await setRange(page, 'k', 1);
  await page.waitForTimeout(300);
  expect(await selectedCols(page)).toEqual(['destekTaleplerinSayisi']);
  await setRange(page, 'k', 7);
  await page.waitForTimeout(300);
  await expect(page.locator('g.row.selected')).toHaveCount(7);
  await expect(row(page, 'sabitDeger')).toHaveClass(/eliminated/);
});

test('lab: variance threshold 10 drops destekTaleplerinSayisi', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 2, 1000);
  await page.locator('input[name=vt][value="10"]').check();
  await page.waitForTimeout(500);
  await expect(row(page, 'destekTaleplerinSayisi')).toHaveClass(/eliminated/);
  await expect(page.locator('.formula')).toContainText('3 sütun kalır');
});

test('lab: nSelect and scaling change the RFE result live', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 8, 1000);
  await setRange(page, 'nSelect', 2);
  await page.waitForTimeout(500);
  const sel = await selectedCols(page);
  expect(sel).not.toContain('musteriKidemAy');
  expect(sel).toContain('gurultuluOznitelik');
  expect(sel).toContain('destekTaleplerinSayisi');
  expect(await page.locator('text.elim-label').allTextContents()).toContain('tur 6');
  await page.keyboard.press('S');
  await page.waitForTimeout(500);
  const scaled = await selectedCols(page);
  expect(scaled).toContain('musteriKidemAy');
  expect(scaled).toContain('destekTaleplerinSayisi');
});

test('lab: the params card shows only the current controls and fits without scrolling', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n, 300));
    expect(await shownDisabledGroups(page), `step ${n} disabled group shown`).toEqual([]);
    expect(await paramsOutside(page), `step ${n} control outside the side column`).toEqual([]);
  }
});

test('lab: no large empty band in the stage', async ({ page }, info) => {
  await open(page, PAGE, 'lab', READY);
  const gaps: Record<number, { top: number; bottom: number }> = {};
  for (let n = 1; n <= STEPS; n++) {
    if (n > 1) await step(page, n, settleFor(n));
    const g = await page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect();
      const f = document.querySelector('.formula')!.getBoundingClientRect();
      /** Invisible through the element or any ancestor (hidden rows, faded strips). */
      const faded = (el: Element): boolean => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.opacity === '0' || cs.display === 'none' || cs.visibility === 'hidden' || e.hasAttribute('hidden')) return true;
        }
        return false;
      };
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of document.querySelectorAll('.secim-scene :is(.col-name, rect.bar, path.dots, .intersect li)')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || faded(el)) continue;
        if (r.top >= f.top - 1) continue; // the strip itself
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      return { top: top - stage.top, bottom: f.top - bottom };
    });
    gaps[n] = { top: Math.round(g.top), bottom: Math.round(g.bottom) };
    expect(g.top, `step ${n} band above the content (${JSON.stringify(gaps[n])})`).toBeLessThanOrEqual(LAB_BAND_MAX);
    expect(g.bottom, `step ${n} band below the content (${JSON.stringify(gaps[n])})`).toBeLessThanOrEqual(LAB_BAND_MAX);
  }
  info.annotations.push({ type: 'lab gaps px', description: JSON.stringify(gaps) });
  console.log('secim lab gaps px', JSON.stringify(gaps));
});

test('help lists V and S', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.keyboard.press('?');
  await expect(page.locator('.help')).toBeVisible();
  const items = await page.locator('.help li').allTextContents();
  for (const key of ['V', 'S']) {
    expect(items.some((t) => t.startsWith(`${key}:`)), key).toBe(true);
  }
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [
    ['ders', 1], ['ders', 2], ['ders', 3], ['ders', 5], ['ders', 7], ['ders', 9], ['ders', 10],
    ['lab', 2], ['lab', 8],
  ];
  for (const [mode, n] of shots) {
    await open(page, PAGE, mode, READY);
    await step(page, n, settleFor(n, 1800));
    await expect(page).toHaveScreenshot(`ozellik-secimi-${mode}-${n}.png`);
  }
});
