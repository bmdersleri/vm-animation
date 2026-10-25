/** A preset the learner can pick instead of typing. */
export interface TextPreset {
  label: string;
  text: string;
}

export interface TextInputOptions {
  /** `data-param` of the `<input>`. */
  key: string;
  label: string;
  value: string;
  /** Longest text the box takes; default 200. */
  maxLength?: number;
  /** Quiet time after the last key before `onChange` runs; default 150 ms. */
  debounceMs?: number;
  /** When given, a `<select data-param="<key>-preset">` beside the box fills it. */
  presets?: TextPreset[];
}

export interface TextInputHandle {
  /** The `.ctl.text` wrapper (label, box, optional preset select). */
  box: HTMLElement;
  input: HTMLInputElement;
  presets: HTMLSelectElement | null;
  /** Writes the box from the page state; no callback, and a box the learner is typing in is left alone. */
  setValue(value: string): void;
}

let uid = 0;

/**
 * Adds a Lab text box (`<input type="text" data-param="<key>">`, optionally with a preset `<select>`) to `host`.
 * `onChange(text)` runs `debounceMs` after the last key, at once on blur / Enter and on a preset pick; the
 * text is cut to `maxLength`. Keydown on the controls stops here so the page's step shortcuts stay quiet.
 */
export function addTextInput(host: HTMLElement, opts: TextInputOptions, onChange: (value: string) => void): TextInputHandle {
  const doc = host.ownerDocument;
  const max = opts.maxLength ?? 200;
  const wait = opts.debounceMs ?? 150;
  const id = `text-input-${++uid}-${opts.key}`;
  const box = doc.createElement('div');
  box.className = 'ctl text';
  const label = doc.createElement('label');
  label.className = 'ctl-label';
  label.htmlFor = id;
  label.textContent = opts.label;
  const input = doc.createElement('input');
  input.type = 'text';
  input.id = id;
  input.maxLength = max;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.dataset.param = opts.key;
  input.value = opts.value.slice(0, max);
  box.append(label, input);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const fire = (): void => {
    clear();
    if (input.value.length > max) input.value = input.value.slice(0, max);
    onChange(input.value);
  };
  input.addEventListener('input', () => {
    clear();
    timer = setTimeout(fire, wait);
  });
  input.addEventListener('change', () => {
    if (timer !== null) fire();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && timer !== null) fire();
  });

  let presets: HTMLSelectElement | null = null;
  if (opts.presets && opts.presets.length > 0) {
    const list = opts.presets;
    presets = doc.createElement('select');
    presets.id = `${id}-preset`;
    presets.dataset.param = `${opts.key}-preset`;
    presets.setAttribute('aria-label', `${opts.label}: hazır örnek`);
    const first = doc.createElement('option');
    first.value = '';
    first.textContent = 'Hazır örnek seç…';
    presets.append(first);
    list.forEach((p, i) => {
      const o = doc.createElement('option');
      o.value = String(i);
      o.textContent = p.label;
      presets!.append(o);
    });
    const sel = presets;
    sel.addEventListener('change', () => {
      const p = list[Number(sel.value)];
      sel.value = '';
      if (!p) return;
      input.value = p.text.slice(0, max);
      fire();
    });
    box.append(presets);
  }

  // arrow keys, space and letters in the box belong to the box, not to the step shortcuts
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
  });
  host.append(box);

  return {
    box,
    input,
    presets,
    setValue(value: string): void {
      if (doc.activeElement === input || input.value === value) return;
      input.value = value.slice(0, max);
    },
  };
}
