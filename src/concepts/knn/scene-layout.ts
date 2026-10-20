import { scaleLinear } from 'd3-scale';
import type { Mode } from '../../core/mode';
import type { Weighting } from './knn';
import type { FeatureSpace } from './space';
import type { Rect } from './viewport';

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

// ---------- number formatting (Turkish: 1.234,5 and U+2212 minus) ----------

const fmtCache = new Map<number, Intl.NumberFormat>();

export function formatNumber(v: number, decimals: number): string {
  let f = fmtCache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    fmtCache.set(decimals, f);
  }
  return f.format(v === 0 ? 0 : v).replace('-', '−');
}

/** Formatter with just enough decimals for evenly spaced d3 ticks (steps are 1, 2 or 5 × 10^n). */
export function tickFormat(ticks: number[]): (v: number) => string {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const dec = step > 0 ? Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9))) : 0;
  return (v) => formatNumber(v, dec);
}

// ---------- axis titles ----------

const Z_SUFFIX = ' — standartlaştırılmış (z)';

export function axisTitles(space: FeatureSpace): { x: string; y: string; suffix: string } {
  return {
    x: 'Sözleşme süresi (ay)',
    y: space.dataset === 'aylik' ? 'Aylık fatura (TL)' : 'Toplam fatura (TL)',
    suffix: space.scaled ? Z_SUFFIX : '',
  };
}

// ---------- vote strings (shared with the renderer so layout reserves the right width) ----------

export function voteLabel(cls: 0 | 1, score: number, w: Weighting): string {
  const s = w === 'esit' ? String(score) : formatNumber(score, 2);
  return cls === 0 ? `● Kaldı: ${s}` : `▲ Ayrıldı: ${s}`;
}

// ---------- layout ----------

export interface Layout {
  w: number;
  h: number;
  fonts: Fonts;
  plot: Rect;
  ptR: number;
  badgeR: number;
  querySide: number;
  queryLabelW: number;
  xTickCount: number;
  yTickCount: number;
  xTickY: number;
  yTickX: number;
  xTitle: { x: number; y: number; text: string };
  yTitle: { x: number; y: number; lines: string[] };
  vote: {
    barX: number; barY: number; barW: number; barH: number;
    leftLabelX: number; rightLabelX: number; labelY: number;
    predX: number; predY: number; predAnchor: 'start' | 'end';
  };
}

export function computeLayout(
  w: number, h: number, mode: Mode, space: FeatureSpace, weighting: Weighting, m: TextMeasure,
): Layout {
  const fonts = m.fonts(mode);
  const pad = 10;
  const gap = Math.round(fonts.tick * 0.45);
  const ptR = mode === 'ders' ? 9 : 7;

  // y tick label width from the data domain's ticks (plus one char for a minus sign)
  const yt = scaleLinear().domain(space.domain.y).ticks(6);
  const yFmt = tickFormat(yt);
  const yTickW = m.maxWidth(yt.map((v) => `${yFmt(v)}0`), 'tick', fonts.tick);

  // vote row: reserve the widest strings for this weighting so the row never jumps while dragging
  const big = weighting === 'esit' ? 15 : 88.88;
  const labelW = m.maxWidth([voteLabel(0, big, weighting), voteLabel(1, big, weighting)], 'vote-label', fonts.tick);
  const predMax = weighting === 'esit' ? 'Tahmin: AYRILACAK (15/15 oy)' : 'Tahmin: AYRILACAK (ağırlık payı %100)';
  const predW = m.width(predMax, 'prediction', fonts.title);
  const barH = Math.round(fonts.tick * 1.6);
  const predH = fonts.title * 1.25;

  const titles = axisTitles(space);
  const yFull = titles.y + titles.suffix;
  const yFullW = m.width(yFull, 'axis-title', fonts.axis);
  const right = pad + 10;
  const top = pad + 6;

  // first pass with a one-line y title; decide vote rows from the resulting plot width
  const leftFor = (lines: number): number => pad + lines * fonts.axis * 1.2 + gap + yTickW + gap;
  let left = leftFor(1);
  let plotW = Math.max(40, w - left - right);
  const minBar = Math.max(120, plotW * 0.2);
  const oneRow = plotW - 2 * labelW - 4 * gap - predW >= minBar;
  const voteH = oneRow ? Math.max(barH, predH) : barH + gap + predH;
  const bottom = gap + fonts.tick * 1.2 + gap + fonts.axis * 1.25 + gap * 1.5 + voteH + pad;
  const plotH = Math.max(40, h - top - bottom);
  const yLines = titles.suffix && yFullW > plotH * 0.95 ? [titles.y, titles.suffix] : [yFull];
  if (yLines.length === 2) {
    left = leftFor(2);
    plotW = Math.max(40, w - left - right);
  }

  const plot: Rect = { left, top, width: plotW, height: plotH };
  const plotBottom = top + plotH;
  const plotRight = left + plotW;
  const xTickY = plotBottom + gap + fonts.tick * 0.9;
  const xTitleY = xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95;
  const voteTop = xTitleY + fonts.axis * 0.3 + gap * 1.5;

  const barX = left + labelW + gap;
  const barW = oneRow ? plotW - 2 * labelW - 4 * gap - predW : plotW - 2 * labelW - 2 * gap;
  const rowH = oneRow ? Math.max(barH, predH) : barH;
  const barY = voteTop + (rowH - barH) / 2;

  return {
    w, h, fonts, plot, ptR,
    badgeR: Math.max(10, fonts.tick * 0.72),
    querySide: ptR * 3.2,
    queryLabelW: m.width('Yeni müşteri', 'query-label', fonts.tick),
    xTickCount: Math.max(2, Math.round(plotW / (fonts.tick * 6))),
    yTickCount: Math.max(2, Math.round(plotH / (fonts.tick * 3.2))),
    xTickY,
    yTickX: left - gap,
    xTitle: { x: left + plotW / 2, y: xTitleY, text: titles.x + titles.suffix },
    yTitle: { x: pad + fonts.axis * (0.95 + 0.6 * (yLines.length - 1)), y: top + plotH / 2, lines: yLines },
    vote: {
      barX, barY, barW: Math.max(20, barW), barH,
      leftLabelX: barX - gap,
      rightLabelX: barX + Math.max(20, barW) + gap,
      labelY: barY + barH / 2 + fonts.tick * 0.35,
      predX: oneRow ? plotRight : left,
      predY: oneRow ? voteTop + rowH / 2 + fonts.title * 0.35 : voteTop + barH + gap + fonts.title * 0.95,
      predAnchor: oneRow ? 'end' : 'start',
    },
  };
}
