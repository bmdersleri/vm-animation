/**
 * Shared formula-strip renderer: one `span.line` per "\n"-separated line and one
 * nowrap `span.term` per term, so long lines wrap only between terms. Terms are
 * split before " · ", " = " and " → ". The same text twice leaves the DOM alone.
 */
export function renderStrip(p: HTMLElement, text: string): void {
  if (p.dataset.strip === text) return;
  p.dataset.strip = text;
  const doc = p.ownerDocument;
  p.replaceChildren(...text.split('\n').map((line) => {
    const l = doc.createElement('span');
    l.className = 'line';
    const nodes: Node[] = [];
    line.split(/(?= · | = | → )/).forEach((t, i) => {
      if (i > 0) nodes.push(doc.createTextNode(' '));
      const s = doc.createElement('span');
      s.className = 'term';
      s.style.whiteSpace = 'nowrap';
      s.textContent = t.trim();
      nodes.push(s);
    });
    l.append(...nodes);
    return l;
  }));
}
