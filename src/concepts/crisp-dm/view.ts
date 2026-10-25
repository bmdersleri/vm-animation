import { formatNumber as f, formatPercent } from '../../core/plot/format';
import type { CodeBug, CodeLine } from '../../core/plot/code-panel';
import type { FlowGraphSpec, FlowNode } from '../../core/plot/flow-graph';
import {
  CYCLE_EDGES, PHASE_LABELS, enoughData, orderText, projectPath, type NodeId, type PathEnd,
} from './calc';
import { BUGGY_CODE, BUGS, FIXED_CODE, OUTPUT } from './code-text';
import { BASELINE, BOOK, DAYS, META, cellOf, type Cell, type Outcome } from './data';
import { EXAM_COUNT, NORMAL_COUNT, POOL, SCAN_DONE, STORY, examStockNote, crispDmScenario as scenario, ruleText, type CrispParams } from './scenario';

/** Which card the right (narrow: lower) area shows. */
export type CardKind = 'intro' | 'goal' | 'table' | 'summary' | 'clean' | 'leak' | 'groups' | 'results' | 'code';

export interface IntroCard {
  lines: string[];
}

/** The book's isHedefi dictionary (code names in code font) plus the page's service condition. */
export interface GoalCard {
  rows: { key: string; value: string }[];
  service: string;
  /** Step 4: the data question after the first decision sent the project back. */
  extra: string | null;
}

export interface TableCard {
  columns: string[];
  rows: { cells: string[]; highlight: boolean }[];
  note: string | null;
}

export interface SummaryCard {
  items: { label: string; value: string }[];
  /** "Veri yeterli mi?" answer once it is shown. */
  decision: 'Evet' | 'Hayır' | null;
  /** True when the first decision says Evet, false for Hayır, null before it is shown. */
  enough: boolean | null;
  note: string | null;
}

export interface CleanCard {
  rows: { before: { urun: string; satis: string }; after: { urun: string; satis: string } }[];
  kahve: { zero: string; skip: string };
  normal: { zero: string; skip: string };
  exam: { zero: string; skip: string };
  /** Missing sales in the training window, and how many of them fall on stocked-out exam days. */
  missing: number;
  missingOnExam: number;
  note: string;
}

export interface LeakCard {
  record: { name: string; value: string; input: boolean }[];
  wrong: string[];
  right: string[];
  /** Coefficient of ay_sonu_israfi when it is an input (3 decimals), "—" when no such model exists. */
  coefficient: string;
  active: boolean;
  note: string;
}

export interface GroupBar {
  id: 'normal' | 'sinav';
  label: string;
  value: number | null;
  /** "40,85" or "veri yok". */
  text: string;
}

export interface GroupsCard {
  bars: GroupBar[];
  max: number;
  rule: string;
  /** The order of each group (a number, or a range when the orders differ from day to day). */
  orders: { normal: string; sinav: string };
}

export interface ResultColumn {
  id: 'base' | 'eval' | 'deploy';
  title: string;
  wasteRate: string;
  lostShare: string;
  /** The waste change against the baseline: "israf düşüşü" or, when the waste rose, "israf artışı" (always a positive value); null for the baseline. */
  reduction: WasteChange | null;
  /** True / false once judged; null for the baseline. */
  wasteOk: boolean | null;
  serviceOk: boolean | null;
}

export interface ResultsCard {
  title: string;
  columns: ResultColumn[];
  note: string | null;
  rule: string | null;
}

export interface CodeCard {
  faulty: readonly CodeLine[];
  fixedLines: readonly CodeLine[];
  bugs: readonly CodeBug[];
  marked: number;
  fixed: boolean;
  output: string[] | null;
  note: string;
}

/** "israf düşüşü %23,1", or "israf artışı %80,0" when the waste rose. */
export interface WasteChange {
  label: 'israf düşüşü' | 'israf artışı';
  value: string;
}

/** The reason line the Lab writes in the cycle, with the node that sends the project back. */
export interface RouteReason {
  node: NodeId;
  text: string;
}

/** The Lab's one-round route and why it turns back (`reason` null when the project is deployed and stays). */
export interface Route {
  end: PathEnd;
  stopAt: NodeId;
  reason: RouteReason | null;
}

export interface CrispView {
  stepId: string;
  card: CardKind;
  /** Nodes carry labels and kinds; their positions come from the scene (`cycleLayout`). */
  graph: FlowGraphSpec;
  strip: string;
  /** Lab with a choice that fails "Veri yeterli mi?": the results are drawn faded as "yine de denenseydi". */
  hypothetical: boolean;
  route: Route | null;
  intro?: IntroCard;
  goal?: GoalCard;
  table?: TableCard;
  summary?: SummaryCard;
  clean?: CleanCard;
  leak?: LeakCard;
  groups?: GroupsCard;
  results?: ResultsCard;
  code?: CodeCard;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
/** "2026-03-06" as "6 Mart". */
export function dateText(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

const pct = (v: number | null): string => (v === null ? '—' : formatPercent(v));
const stepId = (index: number): string => scenario.steps[index].id;
const yesNo = (v: boolean): string => (v ? 'Evet' : 'Hayır');

/** The waste change of an outcome against the baseline; a rise is written as "israf artışı" with a positive value. */
export function wasteChange(reduction: number | null): WasteChange {
  if (reduction !== null && reduction < 0) {
    return { label: 'israf artışı', value: pct(-reduction) };
  }
  return { label: 'israf düşüşü', value: pct(reduction) };
}

interface GraphOptions {
  current?: NodeId;
  path?: string[];
  token?: { at: NodeId; via?: string };
  alarm?: boolean;
}

/** The cycle graph without positions (x, y, w, h are 0; the scene places the nodes with `cycleLayout`). */
function graphOf(o: GraphOptions = {}): FlowGraphSpec {
  const ids = Object.keys(PHASE_LABELS) as NodeId[];
  const nodes: FlowNode[] = ids.map(id => ({
    id,
    label: PHASE_LABELS[id],
    kind: id === 'd1' || id === 'd2' ? 'decision' : 'phase',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));
  const edges = CYCLE_EDGES.map(e => (o.alarm && e.id === 'ya-ia' ? { ...e, tone: 'alarm' as const } : { ...e }));
  const spec: FlowGraphSpec = { nodes, edges };
  if (o.current) {
    spec.current = o.current;
  }
  if (o.path) {
    spec.path = o.path;
  }
  if (o.token) {
    spec.token = o.token;
  }
  return spec;
}

/** "israf oranı = atılan / hazırlanan = 62 / 700 = %8,9" and the lost-demand line. */
function stripOf(r: Outcome): string {
  return [
    `israf oranı = atılan / hazırlanan = ${r.wasted} / ${r.prepared} = ${pct(r.wasteRate)}`,
    `kaçan talep = karşılanamayan / toplam talep = ${r.lost} / ${r.demand} = ${pct(r.lostShare)}`,
  ].join('\n');
}

function column(id: ResultColumn['id'], title: string, o: Outcome, base: boolean): ResultColumn {
  return {
    id,
    title,
    wasteRate: pct(o.wasteRate),
    lostShare: pct(o.lostShare),
    reduction: base ? null : wasteChange(o.reduction),
    wasteOk: base ? null : o.wasteOk,
    serviceOk: base ? null : o.serviceOk,
  };
}

function resultsCard(cell: Cell, withDeploy: boolean, hypothetical: boolean, note: string | null, rule: string | null): ResultsCard {
  const columns = [column('base', `Sabit ${META.oldOrder}`, BASELINE, true), column('eval', 'Değerlendirme', cell.eval, false)];
  if (withDeploy) {
    columns.push(column('deploy', 'Yaygınlaştırma', cell.deploy, false));
  }
  return { title: hypothetical ? 'Sonuçlar (yine de denenseydi)' : 'Sonuçlar', columns, note, rule };
}

const groupText = (v: number | null): string => (v === null ? 'veri yok' : f(v, 2));

function groupsCard(cell: Cell): GroupsCard {
  const { normal, sinav } = cell.pred;
  const orders = { normal: orderText(cell, false), sinav: orderText(cell, true) };
  return {
    bars: [
      { id: 'normal', label: 'Normal gün', value: normal, text: groupText(normal) },
      { id: 'sinav', label: 'Sınav haftası', value: sinav, text: groupText(sinav) },
    ],
    max: Math.max(1, normal ?? 0, sinav ?? 0),
    rule: ruleText(orders.sinav, orders.normal),
    orders,
  };
}

const bookTable = (note: string | null, highlight: boolean): TableCard => ({
  columns: ['Tarih', 'Ürün', 'Satış', 'Stok tükendi', 'Sınav haftası'],
  rows: BOOK.kafeVerisi.map(r => ({
    cells: [dateText(r.tarih), r.urun, String(r.satis_adedi), yesNo(r.stok_tukendi), yesNo(r.sinav_haftasi)],
    highlight: highlight && r.stok_tukendi && r.urun === 'Kahve',
  })),
  note,
});

const goalCard = (extra: string | null): GoalCard => ({
  rows: [
    { key: 'amac', value: BOOK.isHedefi.amac },
    { key: 'basari_olcutu', value: BOOK.isHedefi.basari_olcutu },
    { key: 'veri_sorusu', value: BOOK.isHedefi.veri_sorusu },
  ],
  service: `kaçan talep en çok ${formatPercent(META.criteria.service, 0)} (israfı sıfırlamanın yolu hiç hazırlamamaktır)`,
  extra,
});

function windowSummary(days: number, normal: number, exam: number, decision: SummaryCard['decision'], note: string | null): SummaryCard {
  const window = POOL.slice(0, days);
  return {
    items: [
      { label: 'Gün', value: String(days) },
      { label: 'Normal gün', value: String(normal) },
      { label: 'Sınav günü', value: String(exam) },
      { label: 'Stok tükenen gün', value: String(window.filter(d => d.stokTukendi).length) },
      { label: 'Eksik kayıt', value: String(window.filter(d => d.satis === null).length) },
    ],
    decision,
    enough: decision === null ? null : decision === 'Evet',
    note,
  };
}

function cleanCard(days: 4 | 14 | 28 | 56, stock: 'satis' | 'soran'): CleanCard {
  const zero = cellOf(days, 'sifir', stock, false);
  const skip = cellOf(days, 'cikar', stock, false);
  const window = POOL.slice(0, days);
  const gone = window.filter(d => d.satis === null);
  const value = (v: number | null): string => (v === null ? 'yok' : f(v, 0));
  return {
    rows: BOOK.hamVeri.once.map((row, i) => ({
      before: { urun: row.urun, satis: value(row.satis_adedi) },
      after: { urun: BOOK.hamVeri.sonra[i].urun, satis: value(BOOK.hamVeri.sonra[i].satis_adedi) },
    })),
    // the book's own one decimal, as in the step text
    kahve: { zero: f(BOOK.hamVeri.kahveFillna0, 1), skip: f(BOOK.hamVeri.kahveAtlanir, 1) },
    normal: { zero: groupText(zero.pred.normal), skip: groupText(skip.pred.normal) },
    exam: { zero: groupText(zero.pred.sinav), skip: groupText(skip.pred.sinav) },
    missing: gone.length,
    missingOnExam: gone.filter(d => d.sinav && d.stokTukendi).length,
    note: 'Eksik kayıt sıfır satış demek değildir: işaretle ve çıkar.',
  };
}

function leakCard(days: 4 | 14 | 28 | 56, missing: 'sifir' | 'cikar', stock: 'satis' | 'soran', active: boolean): LeakCard {
  const coef = cellOf(days, missing, stock, true).leakCoef;
  const rec = BOOK.sizinti.gunlukKayit;
  return {
    record: [
      { name: 'gun', value: dateText(rec.gun), input: false },
      { name: 'sicaklik', value: f(rec.sicaklik, 0), input: true },
      { name: 'ay_sonu_israfi', value: f(rec.ay_sonu_israfi, 0), input: active },
    ],
    wrong: BOOK.sizinti.yanlisGirdiler,
    right: BOOK.sizinti.dogruGirdiler,
    coefficient: coef === null ? '—' : f(coef, 3),
    active,
    note: 'Değerlendirmede iyi görünür, sahada yoktur.',
  };
}

function codeCard(marked: number, fixed: boolean): CodeCard {
  return {
    faulty: BUGGY_CODE,
    fixedLines: FIXED_CODE,
    bugs: BUGS,
    marked,
    fixed,
    output: fixed ? [...OUTPUT] : null,
    note: `ortalamaya giren ${BOOK.kafeAnalizi.used} değer`,
  };
}

/** The failed conditions of an outcome: "kaçan talep %6,5 > %3", "israf düşüşü %12,0 < %15" or "israf artışı %80,0 (en az %15 düşüş gerekir)". */
function conditions(o: Outcome, failed: readonly ('waste' | 'service')[]): string {
  const need = formatPercent(META.criteria.waste, 0);
  return failed
    .map(k => {
      if (k === 'service') {
        return `kaçan talep ${pct(o.lostShare)} > ${formatPercent(META.criteria.service, 0)}`;
      }
      const c = wasteChange(o.reduction);
      return c.label === 'israf artışı' ? `${c.label} ${c.value} (en az ${need} düşüş gerekir)` : `${c.label} ${c.value} < ${need}`;
    })
    .join('; ');
}

/** What the Lab route says: where the project turns back and the one-line reason (numbers from the data and `META`). */
function routeOf(cell: Cell): Route {
  const path = projectPath(cell);
  let reason: RouteReason | null = null;
  if (path.end === 'yetersiz') {
    const exam = cell.usable.sinav <= cell.usable.normal;
    reason = {
      node: 'd1',
      text: `Veri yeterli mi? Hayır: ${exam ? 'sınav günü' : 'normal gün'} ${exam ? cell.usable.sinav : cell.usable.normal} < ${META.minGroup}`,
    };
  } else if (path.end === 'uygun-degil') {
    reason = { node: 'd2', text: `Sonuç uygun mu? Hayır: ${conditions(cell.eval, path.failed)}` };
  } else if (path.end === 'sahada-dustu') {
    reason = { node: 'ya', text: `Sahada tutmadı: ${conditions(cell.deploy, path.failed)}` };
  }
  return { end: path.end, stopAt: path.stopAt, reason };
}

/** The edges of stages 1..stage together (each stage lists the edges it walks): the end state keeps the whole route marked. */
const walked = (stages: readonly (readonly string[])[], stage: number): string[] => [...new Set(stages.slice(0, stage).flat())];

const clampStage = (scan: number, n: number): number => Math.max(1, Math.min(n, Math.floor(scan)));

function empty(id: string, card: CardKind, graph: FlowGraphSpec, strip: string): CrispView {
  return { stepId: id, card, graph, strip, hypothetical: false, route: null };
}

/** The Ders story (fixed cells, sweeps) for any step. */
function storyView(index: number, p: CrispParams): CrispView {
  const id = stepId(index);
  const { first } = STORY;
  switch (id) {
    case 'sorun': {
      const v = empty(id, 'intro', graphOf({ current: 'ia', token: { at: 'ia' } }), 'Daha çok sipariş yanıt değildir: gün, sınav haftası, hava, ürün, satış ve stok birlikte okunur.');
      v.intro = { lines: ['Bazı günler sandviç öğleden önce biter.', 'Bazı günler çok ürün atılır.', 'Altı evre, iki karar ve bir dış döngü.'] };
      return v;
    }
    case 'is-anlama': {
      const v = empty(id, 'goal', graphOf({ current: 'ia', token: { at: 'ia' } }), 'En sık hata, modelleme evresinden başlamaktır.');
      v.goal = goalCard(null);
      return v;
    }
    case 'veri-anlama': {
      const v = empty(id, 'table', graphOf({ current: 'va', path: ['ia-va'], token: { at: 'va', via: 'ia-va' } }), 'Satış, talebin alt sınırıdır: stok bitince gelen müşteri kayda geçmez.');
      v.table = bookTable('satış, talebin alt sınırıdır', true);
      return v;
    }
    case 'veri-yeterli':
      return dataEnoughView(id, p);
    case 'eksik-sifir-degil': {
      const v = empty(id, 'clean', graphOf({ current: 'vh', path: ['d1-vh'], token: { at: 'vh', via: 'd1-vh' } }), 'ham["urun"].str.strip().str.title() · fillna(0) eksik kaydı sıfır satışa çevirir: eksik ≠ sıfır');
      v.clean = cleanCard(56, 'soran');
      return v;
    }
    case 'sizinti': {
      const v = empty(id, 'leak', graphOf({ current: 'vh', token: { at: 'vh' } }), 'ay_sonu_israfi ayın sonunda kesinleşir; tahmin günü bilinmez, girdi olamaz.');
      v.leak = leakCard(56, 'cikar', 'soran', false);
      return v;
    }
    case 'modelleme': {
      const v = empty(id, 'groups', graphOf({ current: 'mo', path: ['vh-mo'], token: { at: 'mo', via: 'vh-mo' } }), `sipariş = ${f(META.margin, 2)} × grup ortalaması`);
      v.groups = groupsCard(first);
      return v;
    }
    case 'degerlendirme':
      return evaluationView(id, p);
    case 'ikinci-tur':
      return secondRoundView(id, p);
    default: {
      const stage = clampStage(p.scan, BUGS.length + 1);
      const fixed = stage > BUGS.length;
      const marked = Math.min(stage, BUGS.length);
      const bug = BUGS[marked - 1];
      const v = empty(id, 'code', graphOf(), fixed ? OUTPUT.join(' · ') : `hata ${bug.n} / ${BUGS.length} · ${bug.kind} · ${bug.what}`);
      v.code = codeCard(marked, fixed);
      return v;
    }
  }
}

/** The edges each stage of step 4's sweep walks: to the first decision, back to İş anlama, then the second tour to ◇1 and on. */
const ENOUGH_STAGES: readonly (readonly string[])[] = [['ia-va', 'va-d1'], ['d1-ia'], ['ia-va'], ['va-d1', 'd1-vh']];

function dataEnoughView(id: string, p: CrispParams): CrispView {
  const stage = clampStage(p.scan, 4);
  const strip = `Veri yeterli mi? Her grupta en az ${META.minGroup} gün gerekir.`;
  const normal = NORMAL_COUNT;
  const exam = EXAM_COUNT;
  if (stage === 1) {
    const v = empty(id, 'table', graphOf({ current: 'd1', path: walked(ENOUGH_STAGES, 1), token: { at: 'd1', via: 'va-d1' } }), strip);
    const sandwich = BOOK.kafeVerisi.filter(r => r.urun === 'Sandvic');
    v.table = bookTable(`sandviç: ${sandwich.length} kayıt, sınav haftasında ${sandwich.filter(r => r.sinav_haftasi).length}`, false);
    return v;
  }
  if (stage === 2) {
    const v = empty(id, 'goal', graphOf({ current: 'ia', path: walked(ENOUGH_STAGES, 2), token: { at: 'ia', via: 'd1-ia' } }), strip);
    v.goal = goalCard('veri sorusu: 8 haftalık günlük kayıt');
    return v;
  }
  const v = empty(id, 'summary', graphOf({
    current: stage === 3 ? 'va' : 'd1',
    path: walked(ENOUGH_STAGES, stage),
    token: stage === 3 ? { at: 'va', via: 'ia-va' } : { at: 'd1', via: 'va-d1' },
  }), strip);
  v.summary = windowSummary(POOL.length, normal, exam, stage === 4 ? 'Evet' : null, null);
  return v;
}

/** The edges each stage of step 8's sweep walks: into the evaluation, to the second decision, back to data understanding. */
const EVAL_STAGES: readonly (readonly string[])[] = [['mo-de'], ['de-d2'], ['d2-va']];

function evaluationView(id: string, p: CrispParams): CrispView {
  const stage = clampStage(p.scan, 3);
  const cell = STORY.first;
  const strip = stripOf(cell.eval);
  const note = examStockNote();
  if (stage === 1) {
    const v = empty(id, 'table', graphOf({ current: 'de', path: walked(EVAL_STAGES, 1), token: { at: 'de', via: 'mo-de' } }), strip);
    const tests = DAYS.filter(d => d.test);
    v.table = {
      columns: ['Gün', 'Talep', `Sabit ${META.oldOrder}`, 'Kural'],
      rows: tests.map((d, i) => ({
        cells: [`${dateText(d.date)}${d.sinav ? ' (sınav)' : ''}`, String(d.talep), String(META.oldOrder), String(cell.orders.eval[i])],
        highlight: d.sinav,
      })),
      note: null,
    };
    return v;
  }
  const v = empty(id, 'results', stage === 2
    ? graphOf({ current: 'd2', path: walked(EVAL_STAGES, 2), token: { at: 'd2', via: 'de-d2' } })
    : graphOf({ current: 'va', path: walked(EVAL_STAGES, 3), token: { at: 'va', via: 'd2-va' } }), strip);
  v.results = resultsCard(cell, false, false, stage === 3 ? note : null, null);
  return v;
}

const SECOND_ROUND: { current: NodeId; via?: string; path: string[] }[] = [
  { current: 'va', path: [] },
  { current: 'vh', via: 'd1-vh', path: ['va-d1', 'd1-vh'] },
  { current: 'mo', via: 'vh-mo', path: ['vh-mo'] },
  { current: 'de', via: 'mo-de', path: ['mo-de'] },
  { current: 'd2', via: 'de-d2', path: ['de-d2'] },
  { current: 'ya', via: 'd2-ya', path: ['d2-ya'] },
  { current: 'ia', via: 'ya-ia', path: ['ya-ia'] },
];

function secondRoundView(id: string, p: CrispParams): CrispView {
  const stage = clampStage(p.scan, 7);
  const cell = STORY.second;
  const s = SECOND_ROUND[stage - 1];
  const graph = graphOf({ current: s.current, path: walked(SECOND_ROUND.map(r => r.path), stage), token: { at: s.current, ...(s.via ? { via: s.via } : {}) } });
  const strip = stripOf(stage >= 6 ? cell.deploy : cell.eval);
  const rule = ruleText(orderText(cell, true, 'deploy'), orderText(cell, false, 'deploy'));
  if (stage === 1) {
    const v = empty(id, 'summary', graph, 'Tükenince soran müşteriler de talebe eklenir.');
    const asked = POOL.reduce((sum, d) => sum + d.soran, 0);
    v.summary = windowSummary(POOL.length, NORMAL_COUNT, EXAM_COUNT, null, `tükenince soran: ${asked} müşteri`);
    return v;
  }
  if (stage <= 3) {
    const v = empty(id, 'groups', graph, `sipariş = ${f(META.margin, 2)} × grup ortalaması`);
    v.groups = groupsCard(cell);
    return v;
  }
  const v = empty(id, 'results', graph, strip);
  v.results = resultsCard(cell, stage >= 6, false, null, stage >= 6 ? rule : null);
  return v;
}

/** Lab steps 4-9: the cell of the chosen options, its route, and the card of that step's phase. */
function labView(index: number, p: CrispParams): CrispView {
  const id = stepId(index);
  const cell = cellOf(p.days, p.missing, p.stock, p.leak);
  const route = routeOf(cell);
  const path = projectPath(cell);
  const graph = graphOf({
    current: path.stopAt,
    path: path.edges,
    token: { at: path.stopAt },
    alarm: path.end === 'sahada-dustu',
  });
  const hypothetical = !enoughData(cell);
  const base = (card: CardKind, strip: string): CrispView => ({ stepId: id, card, graph, strip, hypothetical, route });
  switch (id) {
    case 'veri-yeterli': {
      const v = base('summary', `Veri yeterli mi? Her grupta en az ${META.minGroup} gün gerekir.`);
      v.summary = windowSummary(p.days, cell.usable.normal, cell.usable.sinav, enoughData(cell) ? 'Evet' : 'Hayır', null);
      return v;
    }
    case 'eksik-sifir-degil': {
      const v = base('clean', 'ham["urun"].str.strip().str.title() · fillna(0) eksik kaydı sıfır satışa çevirir: eksik ≠ sıfır');
      v.clean = cleanCard(p.days, p.stock);
      return v;
    }
    case 'sizinti': {
      const v = base('leak', 'ay_sonu_israfi ayın sonunda kesinleşir; tahmin günü bilinmez, girdi olamaz.');
      v.leak = leakCard(p.days, p.missing, p.stock, p.leak);
      return v;
    }
    case 'modelleme': {
      const v = base('groups', `sipariş = ${f(META.margin, 2)} × grup ortalaması`);
      v.groups = groupsCard(cell);
      return v;
    }
    case 'degerlendirme': {
      const v = base('results', stripOf(cell.eval));
      v.results = resultsCard(cell, true, hypothetical, null, null);
      return v;
    }
    default: {
      const v = base('results', stripOf(cell.deploy));
      v.results = resultsCard(cell, true, hypothetical, null, ruleText(orderText(cell, true, 'deploy'), orderText(cell, false, 'deploy')));
      return v;
    }
  }
}

/**
 * The view of step `index`. Ders (`lab` false) walks the fixed story cells and the step's sweep (`p.scan`); the Lab
 * draws steps 4-9 for the chosen options with finished sweeps, and step 10 follows the `fixed` switch.
 */
export function deriveCrispView(index: number, p: CrispParams, lab = false): CrispView {
  if (!lab) {
    return storyView(index, p);
  }
  const id = stepId(index);
  if (index >= 3 && id !== 'hata-ayiklama') {
    return labView(index, p);
  }
  if (id === 'hata-ayiklama') {
    const v = storyView(index, { ...p, scan: SCAN_DONE });
    v.code = codeCard(BUGS.length, p.fixed);
    v.strip = p.fixed ? OUTPUT.join(' · ') : `${BUGS.length} hata işaretli`;
    return v;
  }
  return storyView(index, { ...p, scan: SCAN_DONE });
}
