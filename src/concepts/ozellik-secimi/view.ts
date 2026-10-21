import { formatNonZero, formatNumber, formatPercent } from '../../core/plot/format';
import { std0 } from '../../core/stats';
import { CHURN, COLUMNS, RFE, VALUES } from './data';
import {
  F_SCORES, VARIANCES, names, rfeSelected, rfeState, scoreOrder, selectKBest, varianceSupport,
} from './select';
import { ozellikSecimiScenario, type SecimParams } from './scenario';

export type SecimPart = 1 | 2;
export type SecimMode = 'strips' | 'variance' | 'fscore' | 'kbest' | 'split' | 'rfe' | 'intersect';

export interface RowView {
  col: number;
  name: string;
  /** Vertical position 0-7 (0-1 when split). */
  slot: number;
  /** Value label on the right: variance, F or |β|; NaN F reads "—". */
  value: string | null;
  zeroNote: boolean;
  /** 0-1 width share; null shows the strip instead. */
  bar: number | null;
  selected: boolean;
  eliminated: boolean;
  /** "elendi" or "tur 3". */
  elimLabel: string | null;
  highlight: boolean;
  split: boolean;
  hidden: boolean;
}
export interface SecimView {
  part: SecimPart;
  stepId: string;
  mode: SecimMode;
  /** Always 8 rows, in COLUMNS order. */
  rows: RowView[];
  cut: { col: 3; value: 12; label: '12 ay' } | null;
  intersect: { kbest: string[]; rfe: string[]; both: string[]; kbestTitle: string; rfeTitle: string } | null;
  rule: boolean;
  strip: string;
  note: string;
}

const MODES: readonly SecimMode[] = ['strips', 'variance', 'fscore', 'kbest', 'split', 'rfe', 'rfe', 'rfe', 'rfe', 'intersect'];
const KIDEM = COLUMNS.indexOf('musteriKidemAy');
const GURULTU = COLUMNS.indexOf('gurultuluOznitelik');
const DESTEK = COLUMNS.indexOf('destekTaleplerinSayisi');
const TOPLAM = COLUMNS.indexOf('toplamUcret');

const fv = (v: number): string => formatNonZero(v, 2);
const fF = (v: number): string => (Number.isNaN(v) ? '—' : fv(v));
const join = (xs: readonly string[]): string => xs.join(' · ');
const tr = (t: number): string => String(t).replace('.', ',');

export function deriveSecimView(index: number, p: SecimParams): SecimView {
  const mode = MODES[index];
  const part: SecimPart = index <= 4 ? 1 : 2;
  const supported = varianceSupport(VARIANCES, p.vt);
  const kbest = selectKBest(F_SCORES, p.k);
  const order = scoreOrder(F_SCORES);
  const path = RFE[p.scaling];
  const state = rfeState(path, p.nSelect, p.rounds);
  const finished = state.shown === COLUMNS.length - p.nSelect;
  const kbestNames = names(kbest);
  const rfeNames = names(rfeSelected(path, p.nSelect));
  const maxF = Math.max(...F_SCORES.filter((f) => !Number.isNaN(f)));
  const maxCoef = Math.max(...state.coef.values());
  const roundOf = new Map(state.eliminated.map((e) => [e.col, e.round]));

  const rows: RowView[] = COLUMNS.map((name, col) => {
    const row: RowView = {
      col, name, slot: col, value: null, zeroNote: false, bar: null,
      selected: false, eliminated: false, elimLabel: null, highlight: false, split: false, hidden: false,
    };
    switch (mode) {
      case 'variance':
        row.value = fv(VARIANCES[col]);
        row.eliminated = !supported[col];
        break;
      case 'fscore':
      case 'kbest': {
        const f = F_SCORES[col];
        row.slot = order.indexOf(col);
        row.value = fF(f);
        row.zeroNote = Number.isNaN(f);
        row.bar = Number.isNaN(f) ? 0 : f / maxF;
        if (mode === 'kbest') {
          row.selected = kbest[col];
          row.eliminated = !kbest[col];
        }
        break;
      }
      case 'split':
        row.split = col === KIDEM || col === GURULTU;
        row.hidden = !row.split;
        if (row.split) {
          row.slot = col === KIDEM ? 0 : 1;
          row.value = `F = ${fv(F_SCORES[col])}`;
        }
        break;
      case 'rfe': {
        const coef = state.coef.get(col);
        row.value = coef === undefined ? null : formatNonZero(coef, 4);
        row.bar = coef === undefined ? 0 : coef / maxCoef;
        row.eliminated = roundOf.has(col);
        row.elimLabel = row.eliminated ? `tur ${roundOf.get(col)}` : null;
        row.selected = finished && !row.eliminated;
        row.highlight = index === 7 && col === GURULTU && !row.eliminated;
        break;
      }
      case 'intersect':
        row.hidden = true;
        break;
      case 'strips':
        break;
    }
    if (row.eliminated && row.elimLabel === null) row.elimLabel = 'elendi';
    return row;
  });

  const intersect = mode === 'intersect'
    ? {
      kbest: kbestNames,
      rfe: rfeNames,
      both: kbestNames.filter((n) => rfeNames.includes(n)),
      kbestTitle: `SelectKBest (k = ${p.k})`,
      rfeTitle: `RFE (n = ${p.nSelect})`,
    }
    : null;

  return {
    part,
    stepId: ozellikSecimiScenario.steps[index].id,
    mode,
    rows,
    cut: mode === 'split' ? { col: 3, value: 12, label: '12 ay' } : null,
    intersect,
    rule: mode === 'intersect',
    strip: stripFor(),
    note: noteFor(),
  };

  function rfeCall(): string {
    return `RFE(LogisticRegression(max_iter=1000), n_features_to_select=${p.nSelect})`;
  }

  function rounds(): string {
    return state.shown === 0
      ? 'henüz eleme yok'
      : join(state.eliminated.map((e) => `tur ${e.round}: ${COLUMNS[e.col]}`));
  }

  function stripFor(): string {
    switch (index) {
      case 0:
        return `${CHURN.length} müşteri · ${COLUMNS.length} sütun · churn ${formatPercent(CHURN.reduce<number>((a, b) => a + b, 0) / CHURN.length, 2)}`;
      case 1: {
        const gone = COLUMNS.filter((_, c) => !supported[c]);
        return `VarianceThreshold(threshold=${p.vt}) → ${COLUMNS.length - gone.length} sütun kalır · elenen: ${join(gone)}`;
      }
      case 2:
        return `f_classif: ${join(order.slice(0, 4).map((c) => `${COLUMNS[c]} ${fv(F_SCORES[c])}`))} · …`;
      case 3:
        return `SelectKBest(f_classif, k=${p.k}) → ${join(kbestNames)}`;
      case 4:
        return join([KIDEM, GURULTU].map((c) => `${COLUMNS[c]}: F = ${fv(F_SCORES[c])}`));
      case 5: {
        const last = state.lastElim;
        const second = last === null
          ? 'henüz eleme yok'
          : `tur ${state.shown} → ${COLUMNS[last]} elendi (|β| = ${formatNonZero(state.coef.get(last)!, 4)})`;
        return `${rfeCall()}\n${second}`;
      }
      case 6:
        return `${rfeCall()}\n${rounds()}`;
      case 7:
        return `RFE → ${join(rfeNames)}\nσ: ${join([GURULTU, KIDEM].map((c) => `${COLUMNS[c]} ${formatNumber(std0(VALUES[c]), 2)}`))}`;
      case 8: {
        const head = p.scaling === 'standard' ? 'StandardScaler + RFE' : 'RFE';
        return `${finished ? `${head} → ${join(rfeNames)}` : `${head}: turlar yeniden oynuyor`}\n${rounds()}`;
      }
      default:
        return `SelectKBest ∩ RFE → ${join(intersect!.both)}`;
    }
  }

  function noteFor(): string {
    const list = (xs: readonly string[]): string => xs.join(', ');
    if (index <= 1) {
      const gone = COLUMNS.filter((_, c) => !supported[c]);
      const base = `Eşik ${tr(p.vt)}: ${COLUMNS.length - gone.length} sütun kalır; elenen: ${list(gone)}.`;
      return supported[DESTEK]
        ? base
        : `${base} ${COLUMNS[DESTEK]} (F = ${fv(F_SCORES[DESTEK])}) da elendi: varyans birime bağlıdır; ${COLUMNS[TOPLAM]} ${fv(VARIANCES[TOPLAM])} ile en “değişken” sütun ama F = ${fv(F_SCORES[TOPLAM])}.`;
    }
    if (index <= 4) return `k = ${p.k}: ${list(kbestNames)}.`;
    if (index <= 8) return `n = ${p.nSelect}, ${p.scaling === 'standard' ? 'StandardScaler' : 'ölçeksiz'}: ${list(rfeNames)}.`;
    return `Kesişim: ${list(intersect!.both)}.`;
  }
}
