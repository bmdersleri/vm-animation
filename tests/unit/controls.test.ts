// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../src/core/player';
import { mountConceptPage } from '../../src/core/shell';
import { knnScenario, type KnnParams } from '../../src/concepts/knn/scenario';
import { demo, customers, type RawPoint } from '../../src/concepts/knn/data';
import { featureSpace } from '../../src/concepts/knn/space';
import { deriveKnnView } from '../../src/concepts/knn/view';
import { formatNumber } from '../../src/concepts/knn/scene-layout';
import { mountKnnParams } from '../../src/concepts/knn/controls';
import { mountKnnTable } from '../../src/concepts/knn/table';
import { clampToDomain, createLabPointer, knnPage } from '../../src/concepts/knn/main';

let cleanup: (() => void)[] = [];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function player(): StepPlayer<KnnParams> {
  const p = new StepPlayer(knnScenario);
  cleanup.push(() => p.destroy());
  return p;
}

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

function control<T extends HTMLElement>(el: HTMLElement, name: string): T {
  const c = el.querySelector<T>(`[data-param="${name}"]`);
  if (!c) throw new Error(`no control ${name}`);
  return c;
}

const fire = (c: HTMLElement, type: 'input' | 'change'): boolean => c.dispatchEvent(new Event(type, { bubbles: true }));

describe('mountKnnParams', () => {
  it('renders every control with an associated Turkish label', () => {
    const el = host();
    mountKnnParams(el, player());
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent);
    expect(labels).toEqual([
      'k (komşu sayısı)', 'Uzaklık ölçüsü', 'Oylama', 'Ölçekleme (StandardScaler)',
      'Veri seti', 'Karar bölgeleri', 'Anında sonuç',
    ]);
    for (const l of el.querySelectorAll('label')) {
      const target = document.getElementById(l.htmlFor);
      expect(target, l.textContent ?? '').not.toBeNull();
      expect(target!.dataset.param).toBeTruthy();
    }
    const k = control<HTMLInputElement>(el, 'k');
    expect([k.type, k.min, k.max, k.step, k.value]).toEqual(['range', '1', '15', '2', '5']);
    expect(el.querySelector('.k-value')!.textContent).toBe('5');
    expect([...control<HTMLSelectElement>(el, 'metric').options].map((o) => [o.value, o.text])).toEqual([
      ['oklid', 'Öklid'], ['manhattan', 'Manhattan'],
    ]);
    expect([...control<HTMLSelectElement>(el, 'weighting').options].map((o) => [o.value, o.text])).toEqual([
      ['esit', 'Eşit'], ['agirlikli', 'Uzaklığa göre ağırlıklı'],
    ]);
    expect([...control<HTMLSelectElement>(el, 'dataset').options].map((o) => [o.value, o.text])).toEqual([
      ['aylik', 'Sözleşme × Aylık fatura'], ['toplam', 'Sözleşme × Toplam fatura'],
    ]);
    expect(el.textContent).toContain('Toplam fatura kısmen süre × aylık faturadan türer.');
    for (const name of ['scaled', 'regions', 'instant']) {
      expect(control<HTMLInputElement>(el, name).type).toBe('checkbox');
    }
  });

  it('controls reflect step params', () => {
    const el = host();
    const p = player();
    mountKnnParams(el, p);
    p.goto(9);
    expect(control<HTMLSelectElement>(el, 'metric').value).toBe('manhattan');
    expect(control<HTMLInputElement>(el, 'regions').checked).toBe(true);
    p.goto(11);
    expect(control<HTMLSelectElement>(el, 'dataset').value).toBe('toplam');
    expect(control<HTMLInputElement>(el, 'scaled').checked).toBe(false);
    p.goto(7);
    expect(control<HTMLInputElement>(el, 'k').value).toBe('15');
    expect(el.querySelector('.k-value')!.textContent).toBe('15');
  });

  it('k slider sets override and keeps step', () => {
    const el = host();
    const p = player();
    mountKnnParams(el, p);
    p.goto(4);
    const k = control<HTMLInputElement>(el, 'k');
    k.value = '11';
    fire(k, 'input');
    expect(p.state.params.k).toBe(11);
    expect(p.state.index).toBe(4);
    expect(el.querySelector('.k-value')!.textContent).toBe('11');
  });

  it('only writes control values that differ from the state', () => {
    const el = host();
    const p = player();
    mountKnnParams(el, p);
    const k = control<HTMLInputElement>(el, 'k');
    let writes = 0;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    Object.defineProperty(k, 'value', {
      get: () => desc.get!.call(k),
      set: (v: string) => { writes++; desc.set!.call(k, v); },
    });
    p.setParam('query', { tenure: 10, value: 50 });
    p.setParam('metric', 'manhattan');
    expect(writes).toBe(0);
    p.setParam('k', 9);
    expect(writes).toBe(1);
  });

  it('selects and checkboxes set overrides', () => {
    const el = host();
    const p = player();
    mountKnnParams(el, p);
    const metric = control<HTMLSelectElement>(el, 'metric');
    metric.value = 'manhattan';
    fire(metric, 'change');
    const weighting = control<HTMLSelectElement>(el, 'weighting');
    weighting.value = 'agirlikli';
    fire(weighting, 'change');
    for (const name of ['scaled', 'regions', 'instant'] as const) {
      const c = control<HTMLInputElement>(el, name);
      c.checked = !c.checked;
      fire(c, 'change');
    }
    expect(p.state.params).toMatchObject({
      metric: 'manhattan', weighting: 'agirlikli', scaled: false, regions: true, instant: true,
    });
    expect(p.state.index).toBe(0);
  });

  it('dataset select resets query', () => {
    const el = host();
    const p = player();
    mountKnnParams(el, p);
    p.setParam('query', { tenure: 5, value: 30 });
    const emits: number[] = [];
    p.subscribe((s) => emits.push(s.index));
    const ds = control<HTMLSelectElement>(el, 'dataset');
    ds.value = 'toplam';
    fire(ds, 'change');
    expect(p.state.params.dataset).toBe('toplam');
    expect(p.state.params.query).toEqual(demo.defaultQuery.toplam);
    expect(emits).toHaveLength(1);
  });
});

describe('mountKnnTable', () => {
  const rows = (el: HTMLElement) => [...el.querySelectorAll('tbody tr')];
  const headers = (el: HTMLElement) => [...el.querySelectorAll('thead th')].map((t) => t.textContent);

  // Manual animation frames: the table renders at most once per frame.
  let frames: FrameRequestCallback[] = [];
  const frame = (): void => {
    const run = frames;
    frames = [];
    for (const cb of run) cb(0);
  };
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  });
  /** Mount, then flush the frame after every notification (subscribed after the table). */
  const mountTable = (el: HTMLElement, p: StepPlayer<KnnParams>): void => {
    mountKnnTable(el, p);
    p.subscribe(() => frame());
  };

  it('renders at most once per animation frame, with the latest state', () => {
    const el = host();
    const p = player();
    mountKnnTable(el, p);
    p.goto(2);
    frame();
    const table = el.querySelector('table')!;
    const writes = vi.fn();
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
    Object.defineProperty(table, 'innerHTML', {
      get: () => desc.get!.call(table),
      set: (v: string) => { writes(); desc.set!.call(table, v); },
    });
    p.setParam('weighting', 'agirlikli');
    p.setParam('k', 7);
    p.goto(3);
    expect(writes).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    frame();
    expect(writes).toHaveBeenCalledTimes(1);
    // the one render shows the latest state: phase 3, k = 7, weighted
    expect(el.querySelectorAll('tr.neighbor')).toHaveLength(7);
    expect(headers(el)).toContain('Ağırlık');
  });

  it('skips rendering while hidden and catches up when shown again', async () => {
    const el = host();
    const p = player();
    el.hidden = true;
    mountKnnTable(el, p);
    p.goto(3);
    expect(frames).toHaveLength(0);
    expect(rows(el)).toHaveLength(0);
    el.hidden = false; // e.g. switching from Ders to Lab, no player notification
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver delivery
    frame();
    expect(el.querySelectorAll('tr.neighbor')).toHaveLength(5);
  });

  it('before phase 2 shows only the caption and the hint', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    expect(el.textContent).toContain('Yeni müşteriye uzaklıklar (küçükten büyüğe)');
    const hint = el.querySelector<HTMLElement>('.knn-table-hint')!;
    const scroll = el.querySelector<HTMLElement>('.knn-table-scroll')!;
    expect(hint.textContent).toBe('Uzaklıklar 3. adımda hesaplanır.');
    expect([hint.hidden, scroll.hidden]).toEqual([false, true]);
    expect(rows(el)).toHaveLength(0);
    p.goto(1);
    expect([hint.hidden, scroll.hidden]).toEqual([false, true]);
    expect(rows(el)).toHaveLength(0);
    p.goto(2);
    expect([hint.hidden, scroll.hidden]).toEqual([true, false]);
    expect(rows(el)).toHaveLength(customers.length);
    p.goto(0);
    expect([hint.hidden, scroll.hidden]).toEqual([false, true]);
  });

  it('lists all distances sorted, with id, class and 2-decimal distance', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    p.goto(2);
    expect(headers(el)).toEqual(['#', 'Müşteri', 'Sınıf', 'Uzaklık']);
    const view = deriveKnnView(2, p.state.params);
    rows(el).forEach((r, i) => {
      const cells = [...r.querySelectorAll('td')].map((c) => c.textContent);
      const n = view.distances[i];
      expect(cells).toEqual([
        String(i + 1), customers[n.index].id, n.cls === 1 ? '▲ Ayrıldı' : '● Kaldı', formatNumber(n.distance, 2),
      ]);
    });
    // phase 2: nobody is a neighbour or dimmed yet
    expect(el.querySelectorAll('tr.neighbor, tr.dim')).toHaveLength(0);
  });

  it('marks rows 1..k as neighbours from phase 3 and dims the rest', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    p.goto(3);
    const k = p.state.params.k;
    const all = rows(el);
    expect(all.slice(0, k).every((r) => r.classList.contains('neighbor'))).toBe(true);
    expect(all.slice(k).every((r) => r.classList.contains('dim') && !r.classList.contains('neighbor'))).toBe(true);
    p.setParam('k', 9);
    expect(el.querySelectorAll('tr.neighbor')).toHaveLength(9);
  });

  it('table shows weight column only when weighted', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    p.goto(2);
    p.setParam('weighting', 'agirlikli');
    expect(headers(el)).not.toContain('Ağırlık'); // step 3: no neighbours, no weights yet
    expect(rows(el)[0].querySelectorAll('td')).toHaveLength(4);
    p.goto(3);
    p.setParam('weighting', 'agirlikli');
    expect(headers(el)).toContain('Ağırlık');
    expect(rows(el)[0].querySelectorAll('td')).toHaveLength(5);
    p.setParam('weighting', 'esit');
    p.goto(4);
    expect(headers(el)).not.toContain('Ağırlık');
    expect(rows(el)[0].querySelectorAll('td')).toHaveLength(4);
    p.setParam('weighting', 'agirlikli');
    expect(headers(el)).toEqual(['#', 'Müşteri', 'Sınıf', 'Uzaklık', 'Ağırlık']);
    const view = deriveKnnView(4, p.state.params);
    const k = p.state.params.k;
    rows(el).forEach((r, i) => {
      const w = r.querySelectorAll('td')[4].textContent;
      expect(w).toBe(i < k ? formatNumber(view.neighbors[i].weight, 3) : '—');
    });
    p.setParam('weighting', 'esit');
    expect(headers(el)).not.toContain('Ağırlık');
  });

  it('uses the sklearn zero-distance rule for weights of the k rows', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    p.goto(4);
    const c = customers[0];
    p.setParams({ weighting: 'agirlikli', query: { tenure: c.tenure, value: c.monthly } });
    const w = rows(el).map((r) => r.querySelectorAll('td')[4].textContent);
    expect(w[0]).toBe(formatNumber(1, 3));
    expect(w.slice(1, p.state.params.k)).toEqual(Array(p.state.params.k - 1).fill(formatNumber(0, 3)));
    expect(w[p.state.params.k]).toBe('—');
  });

  it('class cells carry the class name for colouring', () => {
    const el = host();
    const p = player();
    mountTable(el, p);
    p.goto(2);
    expect(el.querySelectorAll('td.cls.kaldi')).toHaveLength(36);
    expect(el.querySelectorAll('td.cls.ayrildi')).toHaveLength(12);
  });
});

describe('clampToDomain', () => {
  it('clamps query to domain', () => {
    const { domain } = featureSpace('aylik', true);
    expect(clampToDomain({ x: -1e6, y: 1e6 }, domain)).toEqual({ x: domain.x[0], y: domain.y[1] });
    expect(clampToDomain({ x: 1e6, y: -1e6 }, domain)).toEqual({ x: domain.x[1], y: domain.y[0] });
    expect(clampToDomain({ x: 0.1, y: -0.2 }, domain)).toEqual({ x: 0.1, y: -0.2 });
  });
});

describe('createLabPointer', () => {
  function setup(lab = { on: true }) {
    const p = player();
    const handle = createLabPointer(p, () => lab.on);
    return { p, handle, lab };
  }
  const inside: RawPoint = { tenure: 20, value: 60 };
  const near = (a: RawPoint, b: RawPoint): void => {
    expect(a.tenure).toBeCloseTo(b.tenure, 9);
    expect(a.value).toBeCloseTo(b.value, 9);
  };

  it('down moves the query and restarts at step 2 (index 1)', () => {
    const { p, handle } = setup();
    p.goto(9);
    handle(inside, 'down');
    near(p.state.params.query, inside);
    expect(p.state.index).toBe(1);
  });

  it('down jumps to the prediction step when instant is on', () => {
    const { p, handle } = setup();
    p.setParam('instant', true);
    handle(inside, 'down');
    expect(p.state.index).toBe(4);
    near(p.state.params.query, inside);
  });

  it("down on a demo step keeps that step's effective params", () => {
    const { p, handle } = setup();
    p.goto(9); // Manhattan
    handle(inside, 'down');
    expect(p.state.index).toBe(1);
    expect(p.state.params.metric).toBe('manhattan');
    p.goto(5); // k = 1, regions on
    handle(inside, 'down');
    expect(p.state.index).toBe(1);
    expect(p.state.params).toMatchObject({ k: 1, regions: true });
    p.goto(7); // k = 15
    handle(inside, 'down');
    expect(p.state.index).toBe(1);
    expect(p.state.params.k).toBe(15);
    near(p.state.params.query, inside);
  });

  it('with instant on, down lands on index 4 with the demo params kept', () => {
    const { p, handle } = setup();
    p.setParam('instant', true);
    p.goto(9);
    handle(inside, 'down');
    expect(p.state.index).toBe(4);
    expect(p.state.params).toMatchObject({ metric: 'manhattan', k: 5, regions: true, instant: true });
    p.goto(5);
    handle(inside, 'down');
    expect(p.state.index).toBe(4);
    expect(p.state.params).toMatchObject({ k: 1, regions: true });
    p.goto(7);
    handle(inside, 'down');
    expect(p.state.index).toBe(4);
    expect(p.state.params.k).toBe(15);
  });

  it('down: one param emit, then the step change already carries the new query', () => {
    const { p, handle } = setup();
    p.goto(9);
    const seen: [string, RawPoint][] = [];
    p.subscribe((s, c) => seen.push([c, s.params.query]));
    handle(inside, 'down');
    expect(seen.map((x) => x[0])).toEqual(['param', 'step']);
    near(seen[1][1], inside);
  });

  it('down on a later step keeps the visible dataset and scaling', () => {
    const { p, handle } = setup();
    p.goto(11); // Toplam fatura, unscaled
    const click: RawPoint = { tenure: 30, value: 3000 };
    handle(click, 'down');
    expect(p.state.index).toBe(1);
    expect(p.state.params).toMatchObject({ dataset: 'toplam', scaled: false });
    near(p.state.params.query, click);
  });

  it('down clamps a point beyond the domain to its edges', () => {
    const { p, handle } = setup();
    handle({ tenure: -500, value: 1e6 }, 'down');
    const s = featureSpace('aylik', true);
    const q = s.toSpace(p.state.params.query);
    expect(q.x).toBeCloseTo(s.domain.x[0], 9);
    expect(q.y).toBeCloseTo(s.domain.y[1], 9);
  });

  it('hover move without a prior down is ignored', () => {
    const { p, handle } = setup();
    const before = p.state;
    handle(inside, 'move');
    expect(p.state.params.query).toEqual(before.params.query);
    expect(p.state.index).toBe(before.index);
  });

  it('drag: move after down updates the query live at step ≥ 5 (index 4)', () => {
    const { p, handle } = setup();
    handle(inside, 'down');
    const causes: string[] = [];
    p.subscribe((_s, c) => causes.push(c));
    const queries: RawPoint[] = [];
    p.subscribe((s) => queries.push(s.params.query));
    handle({ tenure: 25, value: 70 }, 'move');
    expect(p.state.index).toBe(4);
    near(p.state.params.query, { tenure: 25, value: 70 });
    handle({ tenure: 30, value: 75 }, 'move');
    expect(p.state.index).toBe(4);
    near(p.state.params.query, { tenure: 30, value: 75 });
    // first drag frame: query first, then the step change renders with it
    expect(causes).toEqual(['param', 'step', 'param']);
    near(queries[1], { tenure: 25, value: 70 });
  });

  it('drag on a later step keeps that step', () => {
    const { p, handle } = setup();
    p.setParam('instant', true);
    handle(inside, 'down');
    p.goto(6 + 2); // e.g. teacher moved on; drag must not pull the step back
    handle({ tenure: 25, value: 70 }, 'move');
    expect(p.state.index).toBe(8);
  });

  it('a tiny move after down is not a drag (click with wobble)', () => {
    const { p, handle } = setup();
    handle(inside, 'down');
    const s = featureSpace('aylik', true);
    const at = s.toSpace(inside);
    const { x, y } = s.domain;
    const wobble = s.toRaw({ x: at.x + 0.01 * (x[1] - x[0]), y: at.y - 0.01 * (y[1] - y[0]) });
    handle(wobble, 'move');
    handle(wobble, 'up');
    expect(p.state.index).toBe(1);
    near(p.state.params.query, inside);
  });

  it('a large move after down becomes a drag and keeps dragging without a dead zone', () => {
    const { p, handle } = setup();
    handle(inside, 'down');
    const s = featureSpace('aylik', true);
    const at = s.toSpace(inside);
    const far = s.toRaw({ x: at.x + 0.02 * (s.domain.x[1] - s.domain.x[0]), y: at.y });
    handle(far, 'move');
    expect(p.state.index).toBe(4);
    near(p.state.params.query, far);
    const tiny = s.toRaw({ x: at.x + 0.021 * (s.domain.x[1] - s.domain.x[0]), y: at.y });
    handle(tiny, 'move'); // once dragging, every move counts
    near(p.state.params.query, tiny);
  });

  it('up does not move the query and ends the drag', () => {
    const { p, handle } = setup();
    handle(inside, 'down');
    handle({ tenure: 25, value: 70 }, 'move');
    handle({ tenure: -999, value: -999 }, 'up'); // pointercancel can report bogus coordinates
    near(p.state.params.query, { tenure: 25, value: 70 });
    handle({ tenure: 40, value: 90 }, 'move'); // hover after the drag
    near(p.state.params.query, { tenure: 25, value: 70 });
  });

  it('does nothing outside lab mode (checked at event time)', () => {
    const { p, handle, lab } = setup({ on: false });
    const q0 = p.state.params.query;
    handle(inside, 'down');
    handle({ tenure: 25, value: 70 }, 'move');
    expect(p.state.params.query).toEqual(q0);
    expect(p.state.index).toBe(0);
    lab.on = true;
    handle(inside, 'down');
    near(p.state.params.query, inside);
    lab.on = false;
    handle({ tenure: 25, value: 70 }, 'move');
    near(p.state.params.query, inside);
  });
});

describe('knn page wiring', () => {
  function mount(search: string) {
    history.replaceState(null, '', `/knn/${search}`);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600, toJSON() {} }) as DOMRect,
    );
    const root = host();
    const page = mountConceptPage(root, knnPage);
    cleanup.push(() => page.destroy());
    return { root, p: page.player };
  }
  const press = (root: HTMLElement): void => {
    const svg = root.querySelector('svg.knn-plot')!;
    const hit = root.querySelector('rect.hit')!;
    const x = Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) * 0.25;
    const y = Number(hit.getAttribute('y')) + Number(hit.getAttribute('height')) * 0.25;
    const Ev = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
    svg.dispatchEvent(new Ev('pointerdown', { clientX: x, clientY: y, bubbles: true }));
    svg.dispatchEvent(new Ev('pointerup', { clientX: x, clientY: y, bubbles: true }));
  };

  it('mounts title, params and table', () => {
    const { root } = mount('');
    expect(root.querySelector('.title')!.textContent).toBe('k-En Yakın Komşu (k-NN)');
    expect(root.querySelector('.chapter')!.textContent).toBe('Bölüm 5 · Sınıflandırmaya Giriş');
    expect(root.querySelector('.params [data-param="k"]')).not.toBeNull();
    expect(root.querySelector('.explain-extra')!.textContent).toContain('Yeni müşteriye uzaklıklar');
  });

  it('clicking the plot moves the query in lab mode only', () => {
    const { root, p } = mount('?mod=ders');
    const q0 = p.state.params.query;
    press(root);
    expect(p.state.params.query).toEqual(q0);
    root.querySelector<HTMLButtonElement>('[data-mode-btn="lab"]')!.click();
    press(root);
    expect(p.state.params.query).not.toEqual(q0);
    expect(p.state.index).toBe(1);
  });
});
