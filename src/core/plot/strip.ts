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
      s.textContent = t.trim();
      nodes.push(s);
    });
    l.append(...nodes);
    return l;
  }));
}

/**
 * Lets a long code term of the strip wrap after "(" and between the parts of a dotted name, so an identifier such as
 * "musteri" is never cut mid-word (the term wraps at spaces otherwise). Call it after `renderStrip`; a page whose
 * strip carries code keeps `overflow-wrap:normal` on its terms so the browser breaks only at these points.
 */
export function allowCodeBreaks(strip: HTMLElement): void {
  if (strip.dataset.breaks === strip.dataset.strip) {
    return;
  }
  strip.dataset.breaks = strip.dataset.strip;
  for (const term of strip.querySelectorAll('.term')) {
    const text = term.textContent ?? '';
    if (!/\(\S|[A-Za-z_]\.[A-Za-z_]/.test(text)) {
      continue;
    }
    const doc = term.ownerDocument;
    const parts = text.split(/(?<=\()(?=\S)|(?<=[A-Za-z_]\.)(?=[A-Za-z_])/);
    term.replaceChildren(...parts.flatMap((part, i) => (i === 0 ? [doc.createTextNode(part)] : [doc.createElement('wbr'), doc.createTextNode(part)])));
  }
}
