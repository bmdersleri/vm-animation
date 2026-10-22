import { test, expect, type Locator, type Page } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets for the chapter 2 pages: "animations never stutter". They
 * are fixed; a miss is fixed in the code, never here. This file runs in the
 * `performans` project with one worker.
 */

interface Spec {
  name: string;
  path: string;
  ready: string;
  steps: number;
  step: number;
  handle: string;
  /** The drag path: pixel offsets from the handle's centre, in terms of the svg box. */
  end: (h: { x: number; y: number }, svg: { x: number; y: number; width: number; height: number }) => { x: number; y: number };
  svg: string;
}

const DRAGS: Spec[] = [
  {
    name: 'dagilim-carpiklik extreme value', path: '/dagilim-carpiklik/', ready: 'svg.dag-plot path.hist-bar', steps: 9, step: 7,
    handle: 'svg.dag-plot circle.drag-handle', svg: 'svg.dag-plot', end: (h, s) => ({ x: h.x + s.width * 0.3, y: h.y }),
  },
  {
    name: 'kutu-grafigi group end', path: '/kutu-grafigi/', ready: 'svg.kutu-plot rect.box', steps: 8, step: 5,
    handle: 'svg.kutu-plot circle.drag-handle[data-group="bilgisayar"]', svg: 'svg.kutu-plot', end: (h, s) => ({ x: h.x - s.width * 0.15, y: h.y }),
  },
  {
    name: 'korelasyon-isi-haritasi leverage point', path: '/korelasyon-isi-haritasi/', ready: 'svg.kor-plot g.panel', steps: 10, step: 6,
    handle: 'svg.kor-plot circle.leverage', svg: 'svg.kor-plot', end: (h, s) => ({ x: h.x, y: s.y + 6 }),
  },
];

async function record(page: Page): Promise<void> {
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
}

const centre = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

for (const s of DRAGS) {
  test(`${s.name} drag stays smooth`, async ({ page }, info) => {
    await open(page, s.path, 'lab', s.ready);
    await gotoStep(page, s.step - 1, s.steps, 1000);
    const handle = page.locator(s.handle);
    await expect(handle).toBeVisible();
    const svgBox = (await page.locator(s.svg).boundingBox())!;
    const start = await centre(handle);
    const end = s.end(start, svgBox);
    await record(page);
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
    const during: number[] = [];
    for (let i = 1; i < ts.length; i++) if (ts[i] > down && ts[i] <= up + 17) during.push(ts[i] - ts[i - 1]);
    expect(Number.isFinite(down) && Number.isFinite(up)).toBe(true);
    // the handle followed the pointer (it can sit on a clamp, but it must have moved)
    const moved = await centre(handle);
    expect(Math.hypot(moved.x - start.x, moved.y - start.y), 'handle moved').toBeGreaterThan(20);
    const p = p95(during);
    const d = `frames=${during.length} p95=${round(p)} ms max=${round(Math.max(...during))} ms`;
    info.annotations.push({ type: 'drag', description: d });
    console.log(`drag ${s.name}`, d);
    expect(during.length).toBeGreaterThanOrEqual(30);
    expect(p).toBeLessThan(25);
  });
}

interface RenderSpec {
  name: string;
  path: string;
  ready: string;
  steps: number;
  step: number;
  key: string;
  measure: string;
}

const RENDERS: RenderSpec[] = [
  { name: 'dagilim-carpiklik bin change', path: '/dagilim-carpiklik/', ready: 'svg.dag-plot path.hist-bar', steps: 9, step: 3, key: 'K', measure: 'dag-render' },
  { name: 'kutu-grafigi k sensitivity', path: '/kutu-grafigi/', ready: 'svg.kutu-plot rect.box', steps: 8, step: 5, key: 'K', measure: 'kutu-render' },
];

test.describe('render time', () => {
  for (const s of RENDERS) {
    test(`${s.name} renders under 16 ms`, async ({ page }, info) => {
      await open(page, s.path, 'lab', s.ready);
      await gotoStep(page, s.step - 1, s.steps, 1000);
      await page.evaluate((m) => performance.clearMeasures(m), s.measure);
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(s.key);
        await page.waitForTimeout(250);
      }
      const renders = await page.evaluate((m) => performance.getEntriesByName(m).map((e) => e.duration), s.measure);
      const pr = p95(renders);
      const d = `render n=${renders.length} p95=${round(pr)} ms max=${round(Math.max(...renders))} ms`;
      info.annotations.push({ type: 'render', description: d });
      console.log(`render ${s.name}`, d);
      expect(renders.length).toBeGreaterThanOrEqual(12);
      expect(pr).toBeLessThan(16);
    });
  }
});
