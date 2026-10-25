import { stepIndex, type StepPlayer } from '../../core/player';
import { formatNumber as f } from '../../core/plot/format';
import { CUSTOMERS, FEATURES, PRESETS } from '../xai/data';
import { orderings } from '../xai/shapley';
import { shapDegerleriScenario as scenario, type ShapParams } from './scenario';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows each control. */
export const CUSTOMER_STEPS = indices('kara-kutu', 'koalisyon', 'marjinal', 'alti-siralama', 'toplam', 'kuvvet');
export const ORDER_STEPS = indices('marjinal');
export const SECOND_STEPS = indices('kuvvet');
export const SWARM_STEPS = indices('ozet-grafik');

/** Short notes of the four preset customers, in `PRESETS` order. */
const NOTES = ['kitabın müşterisi', 'SHAP ile LIME ayrışır', 'MonthlyCharges baskın', 'düşük risk'];

/** Customer options: the four presets first with their notes, then every other test customer with its p. */
export function customerOptions(): { value: string; text: string }[] {
  const presets = PRESETS.map((row, i) => ({ value: String(row), text: `müşteri ${row} · ${NOTES[i]}` }));
  const rest = CUSTOMERS.filter((c) => !(PRESETS as readonly number[]).includes(c.row)).map((c) => ({
    value: String(c.row),
    text: `müşteri ${c.row} · p ${f(c.p, 3)}`,
  }));
  return [...presets, ...rest];
}

type Field = HTMLSelectElement;

/**
 * Mounts the Lab controls of the SHAP page; only the current step's controls are shown: the customer choice
 * (steps 1, 3-7), the ordering (4), the second force bar's customer (7), the highlighted customer and the colour
 * feature (9). Steps 2, 8 and 10 have none, so their card is hidden. Every control writes through
 * `player.setParam`; key presses on the selects do not reach the step shortcuts (`bindKeys` ignores form controls).
 */
export function mountShapParams(host: HTMLElement, player: StepPlayer<ShapParams>): void {
  const doc = host.ownerDocument;
  const prefix = `shap-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'shap-params';
  host.append(wrap);
  const rows: { steps: readonly number[]; box: HTMLElement; input: Field }[] = [];

  const addSelect = (
    key: keyof ShapParams,
    text: string,
    steps: readonly number[],
    options: readonly { value: string; text: string }[],
  ): HTMLSelectElement => {
    const b = doc.createElement('div');
    b.className = 'ctl select';
    const input = doc.createElement('select');
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    input.replaceChildren(
      ...options.map((o) => {
        const opt = doc.createElement('option');
        opt.value = o.value;
        opt.textContent = o.text;
        return opt;
      }),
    );
    b.append(label, input);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => player.setParam(key, Number(input.value) as never));
    return input;
  };

  const customers = customerOptions();
  const orderOptions = orderings().map((o, i) => ({ value: String(i), text: o.map((k) => FEATURES[k]).join(' → ') }));
  const colorOptions = [{ value: '-1', text: 'her satırın kendi özelliği' }, ...FEATURES.map((name, i) => ({ value: String(i), text: name }))];
  const customer = addSelect('customer', 'Müşteri', CUSTOMER_STEPS, customers);
  const order = addSelect('order', 'Sıralama', ORDER_STEPS, orderOptions);
  const second = addSelect('second', 'İkinci müşteri', SECOND_STEPS, customers);
  const highlight = addSelect('highlight', 'Vurgulanan müşteri', SWARM_STEPS, customers);
  const colorBy = addSelect('colorBy', 'Renk için özellik', SWARM_STEPS, colorOptions);

  const sync = (): void => {
    const { index, params: p } = player.state;
    customer.value = String(p.customer);
    order.value = String(p.order);
    second.value = String(p.second);
    highlight.value = String(p.highlight);
    colorBy.value = String(p.colorBy);
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
