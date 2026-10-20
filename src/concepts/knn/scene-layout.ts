import { scaleLinear } from 'd3-scale';
import type { Mode } from '../../core/mode';
import type { Weighting } from './knn';
import { featureSpace, type FeatureSpace } from './space';
import type { Rect } from '../../core/plot/viewport';
import { formatNumber, tickFormat } from '../../core/plot/format';
import { TextMeasure, type Fonts } from '../../core/plot/text-measure';

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
    /** 'side': vote bar + prediction beside the plot (wide stages); 'below': one or two rows under it. */
    place: 'side' | 'below';
    barX: number; barY: number; barW: number; barH: number;
    leftLabelX: number; rightLabelX: number; labelY: number;
    predX: number; predY: number; predAnchor: 'start' | 'middle' | 'end';
    /** Put the "(… oy)" detail on its own line under "Tahmin: …" (dy in px), or 0 for one line. */
    predDetailDy: number;
  };
}

/**
 * Width / height of the plot rect when it is sized to the data. Scaled
 * spaces use their own (equal-aspect) domain; unscaled spaces (R11, independent
 * axes) borrow the aspect of the scaled view of the same dataset, so switching
 * scaling on and off keeps the same plot frame.
 */
function plotAspect(space: FeatureSpace): number {
  const d = (space.scaled ? space : featureSpace(space.dataset, true)).domain;
  const dx = d.x[1] - d.x[0];
  const dy = d.y[1] - d.y[0];
  return dx > 0 && dy > 0 ? dx / dy : 1;
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

  // vote strings: reserve the widest ones for this weighting so nothing jumps while dragging
  const big = weighting === 'esit' ? 15 : 88.88;
  const labelW = m.maxWidth([voteLabel(0, big, weighting), voteLabel(1, big, weighting)], 'vote-label', fonts.tick);
  const predHead = 'Tahmin: AYRILACAK';
  const predDetail = weighting === 'esit' ? '(15/15 oy)' : '(ağırlık payı %100)';
  const predW = m.width(`${predHead} ${predDetail}`, 'prediction', fonts.title);
  const predSplitW = Math.max(m.width(predHead, 'prediction', fonts.title), m.width(predDetail, 'prediction', fonts.title));
  const barH = Math.round(fonts.tick * 1.6);
  const predH = fonts.title * 1.25;

  const titles = axisTitles(space);
  const yFull = titles.y + titles.suffix;
  const yFullW = m.width(yFull, 'axis-title', fonts.axis);
  const xTitleText = titles.x + titles.suffix;
  const xTitleW = m.width(xTitleText, 'axis-title', fonts.axis);
  const right = pad + 10;
  const top = pad + 6;
  const leftFor = (lines: number): number => pad + lines * fonts.axis * 1.2 + gap + yTickW + gap;
  const yLinesFor = (plotH: number): string[] =>
    (titles.suffix && yFullW > plotH * 0.95 ? [titles.y, titles.suffix] : [yFull]);
  // x tick labels + x axis title under the plot
  const axisBelow = gap + fonts.tick * 1.2 + gap + fonts.axis * 1.25 + pad;

  let plot: Rect;
  let yLines: string[];
  let vote: Layout['vote'];

  // ---- side: the plot is sized to the data (fills the height), vote + prediction beside it
  const sPlotH = Math.max(40, h - top - axisBelow);
  const sLines = yLinesFor(sPlotH);
  const sLeft = leftFor(sLines.length);
  const sPlotW = Math.max(40, Math.min(sPlotH * plotAspect(space), w - sLeft - right));
  const sideGap = fonts.tick * 2;
  const sideX0 = sLeft + sPlotW + sideGap;
  const sideW = w - right - sideX0;
  const minBar = Math.max(120, fonts.tick * 8);
  const predOneLine = predW <= sideW;
  const predNeed = predOneLine ? predW : predSplitW;
  if (sideW >= Math.max(2 * labelW + 2 * gap + minBar, predNeed)) {
    plot = { left: sLeft, top, width: sPlotW, height: sPlotH };
    yLines = sLines;
    const barW = Math.max(minBar, Math.min(fonts.tick * 22, sideW - 2 * labelW - 2 * gap));
    const centre = sideX0 + sideW / 2;
    const barX = centre - barW / 2;
    const predLines = predOneLine ? 1 : 2;
    const blockH = barH + gap * 2 + predH * predLines;
    const barY = top + sPlotH / 2 - blockH / 2;
    vote = {
      place: 'side',
      barX, barY, barW, barH,
      leftLabelX: barX - gap,
      rightLabelX: barX + barW + gap,
      labelY: barY + barH / 2 + fonts.tick * 0.35,
      predX: centre,
      predY: barY + barH + gap * 2 + fonts.title * 0.95,
      predAnchor: 'middle',
      predDetailDy: predOneLine ? 0 : fonts.title * 1.2,
    };
  } else {
    // ---- below: the plot fills the stage width; vote row(s) under the x axis
    let left = leftFor(1);
    let plotW = Math.max(40, w - left - right);
    const oneRow = plotW - 2 * labelW - 4 * gap - predW >= Math.max(120, plotW * 0.2);
    const voteH = oneRow ? Math.max(barH, predH) : barH + gap + predH;
    const plotH = Math.max(40, h - top - (axisBelow - pad) - gap * 1.5 - voteH - pad);
    yLines = yLinesFor(plotH);
    if (yLines.length === 2) {
      left = leftFor(2);
      plotW = Math.max(40, w - left - right);
    }
    plot = { left, top, width: plotW, height: plotH };
    const xTitleY = top + plotH + gap + fonts.tick * 0.9 + fonts.tick * 0.3 + gap + fonts.axis * 0.95;
    const voteTop = xTitleY + fonts.axis * 0.3 + gap * 1.5;
    const barX = left + labelW + gap;
    const barW = Math.max(20, oneRow ? plotW - 2 * labelW - 4 * gap - predW : plotW - 2 * labelW - 2 * gap);
    const rowH = oneRow ? Math.max(barH, predH) : barH;
    const barY = voteTop + (rowH - barH) / 2;
    vote = {
      place: 'below',
      barX, barY, barW, barH,
      leftLabelX: barX - gap,
      rightLabelX: barX + barW + gap,
      labelY: barY + barH / 2 + fonts.tick * 0.35,
      predX: oneRow ? left + plotW : left,
      predY: oneRow ? voteTop + rowH / 2 + fonts.title * 0.35 : voteTop + barH + gap + fonts.title * 0.95,
      predAnchor: oneRow ? 'end' : 'start',
      predDetailDy: 0,
    };
  }

  const { left, width: plotW, height: plotH } = plot;
  const xTickY = top + plotH + gap + fonts.tick * 0.9;
  const xTitleY = xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95;
  // centred under the plot, but never running off the stage's left edge
  const xTitleX = Math.max(left + plotW / 2, pad + xTitleW / 2);

  return {
    w, h, fonts, plot, ptR,
    badgeR: Math.max(10, fonts.tick * 0.72),
    // diamond half-diagonal ≈ 1.6 point radii
    querySide: ptR * 1.6 * Math.SQRT2,
    queryLabelW: m.width('Yeni müşteri', 'query-label', fonts.tick),
    xTickCount: Math.max(2, Math.round(plotW / (fonts.tick * 6))),
    yTickCount: Math.max(2, Math.round(plotH / (fonts.tick * 3.2))),
    xTickY,
    yTickX: left - gap,
    xTitle: { x: xTitleX, y: xTitleY, text: xTitleText },
    yTitle: { x: pad + fonts.axis * (0.95 + 0.6 * (yLines.length - 1)), y: top + plotH / 2, lines: yLines },
    vote,
  };
}
