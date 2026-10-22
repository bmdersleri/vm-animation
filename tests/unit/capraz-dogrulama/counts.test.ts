// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';

// A smaller split than the shipped one: copy that hard-codes today's counts fails here.
vi.mock('../../../src/concepts/degerlendirme/data', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/concepts/degerlendirme/data')>();
  const data = structuredClone(actual.evaluationData) as unknown as { cv: { samples: { id: string; partition: string }[] } };
  const dev = data.cv.samples.filter(s => s.partition === 'development').map(s => s.id).sort();
  const drop = new Set([dev.at(-1)!, data.cv.samples.find(s => s.partition === 'test')!.id]);
  data.cv.samples = data.cv.samples.filter(s => !drop.has(s.id));
  return { ...actual, evaluationData: data };
});
const { cvScenario } = await import('../../../src/concepts/capraz-dogrulama/scenario');
const { mountCvScene } = await import('../../../src/concepts/capraz-dogrulama/scene');
const { evaluationData } = await import('../../../src/concepts/degerlendirme/data');

describe('cross validation copy counts', () => {
  it('derives development and test counts and the id range from the data', () => {
    const dev = evaluationData.cv.samples.filter(s => s.partition === 'development').map(s => s.id).sort();
    const test = evaluationData.cv.samples.filter(s => s.partition === 'test').length;
    expect(dev.length).toBe(39);
    const player = new StepPlayer(cvScenario); const host = document.createElement('div');
    const scene = mountCvScene(host, player, 'lab');
    expect(host.querySelector('.cv-board h2')?.textContent).toBe(`Geliştirme · ${dev.length} müşteri`);
    expect(host.querySelector('.cv-note')?.textContent).toContain(`Kimlikler: ${dev[0]}…${dev.at(-1)!.slice(-2)}`);
    expect(host.querySelector('[data-test-locked]')?.textContent).toContain(`${test} müşteri`);
    player.goto(8);
    expect(host.querySelector('[data-pipeline="wrong"]')?.textContent).toContain(`Tüm geliştirmede fit · ${dev.length} müşteri`);
    player.goto(9);
    expect(host.querySelector('.cv-refit h2')?.textContent).toBe(`${dev.length} geliştirme müşterisiyle yeniden fit`);
    expect(host.querySelector('[data-test-report] h2')?.textContent).toBe(`Dış test açıldı · ${test} müşteri`);
    scene.destroy(); player.destroy();
  });
});
