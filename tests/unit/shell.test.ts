// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mountConceptPage, type ConceptPage, type SceneHandle } from '../../src/core/shell';
import type { Mode } from '../../src/core/mode';
import type { StepPlayer } from '../../src/core/player';

type P = { k: number };

class FakeRO {
  static instances: FakeRO[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public cb: ResizeObserverCallback) { FakeRO.instances.push(this); }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(): void {}
  disconnect(): void { this.disconnected = true; }
  fire(): void { this.cb([], this as unknown as ResizeObserver); }
}

let mounted: { destroy(): void } | null = null;
let root: HTMLElement;
let size = { width: 800.6, height: 450.2 };

beforeEach(() => {
  FakeRO.instances = [];
  vi.stubGlobal('ResizeObserver', FakeRO);
  history.replaceState(null, '', '/knn/');
  size = { width: 800.6, height: 450.2 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height, ...size, toJSON() {} }) as DOMRect,
  );
  root = document.createElement('div');
  document.body.appendChild(root);
});
afterEach(() => {
  mounted?.destroy();
  mounted = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(search = '') {
  history.replaceState(null, '', `/knn/${search}`);
  const calls: string[] = [];
  const scene: SceneHandle = {
    resize: vi.fn((w: number, h: number) => { calls.push(`resize ${w}x${h}`); }),
    setMode: vi.fn((m: Mode) => { calls.push(`mode ${m}`); }),
    destroy: vi.fn(),
  };
  const extraRun = vi.fn();
  const mountScene = vi.fn((_el: HTMLElement, _p: StepPlayer<P>, _m: Mode) => scene);
  const mountParams = vi.fn((el: HTMLElement) => { el.append('PARAMS'); });
  const mountExplainExtra = vi.fn((el: HTMLElement) => { el.append('EXTRA'); });
  const page: ConceptPage<P> = {
    title: 'k-En Yakın Komşu (k-NN)',
    chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
    scenario: {
      defaults: { k: 5 },
      steps: [
        { id: 'a', title: 'Birinci', text: 'Bir metni', term: 'tembel öğrenme (lazy learning)' },
        { id: 'b', title: 'İkinci', text: 'İki metni', labText: 'İki Lab metni' },
        { id: 'c', title: 'Üçüncü', text: 'Üç metni' },
      ],
    },
    mountScene,
    mountParams,
    mountExplainExtra,
    shortcuts: () => [{ keys: ['+', '='], label: 'k değerini artır', run: extraRun }],
  };
  const m = mountConceptPage(root, page);
  mounted = m;
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T;
  return { ...m, scene, calls, extraRun, mountScene, mountParams, mountExplainExtra, q };
}
function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('shell', () => {
  it('renders step dots and count', () => {
    const { q } = setup();
    const dots = root.querySelectorAll('.player-bar .steps button.step-dot');
    expect(dots).toHaveLength(3);
    expect(q('.step-count').textContent).toBe('Adım 1 / 3');
    expect(dots[0].getAttribute('aria-current')).toBe('step');
    expect(dots[1].hasAttribute('aria-current')).toBe(false);
    expect(dots[2].getAttribute('aria-label')).toBe('Adım 3: Üçüncü');
  });

  it('renders top bar with title, chapter, home link and mode buttons', () => {
    const { q } = setup();
    expect(q('.top-bar .title').textContent).toBe('k-En Yakın Komşu (k-NN)');
    expect(q('.top-bar .chapter').textContent).toBe('Bölüm 5 · Sınıflandırmaya Giriş');
    expect(q<HTMLAnchorElement>('.top-bar a.home').getAttribute('href')).toBe('../');
    expect(q('.mode-toggle [data-mode-btn=ders]').textContent).toBe('🎓 Ders');
    expect(q('.mode-toggle [data-mode-btn=lab]').textContent).toBe('🧪 Laboratuvar');
    expect(q('.stage')).not.toBeNull();
  });

  it('clicking a dot goes to that step', () => {
    const { player, q } = setup();
    root.querySelectorAll<HTMLButtonElement>('button.step-dot')[2].click();
    expect(player.state.index).toBe(2);
    expect(q('.step-count').textContent).toBe('Adım 3 / 3');
    expect(root.querySelectorAll('button.step-dot')[2].getAttribute('aria-current')).toBe('step');
    expect(root.querySelectorAll('button.step-dot')[0].hasAttribute('aria-current')).toBe(false);
  });

  it('prev/next/play buttons drive the player with Turkish labels', () => {
    vi.useFakeTimers();
    try {
      const { player, q } = setup();
      const play = q<HTMLButtonElement>('button.play');
      expect(q('button.prev').getAttribute('aria-label')).toBe('Önceki adım');
      expect(q('button.next').getAttribute('aria-label')).toBe('Sonraki adım');
      expect(play.getAttribute('aria-label')).toBe('Oynat');
      expect(play.textContent).toBe('▶');
      q<HTMLButtonElement>('button.next').click();
      expect(player.state.index).toBe(1);
      q<HTMLButtonElement>('button.prev').click();
      expect(player.state.index).toBe(0);
      play.click();
      expect(player.state.playing).toBe(true);
      expect(play.getAttribute('aria-label')).toBe('Duraklat');
      expect(play.textContent).toBe('❚❚');
      play.click();
      expect(player.state.playing).toBe(false);
      expect(play.textContent).toBe('▶');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads initial mode from URL and mounts scene, params and extra', () => {
    const { mountScene, mountParams, mountExplainExtra, player, q } = setup('?mod=ders');
    expect(root.dataset.mode).toBe('ders');
    expect(mountScene).toHaveBeenCalledWith(q('.stage'), player, 'ders');
    expect(mountParams).toHaveBeenCalledWith(q('.params'), player);
    expect(mountExplainExtra).toHaveBeenCalledWith(q('.explain-extra'), player);
    expect(q('.params').textContent).toContain('PARAMS');
    expect(q('.explain-extra').textContent).toContain('EXTRA');
  });

  it('defaults to lab mode', () => {
    setup();
    expect(root.dataset.mode).toBe('lab');
  });

  it('mode toggle sets data-mode, URL and calls setMode', () => {
    const { scene, calls, q } = setup('?a=1');
    calls.length = 0;
    size = { width: 1280, height: 548 };
    q<HTMLButtonElement>('[data-mode-btn=ders]').click();
    expect(root.dataset.mode).toBe('ders');
    expect(location.search).toBe('?a=1&mod=ders');
    expect(scene.setMode).toHaveBeenCalledWith('ders');
    expect(calls).toEqual(['mode ders', 'resize 1280x548']);
    expect(q('[data-mode-btn=ders]').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-mode-btn=lab]').getAttribute('aria-pressed')).toBe('false');
    q<HTMLButtonElement>('[data-mode-btn=lab]').click();
    expect(root.dataset.mode).toBe('lab');
    expect(location.search).toBe('?a=1&mod=lab');
    expect(scene.setMode).toHaveBeenLastCalledWith('lab');
  });

  it('Ders mode collapses params', () => {
    const { q } = setup('?mod=ders');
    const params = q('.params');
    const toggle = q<HTMLButtonElement>('button.params-toggle');
    expect(toggle.textContent).toBe('Parametreler');
    expect(toggle.hidden).toBe(false);
    expect(params.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(params.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(params.hidden).toBe(true);
    toggle.click();
    q<HTMLButtonElement>('[data-mode-btn=lab]').click();
    expect(params.hidden).toBe(false);
    expect(toggle.hidden).toBe(true);
    q<HTMLButtonElement>('[data-mode-btn=ders]').click();
    expect(params.hidden).toBe(true);
  });

  it('clicking a shell button blurs a focused form control so arrows step again', () => {
    for (const mode of ['ders', 'lab']) {
      const { player, q, destroy } = setup(`?mod=${mode}`);
      if (mode === 'ders') q<HTMLButtonElement>('button.params-toggle').click();
      const range = document.createElement('input');
      range.type = 'range';
      q('.params').appendChild(range);
      range.focus();
      expect(document.activeElement).toBe(range);
      const next = q<HTMLButtonElement>('button.next');
      next.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      next.click();
      expect(player.state.index).toBe(1);
      expect(document.activeElement).not.toBe(range);
      press('ArrowRight');
      expect(player.state.index).toBe(2);
      destroy();
      mounted = null;
    }
  });

  it('Escape closes the Ders params overlay and leaves the step keys working', () => {
    const { player, q } = setup('?mod=ders');
    const toggle = q<HTMLButtonElement>('button.params-toggle');
    toggle.click();
    const range = document.createElement('input');
    range.type = 'range';
    q('.params').appendChild(range);
    range.focus();
    // real key events go to the focused element and bubble to window
    const pressFocused = (key: string): void => {
      const t = (document.activeElement ?? document.body) as HTMLElement;
      t.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    pressFocused('Escape');
    expect(q('.params').hidden).toBe(true);
    expect(document.activeElement).not.toBe(toggle);
    expect(document.activeElement).not.toBe(range);
    expect(document.activeElement).toBe(q('.stage'));
    pressFocused('ArrowRight');
    expect(player.state.index).toBe(1);
    pressFocused(' ');
    expect(player.state.index).toBe(2);
    expect(q('.params').hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    pressFocused('ArrowLeft');
    expect(player.state.index).toBe(1);
  });

  it('explain shows current step title and text', () => {
    const { player, q } = setup('?mod=ders');
    expect(q('.explain .step-title').textContent).toBe('Birinci');
    expect(q('.explain .step-text').textContent).toBe('Bir metni');
    player.goto(1);
    expect(q('.explain .step-title').textContent).toBe('İkinci');
    expect(q('.explain .step-text').textContent).toBe('İki metni');
  });

  it('lab step card shows labText when the step has one', () => {
    const { player, q } = setup('?mod=lab');
    player.goto(1);
    expect(q('.step-text').textContent).toBe('İki Lab metni');
  });

  it('lab step card falls back to the lesson text', () => {
    const { q } = setup('?mod=lab');
    expect(q('.step-text').textContent).toBe('Bir metni');
  });

  it('switching to Lab rewrites the step card', () => {
    const { player, q } = setup('?mod=ders');
    player.goto(1);
    expect(q('.step-text').textContent).toBe('İki metni');
    q<HTMLButtonElement>('[data-mode-btn=lab]').click();
    expect(q('.step-text').textContent).toBe('İki Lab metni');
    q<HTMLButtonElement>('[data-mode-btn=ders]').click();
    expect(q('.step-text').textContent).toBe('İki metni');
  });

  it('side column puts the explanation (and its table) before the params', () => {
    const { q } = setup('?mod=lab');
    const side = q('.side');
    expect([...side.children].map((c) => c.className)).toEqual(['explain', 'params']);
  });

  it('Ders mode shows only the step title in explain', () => {
    const { q } = setup('?mod=ders');
    expect(q('.step-title').hidden).toBe(false);
    expect(q('.step-text').hidden).toBe(true);
    expect(q('.explain-extra').hidden).toBe(true);
    q<HTMLButtonElement>('[data-mode-btn=lab]').click();
    expect(q('.step-text').hidden).toBe(false);
    expect(q('.explain-extra').hidden).toBe(false);
  });

  it('Ders shows the step term beside the title; Lab leaves it to the step text', () => {
    const { player, q } = setup('?mod=ders');
    expect(q('.explain .step-term').textContent).toBe('tembel öğrenme (lazy learning)');
    expect(q('.step-term').hidden).toBe(false);
    player.next(); // step without a term
    expect(q('.step-term').hidden).toBe(true);
    player.prev();
    expect(q('.step-term').hidden).toBe(false);
    q<HTMLButtonElement>('[data-mode-btn=lab]').click();
    expect(q('.step-term').hidden).toBe(true);
  });

  it('help lists extra shortcuts', () => {
    const { q } = setup();
    const help = q('.help');
    expect(help.hidden).toBe(true);
    const items = [...help.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual([
      '→ / Boşluk: Sonraki adım',
      '←: Önceki adım',
      'P: Oynat / duraklat',
      'F: Tam ekran',
      'Home / End: İlk / son adım',
      '?: Bu yardım',
      '+ / =: k değerini artır',
    ]);
  });

  it('help shows a shortcut by its display label when it has one; matching uses keys', () => {
    const run = vi.fn();
    const m = mountConceptPage<P>(root, {
      title: 't', chapter: 'c',
      scenario: { defaults: { k: 5 }, steps: [{ id: 'a', title: 'A', text: 'a' }] },
      mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
      mountParams: () => {},
      shortcuts: () => [{ keys: ['m', 'M'], display: 'M', label: 'Öklid / Manhattan', run }],
    });
    mounted = m;
    const items = [...root.querySelectorAll('.help li')].map((li) => li.textContent);
    expect(items.at(-1)).toBe('M: Öklid / Manhattan');
    press('m');
    press('M');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('help opens with ?, closes with ?, Escape and click', () => {
    const { q } = setup();
    const help = q('.help');
    press('?');
    expect(help.hidden).toBe(false);
    press('?');
    expect(help.hidden).toBe(true);
    press('?');
    press('Escape');
    expect(help.hidden).toBe(true);
    press('?');
    help.click();
    expect(help.hidden).toBe(true);
  });

  it('keyboard drives the player and extra shortcuts', () => {
    const { player, extraRun } = setup();
    press('ArrowRight');
    expect(player.state.index).toBe(1);
    press('=');
    expect(extraRun).toHaveBeenCalledTimes(1);
  });

  it('F toggles fullscreen when supported', () => {
    const req = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: req, configurable: true });
    Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true });
    let fsEl: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { get: () => fsEl, configurable: true });
    try {
      setup();
      press('f');
      expect(req).toHaveBeenCalledTimes(1);
      fsEl = document.documentElement;
      press('f');
      expect(exit).toHaveBeenCalledTimes(1);
    } finally {
      delete (document.documentElement as unknown as Record<string, unknown>).requestFullscreen;
      delete (document as unknown as Record<string, unknown>).exitFullscreen;
      delete (document as unknown as Record<string, unknown>).fullscreenElement;
    }
  });

  it('F without fullscreen API does not throw', () => {
    setup();
    expect(() => press('f')).not.toThrow();
  });

  it('forwards integer stage size initially and on observed resize', () => {
    const { scene, q } = setup();
    expect(scene.resize).toHaveBeenCalledWith(800, 450);
    const ro = FakeRO.instances[0];
    expect(ro.observed).toEqual([q('.stage'), q('.top-bar'), q('.player-bar')]);
    size = { width: 1024.9, height: 600 };
    ro.fire();
    expect(scene.resize).toHaveBeenLastCalledWith(1024, 600);
    const n = (scene.resize as ReturnType<typeof vi.fn>).mock.calls.length;
    ro.fire();
    expect(scene.resize).toHaveBeenCalledTimes(n);
  });

  it('publishes the stage top and player bar height for the narrow stage height', () => {
    const rects = new Map<string, Partial<DOMRect>>([
      ['stage', { top: 70.2, height: 450 }],
      ['player-bar', { top: 760, height: 83.4 }],
      ['concept-page', { top: 0, height: 844 }],
    ]);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
      const r = { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 0, width: 800, height: 40 };
      for (const [cls, v] of rects) if (this.classList.contains(cls)) Object.assign(r, v);
      return { ...r, toJSON() {} } as DOMRect;
    });
    setup();
    expect(root.style.getPropertyValue('--stage-top')).toBe('71px');
    expect(root.style.getPropertyValue('--player-bar-h')).toBe('84px');
    // a wrapped title moves the stage down: the next observed resize republishes
    rects.set('stage', { top: 94, height: 450 });
    FakeRO.instances[0].fire();
    expect(root.style.getPropertyValue('--stage-top')).toBe('94px');
    mounted!.destroy();
    mounted = null;
    expect(root.style.getPropertyValue('--stage-top')).toBe('');
    expect(root.style.getPropertyValue('--player-bar-h')).toBe('');
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { scene } = setup();
    expect(scene.resize).toHaveBeenCalledWith(800, 450);
  });

  it('destroy unbinds keys, disconnects observer, destroys scene and empties root', () => {
    const m = setup();
    const destroySpy = vi.spyOn(m.player, 'destroy');
    m.destroy();
    mounted = null;
    expect(FakeRO.instances[0].disconnected).toBe(true);
    expect(m.scene.destroy).toHaveBeenCalledTimes(1);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(root.childElementCount).toBe(0);
    press('ArrowRight');
    expect(m.player.state.index).toBe(0);
  });
});
