const last = new WeakMap<HTMLElement, string>();

/**
 * Shared formula-strip renderer: one `span.line` per "\n"-separated line and one
 * nowrap `span.term` per term, so long lines wrap only between terms. Terms are
 * split before " · ", " = " and " → ". The same text twice leaves the DOM alone.
 */
export function renderStrip(p: HTMLElement, text: string): void {
  if (last.get(p) === text) return;
  last.set(p, text);
  const doc = p.ownerDocument;
  p.replaceChildren(...text.split('\n').map((line) => {
    const l = doc.createElement('span');
    l.className = 'line';
    l.append(...line.split(/(?= · | = | → )/).map((t) => {
      const s = doc.createElement('span');
      s.className = 'term';
      s.style.whiteSpace = 'nowrap';
      s.textContent = t.trim();
      return s;
    }));
    return l;
  }));
}
