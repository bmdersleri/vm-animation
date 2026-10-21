import { test, expect, type Page } from '@playwright/test';
import { gotoStep, labelCollisions, open, outsideStage, overlaps, pageOverflow, stepCount } from './helpers';

const PAGE = '/k-means/';
const READY = 'svg.km-plot circle.cs-point';
const STEPS = 8;

test('k-means: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('K-Means döngüsü');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  for (const step of [3, 6, 7, 8]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS);
    // step 7 sweeps 11 frames; the shot is its end: the stuck inertia beside the good run
    if (step === 7) { await expect(page.locator('[data-compare]')).toBeVisible({ timeout: 15_000 }); await page.waitForTimeout(600); }
    expect(await outsideStage(page, '.km-plot text, .stage p, .stage li')).toEqual([]);
    expect(await labelCollisions(page, 'svg.km-plot'), `step ${step}`).toEqual([]);
    const o = await pageOverflow(page);
    expect(o.x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`k-means-ders-${step}.png`);
  }
});

test('ders: crowded bad start keeps the centre labels apart', async ({ page }) => {
  // Reduced motion draws each frame at once; frames 0 and 1 both show the crowded start centres (1,8 s window).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 6, STEPS, 0);
  await expect(page.locator('.km-scene')).toHaveAttribute('data-frame', /^[01]$/);
  expect(await labelCollisions(page, 'svg.km-plot')).toEqual([]);
});

/** Centre labels whose box centre is nearer another centre's plus than their own. */
function ambiguousLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const mid = (r: DOMRect): [number, number] => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const centres = [...document.querySelectorAll('svg.km-plot g.cs-center')];
    const plus = centres.map((g) => mid(g.querySelector('.cs-plus')!.getBoundingClientRect()));
    const out: string[] = [];
    centres.forEach((g, i) => {
      const [x, y] = mid(g.querySelector('.cs-center-label')!.getBoundingClientRect());
      const d = plus.map((p) => Math.hypot(p[0] - x, p[1] - y));
      if (d.some((v, k) => k !== i && v < d[i])) out.push(`M${i + 1}`);
    });
    return out;
  });
}

test('lab: crowded start frames keep the centre labels apart', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, STEPS, 0);
  // A frame button cancels the sweep; frame writes draw instantly.
  await page.locator('[data-act="next-frame"]').click();
  const prev = page.locator('[data-act="prev-frame"]');
  while (await prev.isEnabled()) await prev.click();
  for (let f = 0; f < 4; f++) {
    await expect(page.locator('.km-scene')).toHaveAttribute('data-frame', String(f));
    expect(await labelCollisions(page, 'svg.km-plot'), `frame ${f}`).toEqual([]);
    expect(await ambiguousLabels(page), `frame ${f}`).toEqual([]);
    await page.locator('[data-act="next-frame"]').click();
  }
});

test('screenshots: lab new start and loop play', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS);
  await page.locator('[data-act="new-start"]').click();
  await page.waitForTimeout(1200);
  expect(await labelCollisions(page, 'svg.km-plot')).toEqual([]);
  await expect(page).toHaveScreenshot('k-means-lab-new-start.png');
  // Loop play runs the chosen start to its last frame and stops there, on the same step.
  const loop = page.locator('[data-act="play-loop"]');
  await loop.click();
  await expect(loop).toHaveAttribute('aria-pressed', 'true');
  await expect(loop).toHaveAttribute('aria-pressed', 'false', { timeout: 20_000 });
  await expect(page.locator('.km-frame-out')).toHaveText(/^Çerçeve (\d+)\/\1 /);
  await expect(stepCount(page)).toHaveText(`Adım 3 / ${STEPS}`);
  await expect(page.locator('[data-run-info]')).toContainText('Başlangıç 2/12');
  await expect(page.locator('[data-stop]')).toBeVisible();
  expect(await overlaps(page, '.km-plot text')).toEqual([]);
  expect(await labelCollisions(page, 'svg.km-plot')).toEqual([]);
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot('k-means-lab-play.png');
});
