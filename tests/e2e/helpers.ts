import { expect, type Page } from '@playwright/test';

export const stepCount = (page: Page) => page.locator('.step-count');

/** Jump to a step by its dot (index 0-based) and let the transitions settle. */
export async function gotoStep(page: Page, index: number, count: number, settleMs = 1500): Promise<void> {
  await page.locator('.step-dot').nth(index).click();
  await expect(stepCount(page)).toHaveText(`Adım ${index + 1} / ${count}`);
  await page.waitForTimeout(settleMs);
}

/** Open a page in a mode; `ready` is a selector that shows the scene is ready. */
export async function open(page: Page, path: string, mode: 'ders' | 'lab', ready: string): Promise<void> {
  await page.goto(`${path}?mod=${mode}`);
  await expect(page.locator(`[data-mode="${mode}"]`).first()).toBeVisible();
  await expect(page.locator(ready).first()).toBeAttached();
}

/** Computed font sizes (px) of every rendered, visible element matching the selector. */
export function fontSizes(page: Page, selector: string): Promise<number[]> {
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

export function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}

export const round = (x: number): number => Math.round(x * 100) / 100;

/** How far the document root overflows the viewport (≤ 0 means no scroll). */
export function pageOverflow(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

/** Visible matches whose box sticks out of the `.stage` box by more than 1 px (class + text). */
export function outsideStage(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const s = document.querySelector('.stage')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[hidden]') || cs.opacity === '0') continue;
      if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) {
        out.push(`${el.getAttribute('class') ?? el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
      }
    }
    return out;
  }, selector);
}

/** Intersecting pairs among the visible matches (class + text of both). */
export function overlaps(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const items: { name: string; r: DOMRect }[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[hidden]') || cs.opacity === '0') continue;
      items.push({ name: `${el.getAttribute('class') ?? el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}"`, r });
    }
    const out: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].r;
        const b = items[j].r;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) {
          out.push(`${items[i].name} x ${items[j].name}`);
        }
      }
    }
    return out;
  }, selector);
}
