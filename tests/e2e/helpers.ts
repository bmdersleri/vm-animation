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
  await expect(page.locator(`[data-mode="${mode}"]`).first()).toBeVisible({ timeout: 15_000 });
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

/**
 * A pair that stacks on purpose: an `upper` text directly above a `lower` text inside the same `within`
 * ancestor, whose line boxes may touch by at most `maxShare` of the smaller box height. Text on one
 * baseline (the same top) never matches, so a tag drawn over its count still counts as an overlap.
 */
export interface Stack {
  upper: string;
  lower: string;
  within: string;
  maxShare: number;
}

/** Intersecting pairs among the visible matches (class + text of both); `stacks` names pairs that touch on purpose. */
export function overlaps(page: Page, selector: string, stacks: Stack[] = []): Promise<string[]> {
  return page.evaluate(([sel, rules]) => {
    const items: { el: Element; name: string; r: DOMRect }[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[hidden]') || cs.opacity === '0') continue;
      items.push({ el, name: `${el.getAttribute('class') ?? el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}"`, r });
    }
    const stacked = (a: (typeof items)[number], b: (typeof items)[number], depth: number): boolean =>
      rules.some((s) => {
        const [up, low] = a.el.matches(s.upper) && b.el.matches(s.lower) ? [a, b] : b.el.matches(s.upper) && a.el.matches(s.lower) ? [b, a] : [null, null];
        if (!up || !low) return false;
        const box = up.el.closest(s.within);
        return box !== null && box === low.el.closest(s.within) && up.r.top < low.r.top - 0.5 && depth <= s.maxShare * Math.min(up.r.height, low.r.height);
      });
    const out: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].r;
        const b = items[j].r;
        const depth = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && depth > 0.5 && !stacked(items[i], items[j], depth)) {
          out.push(`${items[i].name} x ${items[j].name}`);
        }
      }
    }
    return out;
  }, [selector, stacks] as const);
}

/**
 * Lab params card: every visible enabled input/select must sit fully inside the
 * viewport and inside the visible box of `.side` without scrolling; returns the offenders.
 */
export function paramsOutside(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const side = document.querySelector('.side')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.params input, .params select')) {
      if (el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      const inView = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
      const inSide = r.left >= side.left - 0.5 && r.top >= side.top - 0.5 && r.right <= side.right + 0.5 && r.bottom <= side.bottom + 0.5;
      if (!inView || !inSide) out.push(`${el.getAttribute('name') ?? el.getAttribute('data-param')}=${el.getAttribute('value') ?? ''} bottom ${Math.round(r.bottom)} (side ${Math.round(side.bottom)})`);
    }
    return out;
  });
}

/** Lab params card: control groups (fieldsets / .ctl) whose controls are all disabled yet still displayed. */
export function shownDisabledGroups(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const g of document.querySelectorAll<HTMLElement>('.params .ctl')) {
      const ins = [...g.querySelectorAll<HTMLInputElement>('input, select')];
      if (ins.length === 0 || !ins.every((i) => i.disabled)) continue;
      const r = g.getBoundingClientRect();
      if (getComputedStyle(g).display !== 'none' && r.height > 0 && !g.closest('[hidden]')) {
        out.push(g.querySelector('legend, label')?.textContent ?? 'group');
      }
    }
    return out;
  });
}

/**
 * Scatter label collisions inside `svgSel`: a centre or point label that intersects another label
 * or any centre's plus marker (plus–plus contact between close centres is not text and is ignored).
 */
export function labelCollisions(page: Page, svgSel: string): Promise<string[]> {
  return page.evaluate((root) => {
    const svg = document.querySelector(root)!;
    const name = (e: Element): string => `${e.getAttribute('class')} "${(e.textContent ?? '').trim()}"`;
    const shown = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.closest('[hidden]');
    };
    const labels = [...svg.querySelectorAll('.cs-center-label, .cs-ring-label')].filter((e) => (e.textContent ?? '').trim() !== '' && shown(e));
    const pluses = [...svg.querySelectorAll('.cs-plus')].filter(shown);
    const hit = (a: DOMRect, b: DOMRect): boolean =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const out: string[] = [];
    labels.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      for (const m of labels.slice(i + 1)) if (hit(r, m.getBoundingClientRect())) out.push(`${name(l)} x ${name(m)}`);
      pluses.forEach((p, j) => {
        if (hit(r, p.getBoundingClientRect())) out.push(`${name(l)} x plus M${j + 1}`);
      });
    });
    return out;
  }, svgSel);
}

/**
 * Wait until `read()` returns the same value on two consecutive polls (100 ms apart), i.e. the
 * animation or layout it reads has come to rest. Replaces a fixed `waitForTimeout`.
 */
export async function settled(read: () => Promise<unknown>, timeout = 10_000): Promise<void> {
  let last: string | undefined;
  await expect.poll(async () => {
    const now = JSON.stringify(await read());
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [100], timeout }).toBe(true);
}
