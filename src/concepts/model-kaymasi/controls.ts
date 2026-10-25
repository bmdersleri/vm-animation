import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { SCENARIO_IDS, scenarioById } from './data';
import { ESIK, LAB_MONTHS, THRESHOLD, modelKaymasiScenario as scenario, type KaymaParams, type Metric } from './scenario';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows the control: step 3 the threshold, 4-8 the scenario, 5-6 the measure and its threshold, 7-8 the month, 10 the code switch. */
export const ESIK_STEPS = indices('fark-esik');
export const SCENARIO_STEPS = indices('veri-kavram', 'aylik-izleme', 'esik-secimi', 'ortalama-yaniltir', 'psi');
export const MONITOR_STEPS = indices('aylik-izleme', 'esik-secimi');
export const MONTH_STEPS = indices('ortalama-yaniltir', 'psi');
export const CODE_STEPS = indices('hata-ayiklama');

interface Row {
  steps: readonly number[];
  box: HTMLElement;
  input: HTMLSelectElement | HTMLInputElement;
}

const cap = (s: string): string => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
const thresholdText = (metric: Metric, v: number): string => f(v, metric === 'mean' ? 1 : 2);

/**
 * Mounts the Lab controls of the model drift page; only the current step's controls are shown: the threshold slider
 * (step 3), the scenario (steps 4-8), the measure and its threshold slider (steps 5-6), the month (steps 7-8) and the
 * "corrected code" switch (step 10). Steps 1, 2 and 9 have none, so their card is hidden. Changing the measure brings
 * the new measure's default threshold and range. Every control writes through `player`; key presses on the controls
 * do not reach the step shortcuts (`bindKeys` ignores form controls).
 */
export function mountKaymaParams(host: HTMLElement, player: StepPlayer<KaymaParams>): void {
  const doc = host.ownerDocument;
  const prefix = `kayma-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'kayma-params';
  host.append(wrap);
  const rows: Row[] = [];

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
    onChange: (value: string) => void,
  ): HTMLSelectElement => {
    const b = doc.createElement('div');
    b.className = 'ctl select';
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
    input.addEventListener('change', () => onChange(input.value));
    return input;
  };

  const addRange = (
    key: string,
    text: string,
    steps: readonly number[],
    valueCls: string,
    onInput: (value: number) => void,
  ): { input: HTMLInputElement; value: HTMLElement } => {
    const b = doc.createElement('div');
    b.className = 'ctl range';
    const input = doc.createElement('input');
    input.type = 'range';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    const value = doc.createElement('output');
    value.className = valueCls;
    value.htmlFor = input.id;
    const head = doc.createElement('div');
    head.className = 'ctl-head';
    head.append(label(text, input), value);
    b.append(head, input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('input', () => onInput(Number(input.value)));
    return { input, value };
  };

  const esik = addRange('esik', 'Eşik (esik)', ESIK_STEPS, 'esik-value', (v) => player.setParam('esik', v));
  esik.input.min = String(ESIK.min);
  esik.input.max = String(ESIK.max);
  esik.input.step = String(ESIK.step);

  const scenarioSel = addSelect(
    'scenario',
    'Senaryo',
    SCENARIO_STEPS,
    SCENARIO_IDS.map((id, i) => ({ value: String(i), text: cap(scenarioById(id).name) })),
    (v) => player.setParam('scenario', Number(v)),
  );
  const metricSel = addSelect(
    'metric',
    'Ölçü',
    MONITOR_STEPS,
    [{ value: 'mean', text: 'ortalama farkı' }, { value: 'psi', text: 'PSI' }],
    (v) => {
      const metric = v as Metric;
      player.setParams({ metric, threshold: THRESHOLD[metric].def });
    },
  );
  const threshold = addRange('threshold', 'Eşik', MONITOR_STEPS, 'threshold-value', (v) => player.setParam('threshold', v));
  const monthSel = addSelect(
    'month',
    'Ay',
    MONTH_STEPS,
    Array.from({ length: LAB_MONTHS.max - LAB_MONTHS.min + 1 }, (_v, i) => ({
      value: String(LAB_MONTHS.min + i),
      text: `ay ${LAB_MONTHS.min + i}`,
    })),
    (v) => player.setParam('month', Number(v)),
  );

  const fixedBox = doc.createElement('div');
  fixedBox.className = 'ctl check';
  const fixed = doc.createElement('input');
  fixed.type = 'checkbox';
  fixed.id = `${prefix}-fixed`;
  fixed.dataset.param = 'fixed';
  fixedBox.append(fixed, label('düzeltilmiş kodu göster', fixed));
  wrap.append(fixedBox);
  rows.push({ steps: CODE_STEPS, box: fixedBox, input: fixed });
  fixed.addEventListener('change', () => player.setParam('fixed', fixed.checked));

  const sync = (): void => {
    const { index, params: p } = player.state;
    esik.input.value = String(p.esik);
    esik.value.textContent = f(p.esik, 1);
    scenarioSel.value = String(p.scenario);
    metricSel.value = p.metric;
    const range = THRESHOLD[p.metric];
    threshold.input.min = String(range.min);
    threshold.input.max = String(range.max);
    threshold.input.step = String(range.step);
    threshold.input.value = String(p.threshold);
    threshold.value.textContent = thresholdText(p.metric, p.threshold);
    monthSel.value = String(p.month);
    fixed.checked = p.fixed;
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
