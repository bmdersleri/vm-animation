import type { StepPlayer } from './player';

export interface Shortcut {
  keys: string[];
  label: string;
  run(): void;
}

const TEXT_INPUT_TYPES = new Set([
  '', 'text', 'search', 'url', 'tel', 'email', 'password', 'number',
  'date', 'datetime-local', 'month', 'time', 'week',
]);

function asElement(t: EventTarget | null): HTMLElement | null {
  return t !== null && (t as Node).nodeType === 1 ? (t as HTMLElement) : null;
}

export function isFormControl(el: EventTarget | null): boolean {
  const e = asElement(el);
  if (!e) return false;
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return true;
  if (e.isContentEditable) return true;
  const ce = e.getAttribute('contenteditable');
  return ce !== null && ce.toLowerCase() !== 'false';
}

function isTextEntry(el: EventTarget | null): boolean {
  const e = asElement(el);
  if (!e) return false;
  const tag = e.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') return TEXT_INPUT_TYPES.has(((e as HTMLInputElement).type || '').toLowerCase());
  return isFormControl(e) && tag !== 'select' && tag !== 'button';
}

function isSelect(el: EventTarget | null): boolean {
  return asElement(el)?.tagName.toLowerCase() === 'select';
}

export function bindKeys(
  target: Window,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player: StepPlayer<any>,
  actions: { toggleFullscreen(): void; toggleHelp(): void },
  extra: Shortcut[],
): () => void {
  const handler = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const control = isFormControl(e.target);
    const typing = isTextEntry(e.target);
    const done = (fn: () => void): void => {
      e.preventDefault();
      fn();
    };

    if (!control) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          return done(() => player.next());
        case 'ArrowLeft':
          return done(() => player.prev());
        case 'Home':
          return done(() => player.first());
        case 'End':
          return done(() => player.last());
      }
    }
    // A focused <select> uses letters for native type-ahead ('S' would both
    // pick an option and toggle scaling), so it gets no letter shortcuts.
    if (typing || isSelect(e.target)) return;
    switch (e.key) {
      case 'p':
      case 'P':
        return done(() => player.togglePlay());
      case 'f':
      case 'F':
        if (e.repeat) return;
        return done(() => actions.toggleFullscreen());
      case '?':
        if (e.repeat) return;
        return done(() => actions.toggleHelp());
    }
    const sc = extra.find((s) => s.keys.includes(e.key));
    if (sc) done(() => sc.run());
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
