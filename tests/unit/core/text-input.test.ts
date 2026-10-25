// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTextInput } from '../../../src/core/text-input';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function setup(onChange = vi.fn(), presets?: { label: string; text: string }[]) {
  const host = document.createElement('div');
  document.body.append(host);
  const box = addTextInput(host, { key: 'text', label: 'Yorum', value: 'merhaba', maxLength: 200, debounceMs: 150, presets }, onChange);
  return { host, box, onChange };
}

const type = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('addTextInput', () => {
  it('typing calls back after the debounce', () => {
    const { box, onChange } = setup();
    expect(box.input.dataset.param).toBe('text');
    expect(box.input.value).toBe('merhaba');
    type(box.input, 'a');
    type(box.input, 'ab');
    vi.advanceTimersByTime(149);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('max length is two hundred', () => {
    const { box, onChange } = setup();
    expect(box.input.maxLength).toBe(200);
    type(box.input, 'x'.repeat(300));
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledWith('x'.repeat(200));
    expect(box.input.value).toHaveLength(200);
  });

  it('keydown does not reach the page', () => {
    const { box } = setup();
    const page = vi.fn();
    window.addEventListener('keydown', page);
    box.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(page).not.toHaveBeenCalled();
    window.removeEventListener('keydown', page);
  });

  it('a preset fills the box and calls back at once', () => {
    const { box, onChange } = setup(vi.fn(), [{ label: 'Örnek', text: 'hizmet kötü değil' }]);
    const select = box.presets!;
    select.value = '0';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(box.input.value).toBe('hizmet kötü değil');
    expect(onChange).toHaveBeenCalledWith('hizmet kötü değil');
  });

  it('setValue writes the box without calling back, unless the user is typing in it', () => {
    const { box, onChange } = setup();
    box.setValue('yeni');
    expect(box.input.value).toBe('yeni');
    box.input.focus();
    box.setValue('baska');
    expect(box.input.value).toBe('yeni');
    expect(onChange).not.toHaveBeenCalled();
  });
});
