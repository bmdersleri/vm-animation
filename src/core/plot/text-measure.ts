import type { Mode } from '../mode';

export interface Fonts { tick: number; axis: number; title: number }

/** Used when computed styles are unavailable (jsdom, theme not loaded); matches theme.css at 1280 px. */
const FALLBACK: Record<Mode, Fonts> = {
  lab: { tick: 13, axis: 14, title: 22 },
  ders: { tick: 18, axis: 19, title: 33 },
};

/**
 * Reads real font sizes and text widths from a hidden SVG <text> carrying the
 * same CSS class as the text being laid out. Only used on (re)layout, never per
 * frame. Falls back to estimates where layout is unavailable.
 */
export class TextMeasure {
  constructor(private readonly probe: SVGTextElement) {}

  private use(cls: string, text: string): void {
    this.probe.setAttribute('class', `probe ${cls}`);
    this.probe.textContent = text;
  }

  private done(): void {
    this.probe.setAttribute('class', 'probe');
    this.probe.textContent = '';
  }

  fontPx(cls: string, fallback: number): number {
    this.use(cls, 'M');
    const v = parseFloat(getComputedStyle(this.probe).fontSize);
    this.done();
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  fonts(mode: Mode): Fonts {
    const f = FALLBACK[mode];
    return {
      tick: this.fontPx('tick', f.tick),
      axis: this.fontPx('axis-title', f.axis),
      title: this.fontPx('prediction', f.title),
    };
  }

  /** Width in px of `text` rendered with class `cls`; estimate = 0.62 em per character. */
  width(text: string, cls: string, fontPx: number): number {
    this.use(cls, text);
    let w = 0;
    if (typeof this.probe.getComputedTextLength === 'function') {
      try { w = this.probe.getComputedTextLength(); } catch { w = 0; }
    }
    this.done();
    return w > 0 ? w : text.length * fontPx * 0.62;
  }

  maxWidth(texts: string[], cls: string, fontPx: number): number {
    return Math.max(0, ...texts.map((t) => this.width(t, cls, fontPx)));
  }
}
