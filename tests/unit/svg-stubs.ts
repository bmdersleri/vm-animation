// Side-effect module: fills the jsdom gaps d3-transition needs to tween transforms.
class FakeMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor(s = '') {
    const t = /translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)/.exec(s);
    const m = /matrix\(([^)]+)\)/.exec(s);
    if (t) { this.e = Number(t[1]); this.f = Number(t[2]); }
    else if (m) [this.a, this.b, this.c, this.d, this.e, this.f] = m[1].split(',').map(Number);
  }
  get isIdentity(): boolean { return this.e === 0 && this.f === 0 && this.a === 1 && this.d === 1; }
}
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= FakeMatrix;

function defineTransform(proto: object): void {
  if ('transform' in proto) return;
  Object.defineProperty(proto, 'transform', {
    configurable: true,
    get(this: Element) {
      const attr = this.getAttribute('transform') ?? '';
      return {
        baseVal: {
          consolidate: () => {
            const t = /translate\(\s*(-?[\d.e+-]+)\s*(?:,|\s)\s*(-?[\d.e+-]+)/.exec(attr);
            const r = /rotate\(\s*(-?[\d.e+-]+)/.exec(attr);
            const rad = r ? (Number(r[1]) * Math.PI) / 180 : 0;
            return { matrix: { a: Math.cos(rad), b: Math.sin(rad), c: -Math.sin(rad), d: Math.cos(rad), e: t ? Number(t[1]) : 0, f: t ? Number(t[2]) : 0 } };
          },
        },
      };
    },
  });
}
defineTransform(SVGGElement.prototype);
// jsdom has no SVGPathElement / SVGTextElement interfaces; their instances are plain SVGElements
for (const tag of ['path', 'text']) {
  defineTransform(Object.getPrototypeOf(document.createElementNS('http://www.w3.org/2000/svg', tag)));
}
