import { StepPlayer, type PlayerState, type Scenario } from './player';
import { readMode, writeMode, type Mode } from './mode';
import { bindKeys, isFormControl, type Shortcut } from './keyboard';

export interface SceneHandle {
  resize(widthPx: number, heightPx: number): void;
  setMode(m: Mode): void;
  destroy(): void;
}

export interface ConceptPage<P extends object> {
  title: string;
  chapter: string;
  scenario: Scenario<P>;
  mountScene(el: HTMLElement, player: StepPlayer<P>, mode: Mode): SceneHandle;
  mountParams(el: HTMLElement, player: StepPlayer<P>): void;
  /** Lab-only content shown under the step text. */
  mountExplainExtra?(el: HTMLElement, player: StepPlayer<P>): void;
  shortcuts?(player: StepPlayer<P>): Shortcut[];
}

const BUILTIN_HELP: [keys: string, label: string][] = [
  ['→ / Boşluk', 'Sonraki adım'],
  ['←', 'Önceki adım'],
  ['P', 'Oynat / duraklat'],
  ['F', 'Tam ekran'],
  ['Home / End', 'İlk / son adım'],
  ['?', 'Bu yardım'],
];

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function button(cls: string, label: string, text: string): HTMLButtonElement {
  return h('button', { type: 'button', class: cls, 'aria-label': label }, text);
}

/**
 * Mouse clicks must not leave focus on a button: keyboard.ts ignores the step
 * keys (→, ←, Space, Home, End) while a button is focused, which would make
 * the teacher's arrow keys stop working after clicking a control. A control
 * that already has focus (e.g. a slider in .params) is blurred for the same
 * reason. Keyboard users can still Tab to the buttons.
 */
function noMouseFocus(el: HTMLElement): void {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const active = document.activeElement;
    if (active instanceof HTMLElement && isFormControl(active)) active.blur();
  });
}

let uid = 0;

export function mountConceptPage<P extends object>(
  root: HTMLElement,
  page: ConceptPage<P>,
): { player: StepPlayer<P>; destroy(): void } {
  const player = new StepPlayer(page.scenario);
  const steps = page.scenario.steps;
  const id = `cp${++uid}`;
  let mode: Mode = readMode(location.search);
  let paramsOpen = false;

  // ---- top bar ----
  const modeBtns: Record<Mode, HTMLButtonElement> = {
    ders: h('button', { type: 'button', 'data-mode-btn': 'ders' }, '🎓 Ders'),
    lab: h('button', { type: 'button', 'data-mode-btn': 'lab' }, '🧪 Laboratuvar'),
  };
  const topBar = h(
    'header',
    { class: 'top-bar' },
    h('a', { class: 'home', href: '../', 'aria-label': 'Ana sayfaya dön' }, '← Ana sayfa'),
    h(
      'div',
      { class: 'heading' },
      h('h1', { class: 'title' }, page.title),
      h('span', { class: 'chapter' }, page.chapter),
    ),
    h('div', { class: 'mode-toggle', role: 'group', 'aria-label': 'Görünüm modu' }, modeBtns.ders, modeBtns.lab),
  );

  // ---- workspace: stage + side panels ----
  // tabindex -1: focus can be parked here (not in the tab order) so the step keys work
  const stage = h('div', { class: 'stage', tabindex: '-1' });
  const params = h('section', { class: 'params', id: `${id}-params`, 'aria-label': 'Parametreler' });
  const stepTitle = h('h2', { class: 'step-title', 'aria-live': 'polite' });
  // Ders hides the step text, so the step's new term rides next to the title instead
  const stepTerm = h('p', { class: 'step-term' });
  const stepText = h('p', { class: 'step-text' });
  const extra = h('div', { class: 'explain-extra' });
  const explain = h('section', { class: 'explain', 'aria-label': 'Adım açıklaması' }, stepTitle, stepTerm, stepText, extra);
  // explain first: in Lab the step text and distance table must be visible without
  // scrolling (params follow); in Ders the grid places each panel, so order does not show
  const workspace = h('main', { class: 'workspace' }, stage, h('div', { class: 'side' }, explain, params));

  // ---- player bar ----
  const prevBtn = button('prev', 'Önceki adım', '◀');
  const playBtn = button('play', 'Oynat', '▶');
  const nextBtn = button('next', 'Sonraki adım', '▶|');
  const dots = steps.map((s, i) => {
    const d = button('step-dot', `Adım ${i + 1}: ${s.title}`, '');
    d.title = `${i + 1}. ${s.title}`;
    d.addEventListener('click', () => player.goto(i));
    return d;
  });
  const stepCount = h('span', { class: 'step-count' });
  const paramsToggle = h(
    'button',
    { type: 'button', class: 'params-toggle', 'aria-controls': params.id, 'aria-expanded': 'false' },
    'Parametreler',
  );
  const playerBar = h(
    'nav',
    { class: 'player-bar', 'aria-label': 'Adım oynatıcı' },
    h('div', { class: 'transport' }, prevBtn, playBtn, nextBtn),
    h('div', { class: 'steps' }, ...dots),
    stepCount,
    paramsToggle,
  );
  prevBtn.addEventListener('click', () => player.prev());
  playBtn.addEventListener('click', () => player.togglePlay());
  nextBtn.addEventListener('click', () => player.next());
  for (const b of [prevBtn, playBtn, nextBtn, paramsToggle, modeBtns.ders, modeBtns.lab, ...dots]) noMouseFocus(b);

  // ---- help overlay ----
  const shortcuts = page.shortcuts?.(player) ?? [];
  const helpItems = [
    ...BUILTIN_HELP,
    ...shortcuts.map((s): [string, string] => [s.display ?? s.keys.join(' / '), s.label]),
  ].map(([keys, label]) => h('li', {}, h('kbd', {}, keys), `: ${label}`));
  const help = h(
    'div',
    { class: 'help', role: 'dialog', 'aria-label': 'Klavye kısayolları', tabindex: '-1' },
    h(
      'div',
      { class: 'help-card' },
      h('h2', {}, 'Klavye kısayolları'),
      h('ul', {}, ...helpItems),
      h('p', { class: 'help-hint' }, 'Kapatmak için ? ya da Esc tuşuna basın veya herhangi bir yere tıklayın.'),
    ),
  );
  help.hidden = true;
  let focusBeforeHelp: Element | null = null;
  const setHelp = (open: boolean): void => {
    if (!help.hidden === open) return;
    help.hidden = !open;
    if (open) {
      focusBeforeHelp = document.activeElement;
      help.focus();
    } else if (focusBeforeHelp instanceof HTMLElement && focusBeforeHelp.isConnected) {
      focusBeforeHelp.focus();
    }
  };
  help.addEventListener('click', () => setHelp(false));

  root.classList.add('concept-page');
  root.replaceChildren(topBar, workspace, playerBar, help);

  // ---- state rendering ----
  const showTerm = (): void => { stepTerm.hidden = mode !== 'ders' || !stepTerm.textContent; };
  let shownIndex = -1;
  let shownPlaying: boolean | null = null;
  const render = (s: PlayerState<P>): void => {
    if (s.index !== shownIndex) {
      if (shownIndex >= 0) dots[shownIndex].removeAttribute('aria-current');
      dots.forEach((d, i) => d.classList.toggle('done', i < s.index));
      dots[s.index].setAttribute('aria-current', 'step');
      stepCount.textContent = `Adım ${s.index + 1} / ${s.count}`;
      stepTitle.textContent = s.step.title;
      stepText.textContent = s.step.text;
      stepTerm.textContent = s.step.term ?? '';
      showTerm();
      prevBtn.disabled = s.index === 0;
      nextBtn.disabled = s.index === s.count - 1;
      shownIndex = s.index;
    }
    if (s.playing !== shownPlaying) {
      playBtn.textContent = s.playing ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', s.playing ? 'Duraklat' : 'Oynat');
      shownPlaying = s.playing;
    }
  };
  render(player.state);
  const unsubscribe = player.subscribe((s) => render(s));

  const applyMode = (): void => {
    root.dataset.mode = mode;
    for (const m of ['ders', 'lab'] as const) modeBtns[m].setAttribute('aria-pressed', String(m === mode));
    const ders = mode === 'ders';
    if (!ders) paramsOpen = false;
    paramsToggle.hidden = !ders;
    paramsToggle.setAttribute('aria-expanded', String(paramsOpen));
    params.hidden = ders && !paramsOpen;
    stepText.hidden = ders;
    showTerm();
    extra.hidden = ders;
  };
  applyMode();

  // ---- mount concept content ----
  const scene = page.mountScene(stage, player, mode);
  page.mountParams(params, player);
  page.mountExplainExtra?.(extra, player);

  // ---- stage size → scene ----
  let lastW = -1;
  let lastH = -1;
  const forwardSize = (force: boolean): void => {
    const r = stage.getBoundingClientRect();
    const w = Math.floor(r.width);
    const hgt = Math.floor(r.height);
    if (w <= 0 || hgt <= 0) return;
    if (!force && w === lastW && hgt === lastH) return;
    lastW = w;
    lastH = hgt;
    scene.resize(w, hgt);
  };
  const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const observer = RO ? new RO(() => forwardSize(false)) : null;
  observer?.observe(stage);
  forwardSize(true);

  const setMode = (m: Mode): void => {
    if (m === mode) return;
    mode = m;
    applyMode();
    writeMode(m);
    scene.setMode(m);
    forwardSize(true);
  };
  modeBtns.ders.addEventListener('click', () => setMode('ders'));
  modeBtns.lab.addEventListener('click', () => setMode('lab'));

  paramsToggle.addEventListener('click', () => {
    paramsOpen = !paramsOpen;
    applyMode();
  });

  // ---- keyboard ----
  const toggleFullscreen = (): void => {
    const doc = document as Document & { exitFullscreen?: () => Promise<void> };
    const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    const p = doc.fullscreenElement ? doc.exitFullscreen?.() : el.requestFullscreen?.();
    p?.catch(() => { /* denied or unsupported: stay as is */ });
  };
  const unbindKeys = bindKeys(window, player, { toggleFullscreen, toggleHelp: () => setHelp(!!help.hidden) }, shortcuts);
  const onEscape = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    if (!help.hidden) setHelp(false);
    else if (paramsOpen) {
      paramsOpen = false;
      applyMode();
      // Park focus on the stage, not on a button: keyboard.ts ignores the step
      // keys while a button or control is focused, so →/Space/← must work
      // straight after Escape (and Space must not reopen the panel).
      stage.focus({ preventScroll: true });
    }
  };
  window.addEventListener('keydown', onEscape);

  let destroyed = false;
  return {
    player,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      unbindKeys();
      window.removeEventListener('keydown', onEscape);
      observer?.disconnect();
      unsubscribe();
      scene.destroy();
      player.destroy();
      root.replaceChildren();
      root.classList.remove('concept-page');
      delete root.dataset.mode;
    },
  };
}
