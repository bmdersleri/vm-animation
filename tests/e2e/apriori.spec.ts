import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, outsideStage, overlaps, pageOverflow, settled, stepCount } from './helpers';

const PAGE = '/apriori/';
const READY = '.ap-node';
const STEPS = 11;
const TEXTS = '.ap-node, .ap-level, .stage p, .stage li';

/** Boxes of the lattice / FP-tree parts and the scan state, read until they come to rest. */
const sceneSettled = (page: Page) => settled(() => page.evaluate(() => [
  document.querySelector('.ap-scene')?.getAttribute('data-counting'),
  ...[...document.querySelectorAll('.ap-node, .ap-counter, .ap-fp-slot *')].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height, (e as HTMLElement).dataset.state ?? '', e.textContent];
  }),
]));

test('apriori: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('Apriori ve FP-Growth');
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
});

test('screenshots: ders key steps stay inside the stage', async ({ page }) => {
  // Reduced motion skips the basket-insertion sweep (step 9 shows all 18 baskets), so no sweep frame is captured.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const step of [3, 5, 9, 10]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, step - 1, STEPS, 0);
    await sceneSettled(page);
    expect(await outsideStage(page, TEXTS), `step ${step}`).toEqual([]);
    if (step < 9) expect(await overlaps(page, '.ap-node'), `step ${step}`).toEqual([]);
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    await expect(page).toHaveScreenshot(`apriori-ders-${step}.png`);
  }
});

test('ders: lattice nodes are not interactive', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 6, STEPS, 0);
  await expect(page.locator('.ap-node').first()).not.toHaveAttribute('role', 'button');
  await expect(page.locator('.ap-node-info')).toBeHidden();
});

test('lab: min_support recolours the lattice and a node click shows its reason', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, STEPS, 0);
  const sup = page.locator('input[data-param="minCount"]');
  const frequent = page.locator('.ap-node[data-state="frequent"]');
  await sup.fill('9');
  await expect(page.locator('output[for$="-sup"]')).toHaveText('0,500 · en az 9 fiş');
  await sceneSettled(page);
  const high = await frequent.count();
  await sup.fill('3');
  await sceneSettled(page);
  expect(await frequent.count()).toBeGreaterThan(high);
  await sup.fill('4');
  await sceneSettled(page);
  const node = page.locator('.ap-node[data-key="ekmek,sut"]');
  await node.click();
  await expect(node).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.ap-node-info')).toBeVisible();
  await expect(page.locator('.ap-node-info')).toHaveAttribute('data-key', 'ekmek,sut');
  expect(await outsideStage(page, TEXTS)).toEqual([]);
  expect(await overlaps(page, '.ap-node')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('apriori-lab-esik-dugum.png');
});

test('lab: the product picker chooses the conditional base', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 9, STEPS, 0);
  const chip = page.locator('.ap-chip[data-item="yumurta"]');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await sceneSettled(page);
  expect(await outsideStage(page, TEXTS)).toEqual([]);
});
