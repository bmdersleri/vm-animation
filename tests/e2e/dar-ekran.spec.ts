import { test, expect, type Page } from '@playwright/test';
import { concepts } from '../../src/concepts/registry';
import { settled } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const ready = concepts.filter((c) => c.status === 'hazir' && c.href);
/** `<id> <mode>` whose page CSS sets its own narrow-screen stage height. */
/**
 * crisp-dm: on a phone the stage is tall (the cycle on top, the whole phase card under it); it grows to its
 * content and the page scrolls past the player bar, like capraz-dogrulama.
 * model-kaymasi: on a phone the stage is tall too (the charts with the accuracy strip, ten PSI rows, the alarm flow and
 * the code panel do not fit above the player bar); it grows to its content and the page scrolls.
 */
const TALL_STAGES = new Set([
  'capraz-dogrulama ders', 'capraz-dogrulama lab', 'roc-esik lab', 'crisp-dm ders', 'crisp-dm lab',
  'model-kaymasi ders', 'model-kaymasi lab',
]);

/** Boxes of the stage and every svg / canvas in it, read until they stop moving. */
const stageSettled = (page: Page): Promise<void> => settled(() => page.evaluate(() =>
  [...document.querySelectorAll('.stage, .stage svg, .stage canvas')].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  })));

/**
 * `<page> <step id>` of steps that are HTML (flow strip, sample cards, vocabulary strip, customer card, text cards, code panel) with at most a
 * small bar svg: the scene root counts. Every other step of the page is still measured by its largest svg, so a
 * collapsed sigmoid or matrix fails.
 */
const HTML_STEPS = new Set(['duygu-analizi gorev', 'duygu-analizi boru-hatti', 'duygu-analizi sizinti', 'duygu-analizi hata-ayiklama',
  'shap-degerleri kara-kutu', 'shap-degerleri sinirlar', 'lime-yerel yerel-soru', 'lime-yerel hata-ayiklama', 'model-kaymasi hata-ayiklama']);

async function checkStep(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(1);
  const box = await page.locator('.stage').boundingBox();
  expect(box, `${label}: stage box`).not.toBeNull();
  expect(box!.width, `${label}: stage width`).toBeLessThanOrEqual(390 + 1);
  // the whole stage shows above the sticky player bar, also under a two-line title;
  // pages that set a taller stage of their own scroll past the bar on purpose
  if (!TALL_STAGES.has(label.split(' step')[0])) {
    const under = await page.evaluate(() => {
      window.scrollTo(0, 0);
      const bar = document.querySelector('.player-bar')!.getBoundingClientRect();
      return document.querySelector('.stage')!.getBoundingClientRect().bottom - bar.top;
    });
    expect(under, `${label}: stage under the player bar`).toBeLessThanOrEqual(0.5);
  }
  // the scene's own drawing element: the largest svg/canvas in the stage that is rendered
  // (not hidden, so a collapsed one still counts and fails), or, when a step shows
  // only HTML cards, the first rendered scene root in the stage
  const stepId = await page.evaluate(() => document.querySelector('.stage [data-step]')?.getAttribute('data-step') ?? '');
  const htmlScene = HTML_STEPS.has(`${label.split(' ')[0]} ${stepId}`);
  const drawn = await page.evaluate((htmlOnly) => {
    const stage = document.querySelector('.stage')!;
    const boxes = [...stage.querySelectorAll('svg, canvas')]
      .filter((e) => !htmlOnly && e.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }))
      .map((e) => e.getBoundingClientRect());
    const biggest = boxes.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const root = [...stage.children].find((e) => e.checkVisibility({ checkVisibilityCSS: true }));
    const r = biggest ?? root?.getBoundingClientRect();
    return r ? { w: r.width, h: r.height } : null;
  }, htmlScene);
  expect(drawn, `${label}: scene element`).not.toBeNull();
  expect(drawn!.w, `${label}: scene width`).toBeGreaterThan(100);
  expect(drawn!.h, `${label}: scene height`).toBeGreaterThan(100);
}

test('every ready page fits 390 px in Ders and Lab', async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(ready.length).toBeGreaterThanOrEqual(17);
  for (const c of ready) {
    for (const mode of ['ders', 'lab'] as const) {
      await page.goto(`/${c.href}?mod=${mode}`);
      await expect(page.locator(`[data-mode="${mode}"]`).first()).toBeVisible({ timeout: 15_000 });
      const dots = page.locator('.step-dot');
      const n = await dots.count();
      await checkStep(page, `${c.id} ${mode} step 1`);
      await dots.nth(n - 1).click();
      await expect(page.locator('.step-count')).toHaveText(new RegExp(`Adım ${n} / ${n}`));
      await stageSettled(page);
      await checkStep(page, `${c.id} ${mode} step ${n}`);
    }
  }
});

test('confusion matrix digits stay inside their cells at 390 px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const mode of ['ders', 'lab'] as const) {
    await page.goto(`/karmasiklik-matrisi/?mod=${mode}`);
    await page.locator('.step-dot').nth(6).click();
    await expect(page.locator('.matrix-scene')).toHaveAttribute('data-step', '6');
    await settled(() => page.locator('[data-cell] .matrix-cell-bg, [data-cell] .matrix-count')
      .evaluateAll((es) => es.map((e) => JSON.stringify(e.getBoundingClientRect()))));
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const cell of document.querySelectorAll<SVGGElement>('[data-cell]')) {
        const bg = cell.querySelector<SVGRectElement>('.matrix-cell-bg')!.getBoundingClientRect();
        for (const t of cell.querySelectorAll<SVGTextElement>('.matrix-count')) {
          const r = t.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.left < bg.left - 0.5 || r.right > bg.right + 0.5 || r.top < bg.top - 0.5 || r.bottom > bg.bottom + 0.5) {
            out.push(`${cell.getAttribute('data-cell')} "${t.textContent}" text ${[r.left, r.top, r.right, r.bottom].map(Math.round)} cell ${[bg.left, bg.top, bg.right, bg.bottom].map(Math.round)}`);
          }
        }
      }
      return out;
    });
    expect(bad, mode).toEqual([]);
  }
});

test('tall scenes are not cut at 390 px', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cases = [
    { href: 'capraz-dogrulama/', step: 3 },
    { href: 'karmasiklik-matrisi/', step: 6 },
  ];
  for (const c of cases) {
    await page.goto(`/${c.href}?mod=ders`);
    await page.locator('.step-dot').nth(c.step).click();
    await expect(page.locator('.step-count')).toHaveText(new RegExp(`^Adım ${c.step + 1} / `));
    const r = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.stage')!;
      stage.scrollTop = stage.scrollHeight;
      const sb = stage.getBoundingClientRect();
      let maxBottom = 0;
      for (const e of stage.querySelectorAll('*')) {
        const b = e.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && !e.closest('[hidden]') && !e.closest('.matrix-sr-summary')) maxBottom = Math.max(maxBottom, b.bottom);
      }
      const note = document.querySelector('.matrix-note')?.getBoundingClientRect();
      return {
        stageBottom: sb.bottom, maxBottom, noteBottom: note?.bottom ?? null,
        scrolls: stage.scrollHeight > stage.clientHeight,
        overflowY: getComputedStyle(stage).overflowY,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    // the last content is reachable: either the stage fits it or it scrolls and shows it once scrolled to the end
    expect(r.maxBottom, c.href).toBeLessThanOrEqual(r.stageBottom + 1);
    if (r.scrolls) expect(r.overflowY, c.href).toBe('auto');
    if (r.noteBottom !== null) expect(r.noteBottom, `${c.href} note`).toBeLessThanOrEqual(r.stageBottom + 1);
    expect(r.pageOverflow, c.href).toBeLessThanOrEqual(1);
  }
});

test('dendrogram table step stacks tree above panel at 390 px in Ders and Lab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const mode of ['ders', 'lab'] as const) {
    await page.goto(`/dendrogram/?mod=${mode}`);
    const n = await page.locator('.step-dot').count();
    await page.locator('.step-dot').nth(n - 1).click();
    await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${n}`);
    await expect(page.locator('.dg-scene')).toHaveAttribute('data-view', 'table');
    const g = await page.evaluate(() => {
      const stage = document.querySelector('.stage')!.getBoundingClientRect();
      const tree = document.querySelector('.dg-tree')!.getBoundingClientRect();
      const panel = document.querySelector('.dg-panel')!.getBoundingClientRect();
      return { stageW: stage.width, treeW: tree.width, treeH: tree.height, treeBottom: tree.bottom, panelTop: panel.top };
    });
    expect(g.treeW, mode).toBeGreaterThanOrEqual(g.stageW * 0.9);
    expect(g.treeH, mode).toBeGreaterThanOrEqual(190);
    expect(g.treeBottom, mode).toBeLessThanOrEqual(g.panelTop + 1);
  }
});
