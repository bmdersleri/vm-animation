// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kMeansScenario, frameCount, type KMeansParams } from '../../../src/concepts/k-means/scenario';
import { mountKMeansParams, mountKMeansExtra } from '../../../src/concepts/k-means/controls';
import { mountKMeansScene } from '../../../src/concepts/k-means/scene';
import { kmeansData } from '../../../src/concepts/kmeans/data';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

const setup = () => {
  const player = new StepPlayer<KMeansParams>(kMeansScenario);
  const host = document.createElement('div');
  document.body.append(host);
  mountKMeansParams(host, player);
  return { player, host };
};
const click = (host: HTMLElement, sel: string) => (host.querySelector(sel) as HTMLButtonElement).click();
const visible = (host: HTMLElement, sel: string) => {
  const e = host.querySelector<HTMLElement>(sel)!;
  return !e.closest('[hidden]');
};
const runOf = (p: KMeansParams) => kmeansData.runs[p.start];

describe('k-means controls', () => {
  it('new start cycles through 12 and resets frame', () => {
    const { player, host } = setup();
    player.goto(2);
    click(host, '[data-act=next-frame]');
    expect(player.state.params.frame).toBe(2);
    click(host, '[data-act=new-start]');
    expect(player.state.params).toMatchObject({ start: 1, frame: 0 });
    for (let i = 0; i < 11; i++) click(host, '[data-act=new-start]');
    expect(player.state.params.start).toBe(0);
    expect(host.textContent).toContain('k-means++');
  });

  it('frame buttons clamp to the run', () => {
    const { player, host } = setup();
    player.goto(2);
    const prev = host.querySelector<HTMLButtonElement>('[data-act=prev-frame]')!;
    const next = host.querySelector<HTMLButtonElement>('[data-act=next-frame]')!;
    player.setParam('frame', 0);
    expect(prev.disabled).toBe(true);
    click(host, '[data-act=prev-frame]');
    expect(player.state.params.frame).toBe(0);
    click(host, '[data-act=last-frame]');
    const last = frameCount(runOf(player.state.params)) - 1;
    expect(player.state.params.frame).toBe(last);
    expect(next.disabled).toBe(true);
    click(host, '[data-act=next-frame]');
    expect(player.state.params.frame).toBe(last);
    click(host, '[data-act=prev-frame]');
    expect(player.state.params.frame).toBe(last - 1);
  });

  it('controls show only on their steps', () => {
    const { player, host } = setup();
    for (let i = 0; i < 8; i++) {
      player.goto(i);
      const turn = i >= 2 && i <= 6;
      expect(visible(host, '[data-act=new-start]'), `new-start @${i + 1}`).toBe(turn);
      expect(visible(host, '[data-act=next-frame]'), `frame @${i + 1}`).toBe(turn);
      expect(visible(host, '[data-act=last-frame]'), `last @${i + 1}`).toBe(turn);
      expect(visible(host, '[data-act=play-loop]'), `loop @${i + 1}`).toBe(turn);
      expect(visible(host, 'select[data-param=pick]'), `pick @${i + 1}`).toBe(i === 7);
    }
    player.goto(7);
    const sel = host.querySelector<HTMLSelectElement>('select[data-param=pick]')!;
    expect(sel.options).toHaveLength(10);
    expect(sel.options[0].textContent).toContain('Başlangıç 1');
    expect(sel.value).toBe(String(kmeansData.nInitBest));
  });

  it('pick shows that run\'s final state', () => {
    const { player, host } = setup();
    const scene = document.createElement('div');
    document.body.append(scene);
    const handle = mountKMeansScene(scene, player, 'lab');
    handle.resize(900, 600);
    player.goto(7);
    const sel = host.querySelector<HTMLSelectElement>('select[data-param=pick]')!;
    sel.value = '5';
    sel.dispatchEvent(new Event('change'));
    expect(player.state.params.pick).toBe(5);
    const clusters = [...scene.querySelectorAll('circle.cs-point')].map((c) => c.getAttribute('data-cluster'));
    expect(clusters).toEqual(kmeansData.nInit[5].labels.map(String));
    handle.destroy();
  });

  it('param change during sweep shows the chosen frame', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    const scene = document.createElement('div');
    document.body.append(scene);
    const handle = mountKMeansScene(scene, player, 'lab');
    handle.resize(900, 600);
    player.goto(4);
    vi.advanceTimersByTime(1900);
    const during = player.state.params.frame;
    expect(during).toBeGreaterThan(3);
    click(host, '[data-act=next-frame]');
    const chosen = during + 1;
    expect(player.state.params.frame).toBe(chosen);
    vi.advanceTimersByTime(10000);
    expect(player.state.params.frame).toBe(chosen);
    click(host, '[data-act=new-start]');
    vi.advanceTimersByTime(10000);
    expect(player.state.params).toMatchObject({ start: 1, frame: 0 });
    handle.destroy();
  });

  it('loop play runs the chosen start to its end and stops', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    player.goto(2);
    for (let i = 0; i < 3; i++) click(host, '[data-act=new-start]');
    expect(player.state.params).toMatchObject({ start: 3, frame: 0 });
    const loop = host.querySelector<HTMLButtonElement>('[data-act=play-loop]')!;
    expect(loop.type).toBe('button');
    expect(loop.getAttribute('aria-pressed')).toBe('false');
    expect(loop.textContent).toBe('▶ Oynat');
    loop.click();
    expect(loop.getAttribute('aria-pressed')).toBe('true');
    expect(loop.textContent).toBe('❚❚ Durdur');
    vi.advanceTimersByTime(900);
    expect(player.state.params.frame).toBe(1);
    expect(player.state.index).toBe(2);
    const last = frameCount(kmeansData.runs[3]) - 1;
    vi.advanceTimersByTime(900 * (last + 3));
    expect(player.state.params).toMatchObject({ start: 3, frame: last });
    expect(player.state.index).toBe(2);
    expect(loop.getAttribute('aria-pressed')).toBe('false');
    expect(loop.textContent).toBe('▶ Oynat');
    expect(vi.getTimerCount()).toBe(0);
    player.destroy();
  });

  it('loop play from the last frame starts over, and a second press stops it', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    player.goto(2);
    click(host, '[data-act=last-frame]');
    click(host, '[data-act=play-loop]');
    expect(player.state.params.frame).toBe(0);
    vi.advanceTimersByTime(900 * 2);
    expect(player.state.params.frame).toBe(2);
    click(host, '[data-act=play-loop]');
    expect(host.querySelector('[data-act=play-loop]')!.getAttribute('aria-pressed')).toBe('false');
    vi.advanceTimersByTime(900 * 5);
    expect(player.state.params.frame).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
    player.destroy();
  });

  it('a step change or another turn control stops loop play', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    const loop = host.querySelector<HTMLButtonElement>('[data-act=play-loop]')!;
    player.goto(2);
    loop.click();
    vi.advanceTimersByTime(900);
    player.goto(3);
    expect(loop.getAttribute('aria-pressed')).toBe('false');
    const f = player.state.params.frame;
    vi.advanceTimersByTime(900 * 5);
    expect(player.state.params.frame).toBe(f);
    expect(vi.getTimerCount()).toBe(0);
    for (const act of ['new-start', 'prev-frame', 'next-frame', 'last-frame']) {
      player.goto(2);
      player.setParam('frame', 2);
      loop.click();
      expect(loop.getAttribute('aria-pressed'), act).toBe('true');
      click(host, `[data-act=${act}]`);
      expect(loop.getAttribute('aria-pressed'), act).toBe('false');
      const at = player.state.params.frame;
      vi.advanceTimersByTime(900 * 3);
      expect(player.state.params.frame, act).toBe(at);
    }
    player.destroy();
  });

  it('loop play during a step sweep takes over from the shown frame', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    player.goto(6);
    vi.advanceTimersByTime(900 * 2);
    const f = player.state.params.frame;
    click(host, '[data-act=play-loop]');
    expect(player.state.params.frame).toBe(f);
    vi.advanceTimersByTime(900);
    expect(player.state.params.frame).toBe(f + 1);
    player.destroy();
  });

  it('loop play stops when its panel leaves the page', () => {
    vi.useFakeTimers();
    const { player, host } = setup();
    player.goto(2);
    const f = player.state.params.frame;
    click(host, '[data-act=play-loop]');
    host.remove();
    vi.advanceTimersByTime(900 * 2);
    expect(player.state.params.frame).toBe(f);
    expect(vi.getTimerCount()).toBe(0);
    player.destroy();
  });

  it('explain table lists every turn', () => {
    const player = new StepPlayer<KMeansParams>(kMeansScenario);
    const host = document.createElement('div');
    document.body.append(host);
    mountKMeansExtra(host, player);
    player.goto(4);
    player.setParam('frame', 3);
    const rows = host.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(kmeansData.runs[0].turns.length);
    expect(rows[0].textContent).toContain('— (tanımsız)');
    expect([...host.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Tur', 'Değişen', 'Inertia (tur sonu)']);
    expect(host.querySelectorAll('[data-current]')).toHaveLength(1);
    expect(host.querySelector('[data-current]')!.textContent).toContain('2');
    expect(host.querySelectorAll('.km-coords li')).toHaveLength(3);
    player.setParam('start', 1);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(kmeansData.runs[1].turns.length);
    player.goto(0);
    expect(host.querySelector<HTMLElement>('.km-extra')!.hidden).toBe(true);
    player.goto(1);
    expect(host.querySelector<HTMLElement>('.km-extra')!.hidden).toBe(false);
  });
});
