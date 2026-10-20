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
  await expect(page.locator(`[data-mode="${mode}"]`)).toBeVisible();
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
