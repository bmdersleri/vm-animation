import { stepIndex, type StepPlayer } from '../../core/player';
import { DAY_OPTIONS } from './data';
import { crispDmScenario as scenario, type CrispParams } from './scenario';

let uid = 0;

const indices = (...ids: string[]): number[] => ids.map((id) => stepIndex(scenario, id));

/** Steps whose Lab shows the four choices (4-9) and the debugging switch (10). */
export const CHOICE_STEPS = indices('veri-yeterli', 'eksik-sifir-degil', 'sizinti', 'modelleme', 'degerlendirme', 'ikinci-tur');
export const CODE_STEPS = indices('hata-ayiklama');

interface Row {
  steps: readonly number[];
  box: HTMLElement;
  input: HTMLSelectElement | HTMLInputElement;
}

/**
 * Mounts the Lab controls of the CRISP-DM page; only the current step's controls are shown: the four choices
 * (training days, missing value handling, stock-out handling, the leaking input) on steps 4-9 and the "corrected
 * code" switch on step 10. Steps 1-3 have none, so their card is hidden. Every control writes through
 * `player.setParam`; key presses on the controls do not reach the step shortcuts (`bindKeys` ignores form controls).
 */
export function mountCrispParams(host: HTMLElement, player: StepPlayer<CrispParams>): void {
  const doc = host.ownerDocument;
  const prefix = `crisp-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'crisp-params';
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
    key: 'days' | 'missing' | 'stock',
    text: string,
    options: readonly { value: string; text: string }[],
    read: (value: string) => CrispParams[typeof key],
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
    rows.push({ steps: CHOICE_STEPS, box: b, input });
    input.addEventListener('change', () => player.setParam(key, read(input.value) as never));
    return input;
  };

  const addCheck = (key: 'leak' | 'fixed', text: string, steps: readonly number[]): HTMLInputElement => {
    const b = doc.createElement('div');
    b.className = 'ctl check';
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = `${prefix}-${key}`;
    input.dataset.param = key;
    const l = label(text, input);
    b.append(input, l);
    wrap.append(b);
    rows.push({ steps, box: b, input });
    input.addEventListener('change', () => player.setParam(key, input.checked as never));
    return input;
  };

  const days = addSelect('days', 'Eğitim günü', DAY_OPTIONS.map((d) => ({ value: String(d), text: `${d} gün` })), (v) => Number(v) as CrispParams['days']);
  const missing = addSelect(
    'missing',
    'Eksik değer',
    [{ value: 'sifir', text: '0 ile doldur' }, { value: 'cikar', text: 'işaretle ve çıkar' }],
    (v) => v as CrispParams['missing'],
  );
  const stock = addSelect(
    'stock',
    'Stok tükenen gün',
    [{ value: 'satis', text: 'satış = talep say' }, { value: 'soran', text: 'satış + soran (alt sınır)' }],
    (v) => v as CrispParams['stock'],
  );
  const leak = addCheck('leak', 'ay_sonu_israfi girdide', CHOICE_STEPS);
  const fixed = addCheck('fixed', 'düzeltilmiş kodu göster', CODE_STEPS);

  const sync = (): void => {
    const { index, params: p } = player.state;
    days.value = String(p.days);
    missing.value = p.missing;
    stock.value = p.stock;
    leak.checked = p.leak;
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
