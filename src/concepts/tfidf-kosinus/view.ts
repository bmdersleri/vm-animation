import { formatNumber as f } from '../../core/plot/format';
import type { HBar } from '../../core/plot/hbars';
import { BLUE_SCALE, ORANGE_SCALE, type HeatCell, type HeatTableSpec } from '../../core/plot/heat-table';
import { BOOK, STOP_WORDS } from '../metin/data';
import { clean, DEGIL_STOP, tokenize } from '../metin/tokenize';
import {
  charState,
  contrastTerm,
  docTable,
  doubledQuery,
  nonZero,
  planeTerms,
  separateVocab,
  similarity,
  weightOf,
  type DocTable,
} from './calc';
import { tfidfKosinusScenario as scenario, type TfidfParams } from './scenario';

/** Which scene area draws the step. */
export type TfidfKind = 'tokens' | 'table' | 'vectors' | 'cards';

/** One character of the raw comment: kept, lower-cased (İ, A ...) or dropped (digits, punctuation). */
export interface RawChar {
  ch: string;
  state: 'keep' | 'lower' | 'gone';
}

/** One token chip: `dropped` is struck through (stop word or one-letter piece), `broken` marks the wrong pattern's pieces. */
export interface Chip {
  text: string;
  dropped: boolean;
  broken: boolean;
}

/** Step 2: one regular expression applied to the book's two words. */
export interface PatternRow {
  id: 'yanlis' | 'dogru';
  pattern: string;
  input: string;
  output: string;
  chips: Chip[];
}

/** Step 3's warning: "değil" as a stop word turns "hizmet kötü değil" into the opposite sentence. */
export interface WarnRow {
  input: string;
  chips: Chip[];
  kept: string[];
}

/** The token strip (steps 1-3). */
export interface TokensView {
  part: 'tokens' | 'patterns' | 'stop';
  raw: RawChar[] | null;
  chips: Chip[];
  patterns: PatternRow[] | null;
  counter: { term: string; count: number }[] | null;
  stopSet: string[] | null;
  warn: WarnRow | null;
}

/** One heat table with its title; `id` tells the CSS which of the three it is. */
export interface TableSpec {
  id: 'bow' | 'raw' | 'tfidf';
  title: string;
  spec: HeatTableSpec;
}

/** The heat tables (steps 4-7), with the IDF bars next to the count table in step 5. */
export interface TableView {
  part: 'bow' | 'idf' | 'norm' | 'both';
  tables: TableSpec[];
  bars: HBar[] | null;
  barMax: number;
  barTitle: string;
}

/** One arrow of the vector plane; (x, y) are the coordinates on the two term axes. */
export interface Arrow {
  id: 'query' | 'other' | 'double';
  label: string;
  x: number;
  y: number;
}

/** One line of the similarity list beside the plane. */
export interface SimRow {
  id: string;
  label: string;
  score: string;
  note: string;
  query: boolean;
}

/** The vector plane (steps 8-9) and the similarity list beside it. */
export interface VectorsView {
  terms: [string, string];
  arrows: Arrow[];
  /** Angle between the two arrows in the plane (degrees), `text` is how it is written. */
  angle: { deg: number; text: string } | null;
  /** The largest coordinate the axes must reach. */
  extent: number;
  /** `unit`: rows normalised to length 1 (step 8); `raw`: raw counts (step 9). */
  scale: 'unit' | 'raw';
  list: SimRow[];
}

/** Step 10's two cards. */
export interface CardsView {
  separate: { docs: [string, string]; pairs: [string, string][]; aligned: string; shared: string };
  pair: { a: string; b: string; cos: string };
  links: { href: string; text: string }[];
}

/** Everything a scene draws for one (step, parameters) pair. */
export interface TfidfView {
  kind: TfidfKind;
  stepId: string;
  strip: string;
  tokens: TokensView | null;
  table: TableView | null;
  vectors: VectorsView | null;
  cards: CardsView | null;
}

const f3 = (v: number): string => f(v, 3);
const cellText = (v: number): string => (v === 0 ? '0' : f3(v));
const maxOf = (rows: readonly (readonly number[])[]): number => Math.max(0, ...rows.map((r) => Math.max(0, ...r)));
const docName = (i: number): string => `belge ${i}`;

const empty = (kind: TfidfKind, id: string, strip: string): TfidfView => ({
  kind,
  stepId: id,
  strip,
  tokens: null,
  table: null,
  vectors: null,
  cards: null,
});

/** The book's code 01 lines, shown in the strip of step 1. */
export const KOD01_LINES = [
  'kucuk_metin = ham_metin.replace("İ", "i").replace("I", "ı").lower()',
  'temiz_metin = re.sub(r"[^a-zçğıöşü\\s]", " ", kucuk_metin)',
  'token_listesi = [kelime for kelime in temiz_metin.split() if len(kelime) > 1]',
];

/** The patterns of step 2 and the word they are applied to. */
const WRONG_PATTERN = '[^a-z\\s]';
const RIGHT_PATTERN = '[^a-zçğıöşü\\s]';

/** The stop-word set of steps 1-3: the book's set when `stop` is on, plus "değil" when `degil` is on. */
function stopSetOf(p: TfidfParams): ReadonlySet<string> | undefined {
  if (!p.stop && !p.degil) return undefined;
  return new Set([...(p.stop ? STOP_WORDS : []), ...(p.degil ? DEGIL_STOP : [])]);
}

/** Token chips of a text in text order; one-letter pieces are dropped by the tokenizer and never get a chip. */
function chipsOf(text: string, stop: ReadonlySet<string> | undefined): Chip[] {
  return clean(text)
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => ({ text: w, dropped: stop?.has(w) ?? false, broken: false }));
}

const counterLine = (counter: { term: string; count: number }[]): string =>
  `Counter({${counter.map((c) => `'${c.term}': ${c.count}`).join(', ')}})`;

/** Steps 1-3. */
function tokensView(id: string, p: TfidfParams): TfidfView {
  const stop = stopSetOf(p);
  const chips = chipsOf(p.text, stop);
  const base: TokensView = { part: 'tokens', raw: null, chips, patterns: null, counter: null, stopSet: null, warn: null };
  if (id === 'token') {
    const raw = [...p.text].map((ch): RawChar => ({ ch, state: charState(ch) }));
    return { ...empty('tokens', id, KOD01_LINES.join('\n')), tokens: { ...base, raw } };
  }
  if (id === 'turkce-karakter') {
    const input = BOOK.kod01.trap.rightPattern;
    const wrong = BOOK.kod01.trap.wrongPattern;
    const pieces = wrong.split(/\s+/).filter((t) => t !== '');
    const patterns: PatternRow[] = [
      {
        id: 'yanlis',
        pattern: WRONG_PATTERN,
        input,
        output: wrong,
        chips: pieces.map((t) => ({ text: t, dropped: t.length < 2, broken: true })),
      },
      {
        id: 'dogru',
        pattern: RIGHT_PATTERN,
        input,
        output: input,
        chips: chipsOf(input, undefined),
      },
    ];
    const strip = [`${WRONG_PATTERN} → "${wrong}"`, `${RIGHT_PATTERN} → "${input}"`].join('\n');
    return { ...empty('tokens', id, strip), tokens: { ...base, part: 'patterns', chips: [], patterns } };
  }
  const counts = new Map<string, number>();
  for (const c of chips) {
    if (!c.dropped) counts.set(c.text, (counts.get(c.text) ?? 0) + 1);
  }
  const counter = [...counts].map(([term, count]) => ({ term, count }));
  const warnInput = 'hizmet kötü değil';
  const warnChips = chipsOf(warnInput, DEGIL_STOP);
  const warn: WarnRow = { input: warnInput, chips: warnChips, kept: tokenize(warnInput, DEGIL_STOP).tokens };
  const strip = [counterLine(counter), `"${warnInput}" → [${warn.kept.join(', ')}]`].join('\n');
  return {
    ...empty('tokens', id, strip),
    tokens: { ...base, part: 'stop', counter, stopSet: [...STOP_WORDS], warn },
  };
}

/** Rows named "belge i", columns the vocabulary, `cells[r][c]` from `values` and `cellOf`. */
function tableSpec(
  t: DocTable,
  values: number[][],
  scale: HeatTableSpec['scale'],
  max: number,
  over: Partial<HeatTableSpec> = {},
  cellOf: (r: number, c: number, v: number) => HeatCell = (_, __, v) => ({ value: v, text: cellText(v) }),
): HeatTableSpec {
  return {
    rows: values.map((_, i) => docName(i)),
    cols: t.vocab,
    cells: values.map((row, r) => row.map((v, c) => cellOf(r, c, v))),
    scale,
    max,
    ...over,
  };
}

/** The strip of step 6 for sweep position `s`: raw weights, the norm, the division. */
function normStrip(t: DocTable, s: number): string {
  const nz = nonZero(t.raw[0] ?? []);
  const reached = Math.min(s, nz.length);
  const parts = nz.slice(0, reached).map((j) => `${t.vocab[j]} ${t.bow[0][j]} · ${f3(t.idf[j])} = ${f3(t.raw[0][j])}`);
  const lines = [parts.length > 0 ? `ham ağırlık (sayım · IDF) → ${parts.join(' · ')}` : 'ham ağırlık = sayım · IDF'];
  if (s > nz.length) {
    lines.push(`norm ‖v‖ = √(Σ ham ağırlık²) = ${f3(t.norms[0])}`);
  }
  if (s > nz.length + 1) {
    lines.push(`bölme → ${nz.map((j) => `${f3(t.raw[0][j])} / ${f3(t.norms[0])} = ${f3(t.tfidf[0][j])}`).join(' · ')}`);
  }
  return lines.join('\n');
}

/** Steps 4-7. */
function tableView(id: string, p: TfidfParams): TfidfView {
  const t = docTable(p.docs);
  const n = p.docs.length;
  const bowMax = Math.max(1, maxOf(t.bow));
  const term = t.vocab.includes(p.term) ? p.term : (t.vocab[0] ?? '');
  const col = t.vocab.indexOf(term);
  const bowSpec = (over: Partial<HeatTableSpec> = {}): HeatTableSpec =>
    tableSpec(t, t.bow, BLUE_SCALE, bowMax, over, (_, __, v) => ({ value: v, text: String(v) }));
  const view = (part: TableView['part'], tables: TableSpec[], strip: string): TfidfView => ({
    ...empty('table', id, strip),
    table: { part, tables, bars: null, barMax: 0, barTitle: '' },
  });
  if (id === 'bow') {
    const counts = t.bow.map((row) => row[col] ?? 0);
    const lines = [`sayım matrisi: ${n} belge × ${t.vocab.length} terim`];
    if (col >= 0) lines.push(`"${term}" sütunu = ${counts.map((c, i) => `${docName(i)}: ${c}`).join(' · ')}`);
    return view('bow', [{ id: 'bow', title: 'sayım (BoW)', spec: bowSpec({ focusCol: col }) }], lines.join('\n'));
  }
  if (id === 'idf') {
    const bars: HBar[] = t.vocab.map((v, j) => ({
      id: v,
      row: j,
      slot: 0,
      cls: `df${t.df[j]}${j === col ? ' is-focus' : ''}`,
      value: t.idf[j],
      text: `df ${t.df[j]} · ${f3(t.idf[j])}`,
      label: v,
      attrs: { df: t.df[j], idf: f3(t.idf[j]) },
    }));
    const dfs = [...new Set(t.df)].sort((a, b) => a - b);
    const idfAt = (df: number): number => t.idf[t.df.indexOf(df)];
    const formula = dfs
      .map((df) => `df ${df}: ln(${1 + n} / ${1 + df}) + 1 = ${f3(idfAt(df))}`)
      .join(' · ');
    const textbook = dfs.map((df) => `ln(${n} / ${df}) = ${f3(Math.log(n / df))}`).join(' · ');
    const strip = [`IDF = ln((1 + N) / (1 + df)) + 1 → ${formula}`, `ders kitabı log(N / df) → ${textbook}`].join('\n');
    return {
      ...empty('table', id, strip),
      table: {
        part: 'idf',
        tables: [{ id: 'bow', title: 'sayım (BoW)', spec: bowSpec({ focusCol: col }) }],
        bars,
        barMax: Math.max(0, ...t.idf),
        barTitle: 'IDF',
      },
    };
  }
  if (id === 'tfidf-norm') {
    const nz = nonZero(t.raw[0] ?? []);
    const s = p.scan;
    const done = s > nz.length + 1;
    const rawMax = Math.max(0, maxOf(t.raw));
    const cellOf = (r: number, c: number, v: number): HeatCell => {
      if (done) return { value: t.tfidf[r][c], text: cellText(t.tfidf[r][c]) };
      if (r !== 0) return { value: v, text: cellText(v), state: 'dim' };
      const at = nz.indexOf(c);
      if (at < 0 || at < s) return { value: v, text: cellText(v) };
      return { value: v, text: '', state: 'hidden' };
    };
    const spec = tableSpec(t, t.raw, ORANGE_SCALE, rawMax, { focusRow: 0 }, cellOf);
    const title = done ? 'TF-IDF (L2 normlu)' : 'ham ağırlık = sayım · IDF';
    return view('norm', [{ id: done ? 'tfidf' : 'raw', title, spec }], normStrip(t, s));
  }
  // yan-yana
  const other = contrastTerm(t, term);
  const w = (m: number[][], name: string): number => weightOf(t.vocab, m[0] ?? [], name);
  const lines = [
    `"${term}" → sayım ${w(t.bow, term)} · TF-IDF ${f3(w(t.tfidf, term))}`,
    other === '' ? '' : `"${other}" → sayım ${w(t.bow, other)} · TF-IDF ${f3(w(t.tfidf, other))}`,
  ].filter((l) => l !== '');
  const tfSpec = tableSpec(t, t.tfidf, ORANGE_SCALE, Math.max(0, maxOf(t.tfidf)), { focusCol: col });
  return view(
    'both',
    [
      { id: 'bow', title: 'sayım (BoW)', spec: bowSpec({ focusCol: col }) },
      { id: 'tfidf', title: 'TF-IDF', spec: tfSpec },
    ],
    lines.join('\n'),
  );
}

const degrees = (a: Arrow, b: Arrow): number | null => {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la === 0 || lb === 0) return null;
  const c = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
};

/** Steps 8-9. */
function vectorsView(id: string, p: TfidfParams): TfidfView {
  const docs = p.extra.trim() === '' ? [...p.comments] : [...p.comments, p.extra];
  const s = similarity(docs, p.query);
  const q = s.query;
  const nearest = s.order.find((i) => i !== q);
  if (id === 'uzunluk-yon') {
    const d = doubledQuery(docs, q);
    const [tx, ty] = planeTerms(s, p.plane, 'query');
    const jx = d.vocab.indexOf(tx);
    const jy = d.vocab.indexOf(ty);
    const at = (row: number[], j: number): number => (j < 0 ? 0 : row[j]);
    const arrows: Arrow[] = [
      { id: 'query', label: 'sorgu', x: at(d.counts[0], jx), y: at(d.counts[0], jy) },
      { id: 'double', label: 'sorgu ×2', x: at(d.counts[1], jx), y: at(d.counts[1], jy) },
    ];
    const deg = degrees(arrows[0], arrows[1]);
    const list: SimRow[] = [
      { id: 'cos', label: 'kosinüs benzerliği', score: f3(d.cos), note: 'yön aynı, uzunluk yok sayılır', query: false },
      { id: 'euclid', label: 'Öklid uzaklığı', score: f3(d.euclid), note: `ham sayımlarda; sorgunun kendisiyle ${f3(d.euclidSelf)}`, query: false },
    ];
    const strip = [`cos(sorgu, sorgu ×2) = ${f3(d.cos)}`, `Öklid uzaklığı (ham sayım) → ${f3(d.euclidSelf)} · ${f3(d.euclid)}`].join('\n');
    return {
      ...empty('vectors', id, strip),
      vectors: {
        terms: [tx, ty],
        arrows,
        angle: deg === null ? null : { deg, text: `${f(deg, 0)}°` },
        extent: Math.max(1, ...arrows.flatMap((a) => [a.x, a.y])),
        scale: 'raw',
        list,
      },
    };
  }
  const [tx, ty] = planeTerms(s, p.plane, 'neighbour');
  const jx = s.vocab.indexOf(tx);
  const jy = s.vocab.indexOf(ty);
  const coord = (i: number, j: number): number => (j < 0 || s.rows[i] === undefined ? 0 : s.rows[i][j]);
  const arrows: Arrow[] = [{ id: 'query', label: 'sorgu', x: coord(q, jx), y: coord(q, jy) }];
  if (nearest !== undefined) arrows.push({ id: 'other', label: docName(nearest), x: coord(nearest, jx), y: coord(nearest, jy) });
  const deg = arrows.length === 2 ? degrees(arrows[0], arrows[1]) : null;
  const list: SimRow[] = s.order.map((i) => ({
    id: `doc-${i}`,
    label: s.docs[i],
    score: f3(s.scores[i]),
    note: i === q ? 'sorgu' : s.common[i].length > 0 ? `ortak terim: ${s.common[i].join(', ')}` : 'ortak terim yok',
    query: i === q,
  }));
  const common = nearest === undefined ? [] : s.common[nearest];
  const products = common.map((t) => `${f3(weightOf(s.vocab, s.rows[q], t))} · ${f3(weightOf(s.vocab, s.rows[nearest!], t))}`);
  const total = nearest === undefined ? 0 : s.scores[nearest];
  const strip = [
    'cos = A · B / (‖A‖ ‖B‖) → satırlar birim uzunlukta: ‖A‖ = ‖B‖ = 1',
    common.length > 0 ? `ortak terim ${common.map((t) => `"${t}"`).join(', ')}: ${products.join(' + ')} = ${f3(total)}` : `ortak terim yok = ${f3(total)}`,
  ].join('\n');
  return {
    ...empty('vectors', id, strip),
    vectors: {
      terms: [tx, ty],
      arrows,
      angle: deg === null ? null : { deg, text: `${f(deg, 0)}°` },
      extent: Math.max(0.5, ...arrows.flatMap((a) => [a.x, a.y])),
      scale: 'unit',
      list,
    },
  };
}

/** Step 10. */
function cardsView(id: string, p: TfidfParams): TfidfView {
  const sep = separateVocab(p.docs[0], p.docs[2]);
  const pair = BOOK.cosPair;
  const strip = [
    `ayrı sözlük: sütun sütuna kosinüs = ${f3(sep.aligned)} · tek sözlük = ${f3(sep.shared)}`,
    `"${pair.a}" · "${pair.b}" → kosinüs = ${f3(pair.cos)}`,
  ].join('\n');
  return {
    ...empty('cards', id, strip),
    cards: {
      separate: { docs: [p.docs[0], p.docs[2]], pairs: sep.pairs, aligned: f3(sep.aligned), shared: f3(sep.shared) },
      pair: { a: pair.a, b: pair.b, cos: f3(pair.cos) },
      links: [
        { href: '../duygu-analizi/', text: 'Duygu analizi: TF-IDF ve lojistik regresyon' },
        { href: '../k-means/', text: 'K-Means döngüsü (Bölüm 7): benzerlikten kümelemeye' },
      ],
    },
  };
}

/** The view of step `index` for the parameters `p`. */
export function deriveTfidfView(index: number, p: TfidfParams): TfidfView {
  const id = scenario.steps[index].id;
  switch (id) {
    case 'token':
    case 'turkce-karakter':
    case 'stop-word':
      return tokensView(id, p);
    case 'bow':
    case 'idf':
    case 'tfidf-norm':
    case 'yan-yana':
      return tableView(id, p);
    case 'kosinus':
    case 'uzunluk-yon':
      return vectorsView(id, p);
    case 'ortak-sozluk':
      return cardsView(id, p);
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}
