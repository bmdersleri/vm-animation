import { test, expect, type Page } from '@playwright/test';
import { fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

/*
 * The teacher's two red lines for the iqr-aykiri page, checked in a real
 * browser at 1280×720: text readable from the back row, nothing off screen or
 * overlapping. Performance budgets live in iqr-aykiri.perf.spec.ts.
 */

const PAGE = '/iqr-aykiri/';
const READY = 'svg.iqr-plot circle.pt';
const STEPS = 11;

/** Drive the extreme slider like a user would: set the value and fire `input`. */
async function setExtreme(page: Page, v: number): Promise<void> {
  await page.evaluate((x) => {
    const s = document.querySelector<HTMLInputElement>('input[data-param=extreme]')!;
    s.value = String(x);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await page.waitForTimeout(900);
}

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 1; i < STEPS; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${i + 1} / ${STEPS}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await expect(page.locator('path.pt.outlier')).toHaveAttribute('data-far', '0');
  await expect(page.locator('.formula')).toContainText('kırpınca 50,79');
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders readability at 1280×720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const min: Record<string, number> = {};
  for (let step = 0; step < STEPS; step++) {
    if (step > 0) await gotoStep(page, step, STEPS, 1200);
    const m: Record<string, number[]> = {
      cell: [...(await fontSizes(page, '.cell')), ...(await fontSizes(page, '.cell *:not(.rank):not(.cell-flag)'))],
      formula: [...(await fontSizes(page, '.formula')), ...(await fontSizes(page, '.formula *'))],
      title: await fontSizes(page, '.step-title'),
      term: await fontSizes(page, '.step-term'),
      small: await fontSizes(page, '.tick text, .axis-title, .mark-label, .pt-label, .arm-label, .zband-label, .rank, .pos-label, .cell-flag'),
    };
    expect(m.title.length, `step ${step + 1} title`).toBeGreaterThan(0);
    expect(m.term.length, `step ${step + 1} term`).toBeGreaterThan(0);
    expect(m.cell.length, `step ${step + 1} cells`).toBeGreaterThan(0);
    expect(m.formula.length, `step ${step + 1} formula`).toBeGreaterThan(0);
    expect(m.small.length, `step ${step + 1} labels`).toBeGreaterThan(0);
    const expected: Record<number, string[]> = {
      1: ['.mark-label'],
      2: ['.mark-label'],
      5: ['.rank'],
      8: ['.arm-label'],
    };
    for (const sel of expected[step] ?? []) {
      expect((await fontSizes(page, sel)).length, `step ${step + 1} ${sel}`).toBeGreaterThan(0);
    }
    for (const fs of [...m.cell, ...m.formula, ...m.term]) expect(fs, `step ${step + 1} text`).toBeGreaterThanOrEqual(22);
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
    expect(await outsideStage(page, '.iqr-scene text, .iqr-scene .cell, .iqr-scene .formula, .pos-mark'), `step ${step + 1}`).toEqual([]);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.formula')].filter((f) => f.scrollWidth > f.clientWidth).map((f) => f.textContent));
    expect(wide, `step ${step + 1} formula clipped`).toEqual([]);
  }
});

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: value labels never overlap`, async ({ page }) => {
    await open(page, PAGE, mode, READY);
    for (let step = 0; step < STEPS; step++) {
      if (step > 0) await gotoStep(page, step, STEPS, 1200);
      expect(await overlaps(page, '.mark-label, .pt-label, .arm-label, .zband-label'), `step ${step + 1}`).toEqual([]);
      // no label box touches an arm line either
      const onArm = await page.evaluate(() => {
        const out: string[] = [];
        const arms = [...document.querySelectorAll('line.arm')].map((a) => a.getBoundingClientRect());
        for (const t of document.querySelectorAll('.mark-label, .pt-label, .arm-label, .zband-label')) {
          const r = t.getBoundingClientRect();
          if (r.width === 0 || getComputedStyle(t).opacity === '0') continue;
          for (const a of arms) {
            if (Math.min(r.right, a.right) - Math.max(r.left, a.left) > 0.5 && Math.min(r.bottom, a.bottom + 1) - Math.max(r.top, a.top - 1) > 0.5) {
              out.push(`${t.getAttribute('class')} "${t.textContent}"`);
            }
          }
        }
        return out;
      });
      expect(onArm, `step ${step + 1} label on an arm line`).toEqual([]);
    }
  });
}

test('ders: the open params panel covers no part of the scene', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 8, STEPS);
  await page.locator('.params-toggle').click();
  await expect(page.locator('.params')).toBeVisible();
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const box = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
    return {
      params: box(document.querySelector('.params')!),
      stage: box(document.querySelector('.stage')!),
      marks: [...document.querySelectorAll('.iqr-scene :is(text, .cell, .formula, .pos-mark)')]
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

test('lab extreme slider moves the point and the marks', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 1, STEPS);
  await setExtreme(page, 300);
  await expect(page.locator('.mark.mean .mark-label')).toContainText('ortalama 85,43');
  await gotoStep(page, 2, STEPS);
  await expect(page.locator('.mark.median .mark-label')).toContainText('medyan 43,65');
  await setExtreme(page, 90);
  await expect(page.locator('.mark.median .mark-label')).toContainText('medyan 43,65');
  const fars = await page.locator('.iqr-plot .pt[data-far]').evaluateAll((els) => els.map((e) => e.getAttribute('data-far')));
  expect(fars).toContain('0');
  expect(fars).not.toContain('1');
});

test('lab: below the fence the outlier mark goes', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 8, STEPS);
  await setExtreme(page, 82);
  await expect(page.locator('path.pt.outlier')).toHaveCount(0);
  await expect(page.locator('.formula')).toContainText('Sınırların dışında gözlem yok');
  await setExtreme(page, 83);
  await expect(page.locator('path.pt.outlier')).toHaveCount(1);
});

test('lab: Sil drops the point and recomputes with n = 7', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 10, STEPS);
  await page.locator('input[name=action][value=sil]').check();
  await page.waitForTimeout(1200);
  await expect(page.locator('.formula')).toContainText('silince n = 7: Q1 = 40,40 · Q3 = 54,03 · sınırlar 19,96 / 74,46');
  await expect(page.locator('.pt.deleted')).toHaveCount(0);
  await expect(page.locator('.cell.deleted')).toHaveCount(1);
});

test('help lists D, K and C', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await page.keyboard.press('?');
  await expect(page.locator('.help')).toBeVisible();
  const items = await page.locator('.help li').allTextContents();
  for (const key of ['D', 'K', 'C']) {
    expect(items.some((t) => t.startsWith(`${key}:`)), key).toBe(true);
  }
});

test('screenshots: ders and lab key steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [
    ['ders', 1], ['ders', 4], ['ders', 8], ['ders', 9], ['ders', 10], ['ders', 11], ['lab', 2], ['lab', 9],
  ];
  for (const [mode, step] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, step - 1, STEPS, 1800);
    await expect(page).toHaveScreenshot(`iqr-aykiri-${mode}-${step}.png`);
  }
});
