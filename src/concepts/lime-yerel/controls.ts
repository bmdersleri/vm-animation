import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { CUSTOMERS, PRESETS, SAMPLE_SIZES } from '../xai/data';
import { SCAN_DONE, limeYerelScenario as scenario, type LimeParams } from './scenario';
import { codeState } from './view';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. */
export const CUSTOMER_STEPS = indices('kartil', 'komsuluk', 'ikili', 'cekirdek', 'vekil', 'sadakat', 'kararlilik');
export const WIDTH_STEPS = indices('cekirdek', 'vekil', 'sadakat');
export const SAMPLES_STEPS = indices('cekirdek', 'vekil', 'sadakat', 'kararlilik');
export const COMPARE_STEPS = indices('shap-lime');
export const FIXED_STEPS = indices('hata-ayiklama');

/** Kernel width range of the slider: smallest, largest, step. */
export const WIDTH_RANGE = [0.3, 4, 0.01] as const;

/** Short notes of the four preset customers, in `PRESETS` order. */
const NOTES = ['kitabın müşterisi', 'SHAP ile LIME ayrışır', 'MonthlyCharges baskın', 'düşük risk'];

/** The four preset customers (the ones the LIME runs are prepared for), each with its note. */
export function presetOptions(): { value: string; text: string }[] {
  return PRESETS.map((row, i) => ({ value: String(row), text: `müşteri ${row} · ${NOTES[i]}` }));
}

/** All 100 test customers: the four presets first with their notes, then every other one with its p. */
export function customerOptions(): { value: string; text: string }[] {
  const rest = CUSTOMERS.filter((c) => !(PRESETS as readonly number[]).includes(c.row)).map((c) => ({
    value: String(c.row),
    text: `müşteri ${c.row} · p ${f(c.p, 3)}`,
  }));
  return [...presetOptions(), ...rest];
}

type Field = HTMLSelectElement | HTMLInputElement;

/**
 * Mounts the Lab controls of the LIME page; only the current step's controls are shown: the preset customer
 * (steps 2-8), the kernel width slider (5-7), the sample size (5-8), the compared customer among the 100 (9) and
 * the "show the corrected code" switch (10). Step 1 has none, so its card is hidden. Every control writes through
 * `player.setParam(s)`; key presses on a control do not reach the step shortcuts.
 */
export function mountLimeParams(host: HTMLElement, player: StepPlayer<LimeParams>): void {
  const doc = host.ownerDocument;
  const prefix = `lime-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'lime-params';
  host.append(wrap);
  const rows: { steps: readonly number[]; box: HTMLElement; input: Field }[] = [];

  const box = (cls: string): HTMLElement => {
    const b = doc.createElement('div');
    b.className = `ctl ${cls}`;
    return b;
  };
  const label = (text: string, input: HTMLElement): HTMLLabelElement => {
    const l = doc.createElement('label');
    l.className = 'ctl-label';
    l.htmlFor = input.id;
    l.textContent = text;
    return l;
  };

  const addSelect = (
    key: string,
    text: string,
    steps: readonly number[],
    options: readonly { value: string; text: string }[],
    set: (value: number) => void,
  ): HTMLSelectElement => {
    const b = box('select');
    const input = doc.createElement('select');
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    input.replaceChildren(
      ...options.map((o) => {
        const opt = doc.createElement('option');
        opt.value = o.value;
        opt.textContent = o.text;
        return opt;
      }),
    );
    b.append(label(text, input), input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => set(Number(input.value)));
    return input;
  };

  const customer = addSelect('customer', 'Müşteri', CUSTOMER_STEPS, presetOptions(), (v) => player.setParam('customer', v));

  // kernel width slider; its readout shows three decimals (the default is not a multiple of the step)
  const sliderBox = box('range');
  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.id = `${prefix}-width`;
  slider.dataset.param = 'width';
  slider.min = String(WIDTH_RANGE[0]);
  slider.max = String(WIDTH_RANGE[1]);
  slider.step = String(WIDTH_RANGE[2]);
  const output = doc.createElement('output');
  output.htmlFor = slider.id;
  output.className = 'width-value';
  sliderBox.append(label('Çekirdek genişliği', slider), output, slider);
  wrap.append(sliderBox);
  rows.push({ steps: WIDTH_STEPS, box: sliderBox, input: slider });
  slider.addEventListener('input', () => player.setParam('width', Number(slider.value)));

  const samples = addSelect(
    'samples',
    'Örnek sayısı',
    SAMPLES_STEPS,
    SAMPLE_SIZES.map((n) => ({ value: String(n), text: String(n) })),
    (v) => player.setParam('samples', v),
  );
  // a choice made while the Ders sweep still shows the book customer ends the sweep on the pair of panels
  const compare = addSelect('compare', 'Karşılaştırılan müşteri', COMPARE_STEPS, customerOptions(), (v) =>
    player.setParams({ compare: v, scan: SCAN_DONE }),
  );

  // the sweep's last position (6) already shows the corrected code, so switching off also steps back to five marked bugs
  const fixedBox = box('toggle');
  const fixed = doc.createElement('input');
  fixed.type = 'checkbox';
  fixed.id = `${prefix}-fixed`;
  fixed.dataset.param = 'fixed';
  fixedBox.append(fixed, label('Düzeltilmiş kodu göster', fixed));
  wrap.append(fixedBox);
  rows.push({ steps: FIXED_STEPS, box: fixedBox, input: fixed });
  fixed.addEventListener('change', () => player.setParams(fixed.checked ? { fixed: true } : { fixed: false, scan: 5 }));

  // arrow keys, space and letters on a control belong to the control, not to the step shortcuts
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Tab') {
      e.stopPropagation();
    }
  });

  const sync = (): void => {
    const { index, params: p } = player.state;
    customer.value = String(p.customer);
    samples.value = String(p.samples);
    compare.value = String(p.compare);
    const w = Math.max(WIDTH_RANGE[0], Math.min(WIDTH_RANGE[1], p.width));
    // keep the slider's own (stepped) value while it is within a step of the parameter
    if (Math.abs(Number(slider.value) - w) > WIDTH_RANGE[2]) {
      slider.value = String(w);
    }
    output.textContent = f(p.width, 3);
    fixed.checked = codeState(p).fixed;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      r.input.disabled = off;
      r.box.toggleAttribute('data-off', off);
    }
    // a step with no control at all hides the whole card in Lab instead of an empty box
    const none = rows.every((r) => !r.steps.includes(index));
    wrap.toggleAttribute('data-off', none);
    host.toggleAttribute('data-off', none);
  };
  sync();
  player.subscribe(sync);
}
