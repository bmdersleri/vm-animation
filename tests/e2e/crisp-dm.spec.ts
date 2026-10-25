import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, open, outsideStage, overlaps, pageOverflow, paramsOutside, settled } from './helpers';

const PAGE = '/crisp-dm/';
const READY = '.crisp-stage';
const IDS = ['sorun', 'is-anlama', 'veri-anlama', 'veri-yeterli', 'eksik-sifir-degil', 'sizinti', 'modelleme', 'degerlendirme', 'ikinci-tur', 'hata-ayiklama'];
const STEPS = IDS.length;
/** Labels whose boxes must not run into each other (leaf elements only). */
const LABELS = '.crisp-stage svg text:not(.probe)';

test.use({ reducedMotion: 'reduce' });

/** Goes to step n and lets the scene come to rest. */
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / ${STEPS}`);
  await expect(page.locator('.crisp-stage')).toHaveAttribute('data-step', IDS[n - 1]);
  await settled(() => page.locator('.crisp-stage').innerHTML());
}

/** Scene boxes that must show all their content; the phase card scrolls on purpose. */
const BOXES = '.crisp-cycle-host, .phase-card, .result-board, .code-pre';
const SCROLLERS = '.phase-card, .code-pre';

/**
 * Step 10 puts the code box inside the phase card, which scrolls: below the card's own height the code box sticks
 * out of the stage rectangle, but it is reachable by scrolling the card (checked here: the card scrolls and
 * the code box ends inside its scrollable height). Such a box is the only one let through `clippedBoxes`' stage check.
 */
async function codeReachable(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const code of document.querySelectorAll<HTMLElement>('.code-pre')) {
      const card = code.closest<HTMLElement>('.phase-card');
      if (!card || code.getBoundingClientRect().width === 0) continue;
      if (!['auto', 'scroll'].includes(getComputedStyle(card).overflowY)) out.push('phase-card does not scroll');
      const reach = code.getBoundingClientRect().bottom - card.getBoundingClientRect().top + card.scrollTop;
      if (reach > card.scrollHeight + 1) out.push('code-pre is beyond the card scroll height');
    }
    return out;
  });
}

async function geometry(page: Page, at = '') {
  expect(await overlaps(page, LABELS), at).toEqual([]);
  expect(await outsideStage(page, LABELS), at).toEqual([]);
  expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
}

test('crisp-dm: page opens', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('h1.title')).toHaveText('CRISP-DM döngüsü: altı evre ve geri dönüşler');
  await expect(page.locator('.step-count')).toHaveText(`Adım 1 / ${STEPS}`);
});

test('ders: key scenes', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, PAGE, 'ders', READY);
  for (const n of [4, 8, 9, 10]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`crisp-dm-ders-${n}.png`);
  }
});

test('lab: every step fits and shows only its controls inside the card', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS; n++) {
    await step(page, n);
    await geometry(page, `step ${n}`);
    const clipped = (await clippedBoxes(page, BOXES, SCROLLERS)).filter((c) => c !== 'code-pre: outside the stage');
    expect(clipped, `step ${n}`).toEqual([]);
    expect(await codeReachable(page), `step ${n}`).toEqual([]);
    expect(await paramsOutside(page), `step ${n}`).toEqual([]);
  }
});

test('lab: step 8 leak passes evaluation and fails deployment, four days stop at the first decision', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await step(page, 8);
  await page.locator('input[data-param="leak"]').check();
  await page.locator('select[data-param="stock"]').selectOption('soran');
  await page.locator('select[data-param="days"]').selectOption('56');
  await settled(() => page.locator('.crisp-stage').innerHTML());
  await expect(page.locator('.step-count')).toHaveText(`Adım 8 / ${STEPS}`);
  await geometry(page);
  expect(await paramsOutside(page)).toEqual([]);
  // the leak makes the evaluation look good: both conditions hold
  await expect(page.locator('[data-col="eval"] .cond[data-ok="true"]')).toHaveCount(2);
  await page.locator('select[data-param="days"]').selectOption('4');
  await settled(() => page.locator('.crisp-stage').innerHTML());
  await expect(page.locator('.path-reason')).toHaveAttribute('data-node', 'd1');
  await page.locator('select[data-param="days"]').selectOption('56');
  await settled(() => page.locator('.crisp-stage').innerHTML());
  await geometry(page);
  await expect(page).toHaveScreenshot('crisp-dm-lab-8.png');
  // ... and the deployment column (next step) fails at least one condition
  await step(page, 9);
  await expect(page.locator('[data-col="deploy"] .cond[data-ok="false"]').first()).toBeVisible();
});
