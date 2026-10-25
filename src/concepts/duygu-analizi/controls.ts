import { stepIndex, type StepPlayer } from '../../core/player';
import { addTextInput, type TextPreset } from '../../core/text-input';
import { DRIFT } from '../metin/data';
import { HATALAR, NEGATION, NEW_COMMENT, settingsOf } from './calc';
import { duyguAnaliziScenario as scenario, type SentimentParams } from './scenario';
import { commentOf, FAULTY_ALL, showsFixed, TOP_RANGE } from './view';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. Step 1 has none (the flow strip does not depend on the model). */
export const BIGRAM_STEPS = indices('boru-hatti', 'kelime-agirlik', 'yorum-skor', 'test-sonuc', 'degil-tuzagi', 'sozluk-kaymasi');
export const TOPN_STEPS = indices('kelime-agirlik');
/** Step 6 always compares unigram with bigram, so its bigram switch is not shown; "değil" applies to both models. */
export const TEXT_STEPS = indices('yorum-skor', 'bigram', 'degil-tuzagi');
export const DRIFT_TEXT_STEPS = indices('sozluk-kaymasi');
export const DEGIL_STEPS = indices('yorum-skor', 'bigram', 'degil-tuzagi', 'sozluk-kaymasi');
export const LEAKY_STEPS = indices('sizinti');
export const FIXED_STEPS = indices('hata-ayiklama');

/** Ready examples of the comment box (steps 4, 6, 7): the book's comment, the negation example, the book's sentence and an unseen-word comment. */
export const TEXT_PRESETS: TextPreset[] = [
  { label: 'Kitabın yeni yorumu (kod04)', text: NEW_COMMENT },
  { label: 'Olumsuzlama örneği (külliyattan)', text: NEGATION.text },
  { label: 'Kitabın cümlesi', text: 'Hizmet kötü değil' },
  { label: 'Yalnız sözlük dışı kelimeler', text: DRIFT.comments[DRIFT.allNew[0]].text },
];

const shorten = (t: string): string => (t.length > 44 ? `${t.slice(0, 43)}…` : t);

/**
 * Ready examples of step 9's box: new-period comments. The first four are comments whose every token is unseen
 * (vector zero, p from the intercept), then two that mix an unseen term with known words.
 */
export const DRIFT_PRESETS: TextPreset[] = [
  ...DRIFT.allNew.slice(0, 4),
  ...DRIFT.comments.map((_, i) => i).filter((i) => !DRIFT.allNew.includes(i)).slice(0, 2),
].map((i, n) => ({ label: `Yeni dönem ${n + 1}: ${shorten(DRIFT.comments[i].text)}`, text: DRIFT.comments[i].text }));

type Field = HTMLInputElement | HTMLSelectElement | HTMLButtonElement;

/**
 * Mounts the Lab controls of the sentiment page. Only the current step's controls are shown: the bigram switch
 * (steps 2-5, 7, 9; step 6 compares both models, so none there), the term count slider (3), the comment box with
 * ready examples (4, 6, 7) or the new-period examples (9), the "değil" stop-word switch (4, 6, 7, 9), the leaky
 * vectoriser switch (8) and the corrected-code switch (10). Step 1 has none, so its card is hidden. A switch
 * shows the step's own model until the learner chooses; a choice holds on every later step it applies to.
 * Every control writes through `player.setParam`; key presses in the text boxes do not reach the step shortcuts.
 */
export function mountSentimentParams(host: HTMLElement, player: StepPlayer<SentimentParams>): void {
  const doc = host.ownerDocument;
  const prefix = `sa-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'sa-params';
  host.append(wrap);
  const rows: { steps: readonly number[]; box: HTMLElement; input: Field }[] = [];

  const label = (text: string, input: HTMLElement): HTMLLabelElement => {
    const l = doc.createElement('label');
    l.className = 'ctl-label';
    l.htmlFor = input.id;
    l.textContent = text;
    return l;
  };

  const addText = (key: string, text: string, steps: readonly number[], presets: TextPreset[]) => {
    const h = addTextInput(wrap, { key, label: text, value: '', maxLength: 200, debounceMs: 150, presets }, (v) => player.setParam('text', v));
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

  const addSlider = (key: string, text: string, steps: readonly number[], set: (v: number) => void): { input: HTMLInputElement; output: HTMLOutputElement } => {
    const b = doc.createElement('div');
    b.className = 'ctl range';
    const input = doc.createElement('input');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    input.min = String(TOP_RANGE.min);
    input.max = String(TOP_RANGE.max);
    input.step = '1';
    const output = doc.createElement('output');
    output.htmlFor = input.id;
    output.className = 'sa-value';
    b.append(label(text, input), output, input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('input', () => set(Number(input.value)));
    return { input, output };
  };

  const text = addText('text', 'Yorum', TEXT_STEPS, TEXT_PRESETS);
  const textNew = addText('text-new', 'Yeni dönem yorumu', DRIFT_TEXT_STEPS, DRIFT_PRESETS);
  const bigram = addToggle('bigram', 'Bigram (unigram + bigram model)', BIGRAM_STEPS, (on) => player.setParam('bigram', on));
  const degil = addToggle('degilStop', '"değil" stop-word olsun', DEGIL_STEPS, (on) => player.setParam('degilStop', on));
  const topN = addSlider('topN', 'Her yönde gösterilen terim', TOPN_STEPS, (v) => player.setParam('topN', v));
  const leaky = addToggle('leaky', 'Vektörleştirici tüm veride öğrenilsin (sızıntılı)', LEAKY_STEPS, (on) => player.setParam('leaky', on));
  const fixed = addToggle('fixed', 'Düzeltilmiş kodu göster', FIXED_STEPS, (on) => player.setParams(on ? { fixed: true, bug: HATALAR.length } : FAULTY_ALL));

  // key presses on the text boxes are stopped by addTextInput; bindKeys ignores the other form controls

  const sync = (): void => {
    const { index, params: p } = player.state;
    const id = scenario.steps[index].id;
    const own = settingsOf(id, p);
    // the boxes show the comment the step analyses: the learner's, else the step's own
    text.setValue(commentOf(id, p));
    textNew.setValue(commentOf(id, p));
    bigram.checked = own.bigram;
    degil.checked = own.degilStop;
    leaky.checked = settingsOf('sizinti', p).leaky;
    fixed.checked = showsFixed(p);
    const n = Math.max(TOP_RANGE.min, Math.min(TOP_RANGE.max, Math.round(Number.isFinite(p.topN) ? p.topN : 10)));
    topN.input.value = String(n);
    topN.output.textContent = String(n);
    for (const r of rows) {
      const off = !r.steps.includes(index);
      r.input.disabled = off;
      r.box.toggleAttribute('data-off', off);
    }
    // a step with no control at all (step 1) hides the whole card in Lab instead of an empty box
    const none = rows.every((r) => !r.steps.includes(index));
    wrap.toggleAttribute('data-off', none);
    host.toggleAttribute('data-off', none);
  };
  sync();
  player.subscribe(sync);
}
