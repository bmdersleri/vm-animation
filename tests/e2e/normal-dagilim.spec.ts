import { test, expect, type Page } from '@playwright/test';
import { open, outsideStage, overlaps, pageOverflow, paramsOutside, settled, shownDisabledGroups } from './helpers';

const IDS = ['histogram', 'egri', 'mu-sigma', 'alan', 'kural', 'z-skor', 'carpik', 'olcekleme'];
const LABELS = [
  '.normal-plot .mark-label',
  '.normal-plot .ghost-label',
  '.normal-plot .band-label',
  '.normal-plot .marker-label',
  '.normal-plot .scene-link text',
  '.normal-plot .tick text',
  '.normal-plot .axis-title',
].join(', ');

test.use({ reducedMotion: 'reduce' });
async function step(page: Page, n: number) {
  await page.locator('.step-dot').nth(n - 1).click();
  await expect(page.locator('.step-count')).toHaveText(`Adım ${n} / 8`);
  await expect(page.locator('svg.normal-plot')).toHaveAttribute('data-view', IDS[n - 1]);
  await settled(() => page.locator('.normal-scene').innerHTML());
}

async function geometry(page: Page) {
  expect(await overlaps(page, LABELS)).toEqual([]);
  expect(await outsideStage(page, '.normal-plot text:not(.probe), .normal-scene .formula')).toEqual([]);
  expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
}

async function setRange(page: Page, key: string, value: string) {
  const control = page.locator(`input[data-param="${key}"]`);
  await expect(control).toBeVisible();
  await control.fill(value);
  await control.dispatchEvent('input');
  await settled(() => page.locator('.normal-scene').innerHTML());
}

for (const mode of ['ders', 'lab'] as const) {
  test(`${mode}: all steps fit and expose only active controls`, async ({ page }) => {
    await open(page, '/normal-dagilim/', mode, 'svg.normal-plot path.hist-bar');
    for (let n = 1; n <= 8; n++) {
      await step(page, n);
      await geometry(page);
      if (mode === 'lab') {
        expect(await paramsOutside(page)).toEqual([]);
        expect(await shownDisabledGroups(page)).toEqual([]);
      }
    }
  });
}
test('ders: key scenes and real continuation links', async ({ page }) => {
  await open(page, '/normal-dagilim/', 'ders', 'svg.normal-plot path.hist-bar');
  for (const n of [2, 5, 6, 7, 8]) {
    await step(page, n);
    await geometry(page);
    await expect(page).toHaveScreenshot(`normal-dagilim-ders-${n}.png`);
    if (n === 2) await expect(page.locator('path.curve')).toHaveCount(1);
    if (n === 5) await expect(page.locator('path.band')).toHaveCount(3);
    if (n === 6) {
      await expect(page.locator('.z-axis')).toHaveCount(1);
      await expect(page.locator('.marker-label')).toContainText('85');
    }
    if (n === 7) {
      await expect(page.locator('.mark.mean')).toHaveCount(1);
      await expect(page.locator('.mark.median')).toHaveCount(1);
    }
  }
  await expect(page.locator('.x-axis')).toHaveCount(0);
  await expect(page.locator('.z-axis')).toHaveCount(1);
  await expect(page.locator('a.scene-link')).toHaveCount(3);
  for (const target of ['dagilim-carpiklik', 'olcekleme', 'naive-bayes']) {
    const link = page.locator(`a.scene-link[href="../${target}/"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${target}/`));
    await expect(page.locator('h1.title')).toBeVisible();
    await page.goBack();
    await step(page, 8);
  }
});

test('lab: sigma and interval controls update curve and probability', async ({ page }) => {
  await open(page, '/normal-dagilim/', 'lab', 'svg.normal-plot path.hist-bar');
  await step(page, 3);
  const initial = await page.locator('path.curve').getAttribute('d');
  await setRange(page, 'sigma', '15');
  await expect(page.locator('path.curve')).not.toHaveAttribute('d', initial!);
  await expect(page.locator('.formula')).toContainText('15');
  await geometry(page);
  await expect(page).toHaveScreenshot('normal-dagilim-lab-3.png');
  await step(page, 4);
  await setRange(page, 'a', '80');
  await setRange(page, 'b', '60');
  await expect(page.locator('.formula')).toContainText('60');
  await expect(page.locator('.formula')).toContainText('80');
  await expect(page.locator('path.area')).toHaveAttribute('d', /.+/);
  await geometry(page);
  await expect(page).toHaveScreenshot('normal-dagilim-lab-4.png');
  await setRange(page, 'b', '80');
  await expect(page.locator('.formula')).toContainText('0,000');
});

test('ders 390px: long formula terms wrap and stay contained in viewport and formula container', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/normal-dagilim/', 'ders', 'svg.normal-plot path.hist-bar');
  for (const n of [2, 5, 7]) {
    await step(page, n);
    const uncontained = await page.evaluate(() => {
      const formula = document.querySelector('.normal-scene .formula');
      if (!formula) return ['no-formula'];
      const fb = formula.getBoundingClientRect();
      const terms = [...formula.querySelectorAll('.term')];
      const errors: string[] = [];
      for (const t of terms) {
        const rects = t.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < fb.left - 1 || r.right > fb.right + 1 || r.left < -1 || r.right > window.innerWidth + 1) {
            errors.push(
              `term "${t.textContent}" line ${i} [${Math.round(r.left)}, ${Math.round(r.right)}] ` +
                `outside fb [${Math.round(fb.left)}, ${Math.round(fb.right)}] or vw ${window.innerWidth}`,
            );
          }
        }
      }
      return errors;
    });
    expect(uncontained, `step ${n} formula terms`).toEqual([]);
  }
});

test('390px step 8: continuation links stay contained in plot host and Naive Bayes is clickable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['ders', 'lab'] as const) {
    await open(page, '/normal-dagilim/', mode, 'svg.normal-plot path.hist-bar');
    await step(page, 8);
    const result = await page.evaluate(() => {
      const host = document.querySelector('.normal-plot-host')!.getBoundingClientRect();
      const formula = document.querySelector('.normal-scene .formula')!.getBoundingClientRect();
      const links = [...document.querySelectorAll('a.scene-link')];
      const errors: string[] = [];
      if (links.length !== 3) errors.push(`expected 3 links, found ${links.length}`);
      for (const a of links) {
        const r = a.getBoundingClientRect();
        if (r.bottom > host.bottom + 1 || r.top < host.top - 1 || r.left < host.left - 1 || r.right > host.right + 1) {
          errors.push(
            `link "${a.textContent}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] ` +
              `outside host [${Math.round(host.left)},${Math.round(host.top)},${Math.round(host.right)},${Math.round(host.bottom)}]`,
          );
        }
        if (r.bottom > formula.top - 2 && r.top < formula.bottom) {
          errors.push(`link "${a.textContent}" overlaps formula`);
        }
      }
      return errors;
    });
    expect(result, `${mode} step 8 links`).toEqual([]);
  }
  const nbLink = page.locator('a.scene-link[href="../naive-bayes/"]');
  await expect(nbLink).toBeVisible();
  await nbLink.click();
  await expect(page).toHaveURL(/\/naive-bayes\//);
});

test('lab: label containment at slider limits and no collision at x=70', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
    await open(page, '/normal-dagilim/', 'lab', 'svg.normal-plot path.hist-bar');
    await step(page, 3);
    for (const muVal of ['30', '110']) {
      await setRange(page, 'mu', muVal);
      const outside = await page.evaluate(() => {
        const host = document.querySelector('.normal-plot-host')!.getBoundingClientRect();
        const meanLabel = document.querySelector('.normal-plot .mark.mean .mark-label');
        if (!meanLabel) return ['no-mean-label'];
        const r = meanLabel.getBoundingClientRect();
        const errs: string[] = [];
        if (r.left < host.left - 1 || r.right > host.right + 1) {
          errs.push(
            `mean label [${Math.round(r.left)}, ${Math.round(r.right)}] ` +
              `outside host [${Math.round(host.left)}, ${Math.round(host.right)}]`,
          );
        }
        return errs;
      });
      expect(outside, `width ${width} mu=${muVal}`).toEqual([]);
    }
    await step(page, 6);
    for (const xVal of ['30', '70', '110']) {
      await setRange(page, 'x', xVal);
      const labelCheck = await page.evaluate(() => {
        const host = document.querySelector('.normal-plot-host')!.getBoundingClientRect();
        const marker = document.querySelector('.normal-plot .marker-label');
        const mean = document.querySelector('.normal-plot .mark.mean .mark-label');
        if (!marker || !mean) return { outside: ['missing labels'], collides: false };
        const mr = marker.getBoundingClientRect();
        const er: string[] = [];
        if (mr.left < host.left - 1 || mr.right > host.right + 1) {
          er.push(
            `marker label [${Math.round(mr.left)}, ${Math.round(mr.right)}] ` +
              `outside host [${Math.round(host.left)}, ${Math.round(host.right)}]`,
          );
        }
        const mnr = mean.getBoundingClientRect();
        if (mnr.left < host.left - 1 || mnr.right > host.right + 1) {
          er.push(
            `mean label [${Math.round(mnr.left)}, ${Math.round(mnr.right)}] ` +
              `outside host [${Math.round(host.left)}, ${Math.round(host.right)}]`,
          );
        }
        const collides = !(mr.right < mnr.left || mr.left > mnr.right || mr.bottom < mnr.top || mr.top > mnr.bottom);
        return {
          outside: er,
          collides,
          mr: [mr.left, mr.top, mr.right, mr.bottom],
          mnr: [mnr.left, mnr.top, mnr.right, mnr.bottom],
        };
      });
      expect(labelCheck.outside, `width ${width} x=${xVal} outside`).toEqual([]);
      expect(labelCheck.collides, `width ${width} x=${xVal} mean/marker collision`).toBe(false);
    }
  }
});
