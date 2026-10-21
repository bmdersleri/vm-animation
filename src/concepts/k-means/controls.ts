import type { StepPlayer } from '../../core/player';
import { kmeansData } from '../kmeans/data';
import { formatNumber } from '../../core/plot/format';
import { frameCount, type KMeansParams } from './scenario';
import { clampFrame, deriveView, inertiaText } from './view';

const UNDEFINED = '— (tanımsız)';
/** Steps (0-based) where the turn controls apply: ata, taşı, tekrar, dur, kötü. */
const TURN_FIRST = 2;
const TURN_LAST = 6;
const STEP_BASLANGIC = 1;
const STEP_NINIT = 7;
/** Loop play: one frame per tick, the same pace as the lesson sweeps. */
const LOOP_MS = 900;
const LOOP_PLAY = '▶ Oynat';
const LOOP_STOP = '❚❚ Durdur';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};
const methodName = (init: 'k-means++' | 'random'): string => (init === 'random' ? 'rastgele' : 'k-means++');

/** Lab parameter panel: turn controls on steps 3–7, the n_init pick list on step 8. */
export function mountKMeansParams(host: HTMLElement, player: StepPlayer<KMeansParams>): void {
  const id = `kmp${++uid}`;
  const runs = kmeansData.runs;

  const info = el('p', { class: 'km-run-info', 'data-run-info': '' });
  const newStart = el('button', { type: 'button', 'data-act': 'new-start' }, 'Yeni başlangıç');
  const prev = el('button', { type: 'button', 'data-act': 'prev-frame', 'aria-label': 'Önceki çerçeve' }, '◀ adım');
  const next = el('button', { type: 'button', 'data-act': 'next-frame', 'aria-label': 'Sonraki çerçeve' }, 'adım ▶');
  const last = el('button', { type: 'button', 'data-act': 'last-frame' }, 'Sona git');
  const loop = el('button', { type: 'button', 'data-act': 'play-loop', 'aria-pressed': 'false', 'aria-label': 'Turları sürekli oynat' }, LOOP_PLAY);
  const frameOut = el('output', { class: 'km-frame-out', 'aria-live': 'polite' });
  const turnGroup = el('div', { class: 'ctl km-turn', role: 'group', 'aria-label': 'Tur kontrolleri' },
    newStart, el('span', { class: 'km-step-btns' }, prev, next, last), loop, frameOut);

  const select = el('select', { id: `${id}-pick`, 'data-param': 'pick' });
  kmeansData.nInit.forEach((r, i) => {
    select.append(el('option', { value: String(i) }, `Başlangıç ${i + 1} · inertia ${inertiaText(r.inertia)}`));
  });
  const pickGroup = el('div', { class: 'ctl km-pick' }, el('label', { for: select.id }, 'Gösterilen başlangıç'), select);

  // Mouse clicks must not leave focus on a button: keyboard.ts ignores the step keys while one is focused.
  for (const b of [newStart, prev, next, last, loop]) b.addEventListener('mousedown', (e) => e.preventDefault());

  host.append(el('div', { class: 'km-params' }, info, turnGroup, pickGroup));

  const frameNow = (): number => {
    const s = player.state.params;
    return clampFrame(runs[s.start], s.frame);
  };
  // A frame write goes through setParams: the player cancels a running sweep, so no later tick overwrites it.
  const goFrame = (f: number): void => {
    const s = player.state.params;
    player.setParams({ frame: clampFrame(runs[s.start], f) });
  };
  const lastFrame = (): number => frameCount(runs[player.state.params.start]) - 1;

  // Loop play of the shown start: it stops on its last frame, on a step change, on any other turn control,
  // or once the panel is gone. Frame writes draw at once, so reduced motion needs nothing extra here.
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  let loopStep = -1;
  const stopLoop = (): void => {
    if (loopTimer !== null) clearInterval(loopTimer);
    loopTimer = null;
    loop.setAttribute('aria-pressed', 'false');
    setText(loop, LOOP_PLAY);
  };
  const tickLoop = (): void => {
    if (!host.isConnected) { stopLoop(); return; }
    const f = Math.min(frameNow() + 1, lastFrame());
    goFrame(f);
    if (f >= lastFrame()) stopLoop();
  };
  const startLoop = (): void => {
    loopStep = player.state.index;
    // Pin the shown frame now: a write cancels a running step sweep (from the last frame, start over).
    goFrame(frameNow() >= lastFrame() ? 0 : frameNow());
    loop.setAttribute('aria-pressed', 'true');
    setText(loop, LOOP_STOP);
    loopTimer = setInterval(tickLoop, LOOP_MS);
  };
  loop.addEventListener('click', () => (loopTimer === null ? startLoop() : stopLoop()));

  newStart.addEventListener('click', () => {
    stopLoop();
    player.setParams({ start: (player.state.params.start + 1) % runs.length, frame: 0 });
  });
  prev.addEventListener('click', () => { stopLoop(); goFrame(frameNow() - 1); });
  next.addEventListener('click', () => { stopLoop(); goFrame(frameNow() + 1); });
  last.addEventListener('click', () => { stopLoop(); goFrame(lastFrame()); });
  select.addEventListener('change', () => player.setParam('pick', Number(select.value)));

  const sync = (): void => {
    const { index, params } = player.state;
    if (loopTimer !== null && index !== loopStep) stopLoop();
    const turn = index >= TURN_FIRST && index <= TURN_LAST;
    turnGroup.hidden = !turn;
    pickGroup.hidden = index !== STEP_NINIT;
    info.hidden = !(turn || index === STEP_BASLANGIC);
    const run = runs[params.start];
    setText(info, `Başlangıç ${params.start + 1}/${runs.length} · yöntem: ${methodName(run.init)} · tohum: ${run.seed}`);
    const f = clampFrame(run, params.frame);
    const total = frameCount(run) - 1;
    prev.disabled = f <= 0;
    next.disabled = f >= total;
    last.disabled = f >= total;
    const v = deriveView({ start: params.start, frame: f });
    const phase = v.turn === 0 ? 'başlangıç merkezleri' : `tur ${v.turn} · ${v.phase === 'ata' ? 'ata' : 'taşı'}`;
    setText(frameOut, `Çerçeve ${f + 1}/${total + 1} · ${phase}`);
    if (select.value !== String(params.pick)) select.value = String(params.pick);
  };
  sync();
  player.subscribe(sync);
}

/** Lab explain panel: centre coordinates of the shown frame and the turn table of the current start. */
export function mountKMeansExtra(host: HTMLElement, player: StepPlayer<KMeansParams>): void {
  const root = el('div', { class: 'km-extra' });
  host.append(root);
  const render = (): void => {
    const { index, params } = player.state;
    root.hidden = index < STEP_BASLANGIC || index > TURN_LAST;
    const v = deriveView(params);
    const coords = el('ul', { class: 'km-coords' });
    v.centers.forEach((c, i) => {
      coords.append(el('li', {}, `Merkez ${i + 1}: (${formatNumber(c[0], 2)}; ${formatNumber(c[1], 2)})`));
    });
    const body = el('tbody');
    v.run.turns.forEach((t, i) => {
      const tr = el('tr', {},
        el('td', {}, String(i + 1)),
        el('td', {}, t.changed === null ? UNDEFINED : String(t.changed)),
        el('td', {}, inertiaText(t.inertia)));
      if (i + 1 === v.turn) tr.setAttribute('data-current', '');
      body.append(tr);
    });
    const table = el('table', { class: 'km-turns' },
      el('caption', {}, 'Turlar'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Tur'), el('th', { scope: 'col' }, 'Değişen'), el('th', { scope: 'col' }, 'Inertia (tur sonu)'))),
      body);
    root.replaceChildren(el('h3', { class: 'km-panel-title' }, 'Merkez koordinatları'), coords, table);
  };
  render();
  player.subscribe(render);
}
