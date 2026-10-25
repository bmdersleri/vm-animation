import { stepIndex, type Scenario } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { BOOK, STOP_WORDS } from '../metin/data';
import { tokenize } from '../metin/tokenize';
import { contrastTerm, docsWith, docTable, doubledQuery, nonZero, similarity } from './calc';

/**
 * Parameters of the TF-IDF page. Steps 1-3 read `text`, `stop` (the book's stop words) and `degil` ("değil" as a
 * stop word); steps 4-7 read `docs` (the three documents), `term` (the highlighted term) and `scan` (how far the
 * step-6 sweep has come); steps 8-9 read `comments` plus the optional fourth `extra`, the `query` index and the
 * chosen `plane` terms (empty strings: the page picks them); step 10 reads `separate`. `scan` is `SCAN_DONE` once the sweep has finished.
 */
export interface TfidfParams {
  text: string;
  stop: boolean;
  degil: boolean;
  docs: [string, string, string];
  comments: [string, string, string];
  term: string;
  query: number;
  extra: string;
  plane: [string, string];
  separate: boolean;
  scan: number;
}

const k1 = BOOK.kod01;
const tokens = tokenize(k1.text).tokens;
const wrongTokens = k1.trap.wrongPattern.split(/\s+/).filter((t) => t !== '');
const dt = docTable(BOOK.kod02.docs);
const nDocs = BOOK.kod02.docs.length;
const nz0 = nonZero(dt.raw[0]);
const sim = similarity(BOOK.kod03.docs, 0);
const dbl = doubledQuery(BOOK.kod03.docs, 0);
const stopList = [...STOP_WORDS];
const dropped = tokenize(k1.text, STOP_WORDS).dropped;
const f3 = (v: number): string => f(v, 3);
const unique = <T>(xs: T[]): T[] => [...new Set(xs)];
const joinWith = (xs: string[], last: string): string =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`;

const TERM = 'destek';
const TERM_B = contrastTerm(dt, TERM);
const countAt = (term: string, doc: number): number => dt.bow[doc][dt.vocab.indexOf(term)];
const whereA = docsWith(dt, TERM);
const whereB = docsWith(dt, TERM_B);
const dfValues = unique(dt.df).sort((a, b) => a - b);
const idfOfDf = (df: number): number => dt.idf[dt.df.indexOf(df)];
const rawPairs = unique(nz0.map((j) => `${dt.bow[0][j]} · ${f3(dt.idf[j])}`));
const normed = unique(nz0.map((j) => f3(dt.tfidf[0][j])));
const second = sim.order.find((i) => i !== sim.query) ?? 0;
const sharedTerms = sim.common[second];
const sharedWeights = sharedTerms.map((t) => [sim.rows[0][sim.vocab.indexOf(t)], sim.rows[second][sim.vocab.indexOf(t)]]);
const sharedCos = sharedWeights.reduce((s, [a, b]) => s + a * b, 0);
const badPair = BOOK.cosPair;

/**
 * The finished value of the step-6 sweep (`scan`): past every cell, the norm and the division, whatever the number
 * of terms in row zero. The sweep's last value and the Lab's document boxes on step 6 write it, so a row that gains
 * terms after the sweep stays finished instead of falling back to the raw weights.
 */
export const SCAN_DONE = Number.POSITIVE_INFINITY;

/** How many numbered sweep values come before `SCAN_DONE`; a longer row ends the sweep on `SCAN_DONE` itself. */
const SCAN_STEPS = 99;

/** The step scenario of the TF-IDF page (Ders steps 1-10). */
export const tfidfKosinusScenario: Scenario<TfidfParams> = {
  defaults: {
    text: k1.text,
    stop: false,
    degil: false,
    docs: [...BOOK.kod02.docs] as [string, string, string],
    comments: [...BOOK.kod03.docs] as [string, string, string],
    term: TERM,
    query: 0,
    extra: '',
    plane: ['', ''],
    separate: false,
    scan: 0,
  },
  steps: [
    {
      id: 'token',
      title: "Ham yorumdan token'a",
      term: 'token',
      text: `Kitabın yorumu "${k1.text}": her harf küçültülür (İ → i), rakam ve noktalama atılır, tek harfli parçalar düşer ve ${tokens.length} token kalır. Kitabın kod01 satırları şeritte.`,
      labText:
        'Yorumu kutuya yazın ya da hazır örnek seçin; çipler her tuşta yeniden kurulur. Kitabın stop-word kümesini ve "değil" anahtarını açıp kapatarak hangi çiplerin süzüldüğünü izleyin.',
    },
    {
      id: 'turkce-karakter',
      title: 'Türkçe karakter tuzağı',
      text: `[^a-z\\s] deseni "${k1.trap.rightPattern}" ifadesini ${joinWith(wrongTokens.filter((t) => t.length > 1).map((t) => `"${t}"`), 've')} parçalarına böler; [^a-zçğıöşü\\s] ise sözcükleri korur. Python'un lower() işlevi ayrıca "İ" harfini iki karaktere çevirir ("${k1.text.split(' ')[0]}" → "${k1.naiveTokens[0]}"); kitabın replace adımı bunu önler ("${tokens[0]}").`,
    },
    {
      id: 'stop-word',
      title: 'Stop-word süzme',
      term: 'stop-word',
      text: `Kitabın kümesi {${stopList.join(', ')}} (${stopList.length} sözcük): süzülen çipler üstü çizili gri (${dropped.join(', ')}), kalanlar Counter ile sayılır. Uyarı: "değil" listeye girerse "hizmet kötü değil" → [hizmet, kötü] kalır ve anlam ters döner.`,
      params: { stop: true },
      labText:
        'Yorumu değiştirin ve iki anahtarı deneyin: süzülen çipler üstü çizili kalır, Counter satırı yalnızca kalanları sayar. "değil" anahtarı açıkken olumsuzlama kaybolur.',
    },
    {
      id: 'bow',
      title: 'Bag-of-Words',
      term: 'Bag-of-Words (BoW)',
      text: `Kitabın kod02 belgeleri: ${nDocs} belge, ${dt.vocab.length} terim. Satırlar belge, sütunlar terim; "${TERM}" ${joinWith(whereA.map((i) => `${i}.`), 've')} belgede ${countAt(TERM, whereA[0])}, "${TERM_B}" yalnız ${whereB[0]}. belgede ${countAt(TERM_B, whereB[0])}. Sayım her terimi eşit tartar.`,
      labText:
        'Üç belgeyi kendi cümlelerinizle değiştirin; sözlük ve sayımlar yeniden kurulur. Terim seçimi vurgulanan sütunu belirler.',
    },
    {
      id: 'idf',
      title: 'IDF: nadir terim ağır',
      term: 'IDF',
      text: `Her terimin belge sıklığı (df) ve IDF çubukları: df ${dfValues[0]} → ${f3(idfOfDf(dfValues[0]))}, df ${dfValues[1]} → ${f3(idfOfDf(dfValues[1]))}. IDF = ln((1 + N) / (1 + df)) + 1; kitabın ders kitabı tanımı log(N / df) alttaki satırda. sklearn 1 ekleyerek sıfıra bölmeyi ve sıfır ağırlığı önler.`,
      labText:
        'Belgeleri değiştirin: bir terim ne kadar çok belgede geçerse IDF çubuğu o kadar kısalır. Terim seçimi vurgulanan çubuğu belirler.',
    },
    {
      id: 'tfidf-norm',
      title: 'TF × IDF ve L2 normu',
      term: 'L2 normu',
      text: `0. belgenin satırı: ham ağırlık = sayım · IDF (${rawPairs.join('; ')} …); norm ${f3(dt.norms[0])}; bölünce ${normed.join(' / ')}. Tarama hücre hücre ilerler.`,
      sweep: {
        key: 'scan',
        values: [...Array.from({ length: SCAN_STEPS }, (_, i) => i + 1), SCAN_DONE],
        intervalMs: 1100,
        // one value per non-zero cell, then the norm and the division; the player stops at the end of `values`
        count: (p) => nonZero(docTable(p.docs).raw[0]).length + 2,
      },
      labText:
        'Belgeleri değiştirin: ilk belgenin satırı için ham ağırlıklar, norm ve bölme yeniden hesaplanır.',
    },
    {
      id: 'yan-yana',
      title: 'BoW ile TF-IDF yan yana',
      text: `Aynı belgeler iki tabloda: sayım (mavi) ve TF-IDF (turuncu). "${TERM}" sayımda "${TERM_B}" kadar (${countAt(TERM, 0)} ve ${countAt(TERM_B, 0)}), TF-IDF'te daha hafif (${f3(dt.tfidf[0][dt.vocab.indexOf(TERM)])} ve ${f3(dt.tfidf[0][dt.vocab.indexOf(TERM_B)])}).`,
      labText:
        'Belgeleri ve terimi değiştirin: aynı terimin sayımı ile TF-IDF ağırlığı iki tabloda yan yana okunur.',
    },
    {
      id: 'kosinus',
      title: 'Kosinüs benzerliği',
      term: 'kosinüs benzerliği',
      text: `Kitabın kod03'ü: sorgu "${sim.docs[0]}"; skorlar ${sim.order.map((i) => f3(sim.scores[i])).join(' / ')}. Ortak terim yalnız ${joinWith(sharedTerms.map((t) => `"${t}"`), 've')}: ${sharedWeights.map(([a, b]) => `${f3(a)} · ${f3(b)}`).join(' + ')} = ${f3(sharedCos)}. "bağlantısı" ile "bağlantı" ayrı terim: ek, ortak kelimeyi böldü.`,
      labText:
        'Sorgu belgesini seçin, dördüncü belge kutusuna kendi yorumunuzu yazın ve düzlemin iki terimini değiştirin; skorlar, sıralama ve oklar yeniden çizilir.',
    },
    {
      id: 'uzunluk-yon',
      title: 'Uzunluk değil yön',
      text: `Sorgunun iki kez yazılmış hâli: kosinüs ${f3(dbl.cos)}, Öklid uzaklığı (ham sayımlarda) ${f3(dbl.euclidSelf)} iken ${f3(dbl.euclid)} olur. Aynı yönde iki farklı uzunlukta ok. Uzun ve kısa yorum aynı konuyu anlatıyorsa yönleri aynıdır.`,
      labText:
        'Sorguyu, dördüncü belgeyi ve düzlemin terimlerini değiştirin: sorgu iki kez yazılsa da kosinüs yöne baktığı için aynı kalır.',
    },
    {
      id: 'ortak-sozluk',
      title: 'Ortak sözlük ve sınır',
      text: `İki kart. Kitabın "her belge ayrı sözlük" hatası: iki ayrı vektörleştiricinin sütunları farklı anlama gelir, karşılaştırma anlamsızdır; doğrusu tek vektörleştirici. Sık yanlış anlama: "${badPair.a}" ile "${badPair.b}" kosinüsü ${f3(badPair.cos)}, duyguları zıt.`,
      labText:
        '"Ayrı sözlük" anahtarını kapatın: iki belge tek vektörleştiriciyle kurulur, sütun adları iki belgede aynı olur ve kosinüs anlamlıdır.',
      params: { separate: true },
    },
  ],
};

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(tfidfKosinusScenario, id));

/** Steps drawn by the token strip. */
export const TOKEN_STEPS = indices('token', 'turkce-karakter', 'stop-word');

/** Steps drawn by the heat table. */
export const TABLE_STEPS = indices('bow', 'idf', 'tfidf-norm', 'yan-yana');

/** Steps drawn by the vector plane. */
export const VECTOR_STEPS = indices('kosinus', 'uzunluk-yon');
