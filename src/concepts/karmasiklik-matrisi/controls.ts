import type { StepPlayer } from '../../core/player';
import type { MatrixParams } from './scenario';
import { html } from './ui';

let uid = 0;
export function mountMatrixParams(host: HTMLElement, player: StepPlayer<MatrixParams>): { destroy(): void } {
  const id = `matrix-params-${++uid}`;
  const listeners: (() => void)[] = [];
  const fields = new Map<keyof MatrixParams, HTMLInputElement>();
  const on = (node: HTMLElement, event: string, fn: () => void): void => {
    node.addEventListener(event, fn); listeners.push(() => node.removeEventListener(event, fn));
  };
  const counts = html('fieldset', { 'data-control': 'counts', class: 'matrix-controls' }, html('legend', {}, 'Kaynak model sayımları'));
  const costs = html('fieldset', { 'data-control': 'costs', class: 'matrix-controls' }, html('legend', {}, 'Birim hata maliyeti'));
  const invalid = html('p', { class: 'matrix-input-hint', id: `${id}-hint` }, 'Sayımlar: 0–100 tamsayı. Maliyetler: 0–100.');
  for (const [key, label] of [['tn', 'TN · Doğru kaldı'], ['fp', 'FP · Yanlış ayrıldı'], ['fn', 'FN · Kaçan ayrıldı'], ['tp', 'TP · Doğru ayrıldı'], ['fpCost', 'FP birim maliyeti'], ['fnCost', 'FN birim maliyeti']] as const) {
    const input = html('input', { id: `${id}-${key}`, name: key, type: 'number', min: '0', max: '100', step: key.endsWith('Cost') ? 'any' : '1', 'aria-describedby': invalid.id });
    fields.set(key, input);
    on(input, 'input', () => {
      const value = input.valueAsNumber;
      const valid = input.value !== '' && Number.isFinite(value) && value >= 0 && value <= 100 && (key.endsWith('Cost') || Number.isInteger(value));
      input.setAttribute('aria-invalid', String(!valid));
      if (valid) player.setParam(key, value);
    });
    (key.endsWith('Cost') ? costs : counts).append(html('label', { for: input.id }, label, input));
  }
  const select = html('select', { id: `${id}-model`, name: 'model' }, html('option', { value: 'model' }, 'Kaynak model'), html('option', { value: 'dummy' }, 'Herkese kalır'));
  const model = html('div', { 'data-control': 'model', class: 'matrix-model-control' }, html('label', { for: select.id }, 'Matriste gösterilen model', select));
  on(select, 'change', () => { if (select.value === 'model' || select.value === 'dummy') player.setParam('model', select.value); });
  const initial = html('p', { class: 'matrix-input-hint' }, 'İlk iki adım sabit örneği tanıtır. Üçüncü adımdan sonra sayımları değiştirebilirsiniz.');
  const root = html('div', { class: 'matrix-params' }, initial, model, counts, costs, invalid);
  host.append(root);
  const sync = (): void => {
    const { index, params } = player.state;
    initial.hidden = index >= 2;
    counts.hidden = index < 2;
    model.hidden = index < 6;
    costs.hidden = index !== 7;
    invalid.hidden = index < 2;
    for (const [key, input] of fields) {
      input.value = String(params[key]);
      input.setAttribute('aria-invalid', 'false');
    }
    select.value = params.model;
  };
  sync();
  const unsubscribe = player.subscribe(sync);
  return { destroy() { unsubscribe(); listeners.forEach(fn => fn()); root.remove(); } };
}
