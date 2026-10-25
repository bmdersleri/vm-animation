import { stepIndex, type StepPlayer } from '../../core/player';
import { addTextInput, type TextPreset } from '../../core/text-input';
import { BOOK } from '../metin/data';
import { docTable, similarity } from './calc';
import { SCAN_DONE, tfidfKosinusScenario as scenario, type TfidfParams } from './scenario';
import { commentDocs } from './view';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. */
export const TEXT_STEPS = indices('token', 'stop-word');
export const DOC_STEPS = indices('bow', 'idf', 'tfidf-norm', 'yan-yana');
export const TERM_STEPS = indices('bow', 'idf', 'yan-yana');
export const QUERY_STEPS = indices('kosinus', 'uzunluk-yon');
export const SEPARATE_STEPS = indices('ortak-sozluk');
const NORM_STEP = stepIndex(scenario, 'tfidf-norm');

/** Ready examples of the comment box: the book's comment, a negation and a shouting one. */
export const TEXT_PRESETS: TextPreset[] = [
  { label: 'Kitabın yorumu (kod01)', text: BOOK.kod01.text },
  { label: 'Olumsuzlama', text: 'hizmet kötü değil' },
  { label: 'Büyük harf ve noktalama', text: 'Bağlantı İYİ!!! 5G yok' },
];

type Field = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;

/**
 * Mounts the Lab controls of the TF-IDF page. Only the current step's controls are shown: the comment box with
 * the book's stop-word set and "değil" switches (steps 1 and 3), the three document boxes with the "book's
 * documents" button (4-7) and the term choice (4, 5 and 7), the query choice, the fourth document box and the
 * plane's two terms (8-9), and the separate-vocabulary switch (10). Step 2 has none, so its card is hidden.
 * Every control writes through `player.setParam(s)`; key presses on the controls do not reach the step shortcuts.
 */
export function mountTfidfParams(host: HTMLElement, player: StepPlayer<TfidfParams>): void {
  const doc = host.ownerDocument;
  const prefix = `tf-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'tf-params';
  host.append(wrap);
  const rows: { steps: readonly number[]; box: HTMLElement; input: Field }[] = [];
  const params = (): TfidfParams => player.state.params;

  const label = (text: string, input: HTMLElement): HTMLLabelElement => {
    const l = doc.createElement('label');
    l.className = 'ctl-label';
    l.htmlFor = input.id;
    l.textContent = text;
    return l;
  };

  const addText = (
    key: string,
    text: string,
    steps: readonly number[],
    value: string,
    set: (v: string) => void,
    presets?: TextPreset[],
  ) => {
    const h = addTextInput(wrap, { key, label: text, value, maxLength: 200, debounceMs: 150, presets }, set);
    rows.push({ steps, box: h.box, input: h.input });
    if (h.presets) rows.push({ steps, box: h.box, input: h.presets });
    return h;
  };

  const addToggle = (key: string, text: string, steps: readonly number[], set: (on: boolean) => void): HTMLInputElement => {
    const b = doc.createElement('div');
    b.className = 'ctl toggle';
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    b.append(input, label(text, input));
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => set(input.checked));
    return input;
  };

  const addSelect = (key: string, text: string, steps: readonly number[], set: (v: string) => void): HTMLSelectElement => {
    const b = doc.createElement('div');
    b.className = 'ctl select';
    const input = doc.createElement('select');
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    b.append(label(text, input), input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => set(input.value));
    return input;
  };

  const setOptions = (select: HTMLSelectElement, options: readonly { value: string; text: string }[], value: string): void => {
    const same =
      select.options.length === options.length &&
      options.every((o, i) => select.options[i].value === o.value && select.options[i].textContent === o.text);
    if (!same) {
      select.replaceChildren(
        ...options.map((o) => {
          const opt = doc.createElement('option');
          opt.value = o.value;
          opt.textContent = o.text;
          return opt;
        }),
      );
    }
    select.value = value;
  };

  // steps 1 and 3: comment box and the two stop-word switches
  const text = addText('text', 'Yorum', TEXT_STEPS, params().text, (v) => player.setParam('text', v), TEXT_PRESETS);
  const stop = addToggle('stop', 'Kitabın stop-word kümesi', TEXT_STEPS, (on) => player.setParam('stop', on));
  const degil = addToggle('degil', '"değil" stop-word olsun', TEXT_STEPS, (on) => player.setParam('degil', on));

  // steps 4-7: three documents, the book's documents, the highlighted term
  /** Writes the documents; on step 6 the row is shown finished (norm and division) for the new documents at once. */
  const setDocs = (docs: TfidfParams['docs']): void => {
    if (player.state.index === NORM_STEP) player.setParams({ docs, scan: SCAN_DONE });
    else player.setParam('docs', docs);
  };
  const docBoxes = [0, 1, 2].map((i) =>
    addText(`doc-${i}`, `Belge ${i}`, DOC_STEPS, params().docs[i], (v) => {
      const next = [...params().docs] as TfidfParams['docs'];
      next[i] = v;
      setDocs(next);
    }),
  );
  const reset = doc.createElement('div');
  reset.className = 'ctl action';
  const resetBtn = doc.createElement('button');
  resetBtn.type = 'button';
  resetBtn.id = `${prefix}-docs-reset`;
  resetBtn.dataset.action = 'docs-reset';
  resetBtn.textContent = 'Kitabın belgeleri (kod02)';
  reset.append(resetBtn);
  wrap.append(reset);
  rows.push({ steps: DOC_STEPS, box: reset, input: resetBtn });
  resetBtn.addEventListener('click', () => setDocs([...BOOK.kod02.docs] as TfidfParams['docs']));
  const term = addSelect('term', 'Vurgulanan terim', TERM_STEPS, (v) => player.setParam('term', v));

  // steps 8-9: query, fourth document, plane terms
  const query = addSelect('query', 'Sorgu belgesi', QUERY_STEPS, (v) => player.setParam('query', Number(v)));
  const extra = addText('extra', 'Dördüncü belge', QUERY_STEPS, params().extra, (v) => player.setParam('extra', v));
  const planeAt =
    (i: 0 | 1) =>
    (v: string): void => {
      const next: [string, string] = [...params().plane];
      next[i] = v;
      player.setParam('plane', next);
    };
  const planeX = addSelect('plane-0', 'Düzlemin birinci terimi', QUERY_STEPS, planeAt(0));
  const planeY = addSelect('plane-1', 'Düzlemin ikinci terimi', QUERY_STEPS, planeAt(1));

  // step 10
  const separate = addToggle('separate', 'Ayrı sözlük', SEPARATE_STEPS, (on) => player.setParam('separate', on));

  // key presses on the text boxes are stopped by addTextInput; bindKeys ignores the other form controls

  const sync = (): void => {
    const { index, params: p } = player.state;
    text.setValue(p.text);
    stop.checked = p.stop;
    degil.checked = p.degil;
    docBoxes.forEach((b, i) => b.setValue(p.docs[i]));
    const vocab = docTable(p.docs).vocab;
    setOptions(
      term,
      vocab.map((t) => ({ value: t, text: t })),
      vocab.includes(p.term) ? p.term : (vocab[0] ?? ''),
    );
    extra.setValue(p.extra);
    const s = similarity(commentDocs(p), p.query);
    setOptions(
      query,
      s.docs.map((_, i) => ({ value: String(i), text: `belge ${i}` })),
      String(s.query),
    );
    const planeOptions = [{ value: '', text: 'otomatik' }, ...s.vocab.map((t) => ({ value: t, text: t }))];
    setOptions(planeX, planeOptions, s.vocab.includes(p.plane[0]) ? p.plane[0] : '');
    setOptions(planeY, planeOptions, s.vocab.includes(p.plane[1]) ? p.plane[1] : '');
    separate.checked = p.separate;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      r.input.disabled = off;
      r.box.toggleAttribute('data-off', off);
    }
    // a step with no control at all (step 2) hides the whole card in Lab instead of an empty box
    const none = rows.every((r) => !r.steps.includes(index));
    wrap.toggleAttribute('data-off', none);
    host.toggleAttribute('data-off', none);
  };
  sync();
  player.subscribe(sync);
}
